import { extractDocument } from '../services/extractionRouter.js';
import { classifyVariation } from '../services/variationClassifier.js';
import { generateSectionDiff } from '../services/diffGenerator.js';
import { getDocumentById } from '../services/documentManager.js';
import { randomUUID } from 'crypto';

// LYL_DEP: dotenv@^16.3.1

/**
 * Assess Variation Workflow
 * Classifies PIL variation as complicated or general with section-by-section diff
 */

// Performance constants — real pharma docs need more time
const WORKFLOW_TIMEOUT_MS = 600000; // 10 minutes for large documents
const EXTRACTION_TIMEOUT_MS = 540000; // 9 minutes per document (100+ page PDFs)
const CLASSIFICATION_TIMEOUT_MS = 120000; // 2 minutes for classification
const MAX_DOCUMENT_SIZE_MB = 25; // Maximum document size
const MAX_PAGES_PER_DOCUMENT = 200; // Real EPAR/SmPC docs can be 100+ pages

/**
 * Execute Assess Variation workflow with timeout enforcement
 * @param {string} approvedPilId - UUID of approved PIL document
 * @param {string} changeTriggerDocumentId - UUID of change trigger (Updated PIL, Regulatory Announcement, or revision comments)
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Workflow result with classification and diff
 */
export async function executeAssessVariation(approvedPilId, changeTriggerDocumentId, sessionId) {
  const workflowId = randomUUID();
  const startTime = Date.now();
  
  // Create workflow timeout promise
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Workflow timeout: exceeded ${WORKFLOW_TIMEOUT_MS}ms SLA`));
    }, WORKFLOW_TIMEOUT_MS);
  });
  
  try {
    // Execute workflow with timeout enforcement
    const result = await Promise.race([
      executeWorkflowInternal(workflowId, approvedPilId, changeTriggerDocumentId, sessionId, startTime),
      timeoutPromise
    ]);
    
    return result;
    
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    
    console.error(`[Assess Variation] Workflow failed`, {
      workflowId,
      error: error.message,
      stack: error.stack,
      executionTimeMs,
      exceededSLA: executionTimeMs > WORKFLOW_TIMEOUT_MS,
      timestamp: new Date().toISOString()
    });
    
    throw error;
  }
}

/**
 * Internal workflow execution logic
 */
async function executeWorkflowInternal(workflowId, approvedPilId, changeTriggerDocumentId, sessionId, startTime) {
  // Validate documents exist
  const approvedPil = getDocumentById(approvedPilId);
  const changeTrigger = getDocumentById(changeTriggerDocumentId);
  
  if (!approvedPil) {
    throw new Error(`Approved PIL document not found: ${approvedPilId}`);
  }
  
  if (!changeTrigger) {
    throw new Error(`Change trigger document not found: ${changeTriggerDocumentId}`);
  }
  
  // Validate document types
  const validChangeTriggerTypes = ['updated_pil', 'regulatory_announcement', 'regulatory_source'];
  if (approvedPil.type !== 'approved_pil') {
    throw new Error(`First document must be approved_pil, got: ${approvedPil.type}`);
  }
  
  if (!validChangeTriggerTypes.includes(changeTrigger.type)) {
    throw new Error(`Second document must be updated_pil, regulatory_announcement, or regulatory_source, got: ${changeTrigger.type}`);
  }
  
  // Validate document size limits
  validateDocumentSize(approvedPil);
  validateDocumentSize(changeTrigger);
  
  console.log(`[Assess Variation] Starting workflow ${workflowId}`, {
    approvedPilId,
    changeTriggerDocumentId,
    sessionId,
    approvedPilPages: approvedPil.pageCount,
    changeTriggerPages: changeTrigger.pageCount,
    timestamp: new Date().toISOString()
  });
  
  // Stage 1: Extract both documents in parallel with individual timeouts and caching
  console.log(`[Assess Variation] Extracting documents in parallel (with cache check)`);
  const extractionStartTime = Date.now();
  
  const [approvedExtraction, changeTriggerExtraction] = await Promise.all([
    withTimeout(
      extractDocument(approvedPilId, sessionId),
      EXTRACTION_TIMEOUT_MS,
      `Approved PIL extraction timeout (${EXTRACTION_TIMEOUT_MS}ms)`
    ),
    withTimeout(
      extractDocument(changeTriggerDocumentId, sessionId),
      EXTRACTION_TIMEOUT_MS,
      `Change trigger extraction timeout (${EXTRACTION_TIMEOUT_MS}ms)`
    )
  ]);
  
  const extractionTimeMs = Date.now() - extractionStartTime;
  console.log(`[Assess Variation] Extraction completed in ${extractionTimeMs}ms`);
  
  // Stage 2: Classify variation and generate diff with timeout
  console.log(`[Assess Variation] Classifying variation and generating diff`);
  const classificationStartTime = Date.now();
  
  const [classificationResult, sectionDiff] = await Promise.all([
    withTimeout(
      classifyVariation(approvedExtraction.sections, changeTriggerExtraction.sections),
      CLASSIFICATION_TIMEOUT_MS,
      `Variation classification timeout (${CLASSIFICATION_TIMEOUT_MS}ms)`
    ),
    withTimeout(
      generateSectionDiff(approvedExtraction.sections, changeTriggerExtraction.sections),
      CLASSIFICATION_TIMEOUT_MS,
      `Section diff generation timeout (${CLASSIFICATION_TIMEOUT_MS}ms)`
    )
  ]);
  
  const classificationTimeMs = Date.now() - classificationStartTime;
  console.log(`[Assess Variation] Classification completed in ${classificationTimeMs}ms`);
  
  const executionTimeMs = Date.now() - startTime;
  
  // Validate SLA compliance
  if (executionTimeMs > WORKFLOW_TIMEOUT_MS) {
    console.warn(`[Assess Variation] Workflow exceeded SLA`, {
      workflowId,
      executionTimeMs,
      slaMs: WORKFLOW_TIMEOUT_MS,
      overageMs: executionTimeMs - WORKFLOW_TIMEOUT_MS
    });
  }
  
  // Generate tracked changes Word document
  let trackedChangesDocxBase64 = null;
  try {
    trackedChangesDocxBase64 = await generateTrackedChangesDocx(
      sectionDiff, classificationResult, approvedPil.productName || approvedPil.name
    );
    console.log('[Assess Variation] Tracked changes document generated');
  } catch (e) {
    console.error('[Assess Variation] Tracked changes docx failed:', e.message);
  }

  const result = {
    workflowId,
    workflowType: 'assess_variation',
    classification: classificationResult.classification,
    justification: classificationResult.justification,
    confidenceScore: classificationResult.confidenceScore,
    sectionDiffs: sectionDiff,
    trackedChangesDocxBase64,
    summary: {
      totalSections: sectionDiff.length,
      sectionsChanged: sectionDiff.filter(s => s.changeType !== 'unchanged').length,
      sectionsAdded: sectionDiff.filter(s => s.changeType === 'added').length,
      sectionsRemoved: sectionDiff.filter(s => s.changeType === 'removed').length,
      sectionsModified: sectionDiff.filter(s => s.changeType === 'modified').length,
      averageSignificance: calculateAverageSignificance(sectionDiff)
    },
    inputDocuments: [
      {
        id: approvedPilId,
        name: approvedPil.name,
        type: approvedPil.type
      },
      {
        id: changeTriggerDocumentId,
        name: changeTrigger.name,
        type: changeTrigger.type
      }
    ],
    extractionResults: [
      {
        documentId: approvedPilId,
        provider: approvedExtraction.provider,
        sections: approvedExtraction.sections,
        pageImages: approvedExtraction.pageImages,
        processingTimeMs: approvedExtraction.processingTimeMs
      },
      {
        documentId: changeTriggerDocumentId,
        provider: changeTriggerExtraction.provider,
        sections: changeTriggerExtraction.sections,
        pageImages: changeTriggerExtraction.pageImages,
        processingTimeMs: changeTriggerExtraction.processingTimeMs
      }
    ],
    performance: {
      extractionTimeMs,
      classificationTimeMs,
      totalExecutionTimeMs: executionTimeMs,
      slaMs: WORKFLOW_TIMEOUT_MS,
      withinSLA: executionTimeMs <= WORKFLOW_TIMEOUT_MS
    },
    executionTimeMs,
    executedDate: new Date().toISOString()
  };
  
  console.log(`[Assess Variation] Workflow completed`, {
    workflowId,
    classification: result.classification,
    sectionsChanged: result.summary.sectionsChanged,
    executionTimeMs,
    withinSLA: result.performance.withinSLA,
    timestamp: new Date().toISOString()
  });
  
  return result;
}

/**
 * Validate document size limits
 */
function validateDocumentSize(document) {
  const fileSizeMB = document.fileSize / (1024 * 1024);
  
  if (fileSizeMB > MAX_DOCUMENT_SIZE_MB) {
    throw new Error(
      `Document size ${fileSizeMB.toFixed(1)}MB exceeds maximum ${MAX_DOCUMENT_SIZE_MB}MB: ${document.name}`
    );
  }
  
  if (document.pageCount && document.pageCount > MAX_PAGES_PER_DOCUMENT) {
    throw new Error(
      `Document page count ${document.pageCount} exceeds maximum ${MAX_PAGES_PER_DOCUMENT} pages: ${document.name}`
    );
  }
}

/**
 * Execute promise with timeout
 */
function withTimeout(promise, timeoutMs, errorMessage) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    })
  ]);
}

/**
 * Calculate average significance score across all sections
 */
function calculateAverageSignificance(sectionDiffs) {
  if (sectionDiffs.length === 0) return 0;
  
  const changedSections = sectionDiffs.filter(s => s.changeType !== 'unchanged');
  if (changedSections.length === 0) return 0;
  
  const totalSignificance = changedSections.reduce((sum, section) => sum + section.significanceScore, 0);
  return Math.round(totalSignificance / changedSections.length);
}

/**
 * Validate workflow input
 */
export function validateAssessVariationInput(approvedPilId, changeTriggerDocumentId) {
  if (!approvedPilId || typeof approvedPilId !== 'string') {
    return { valid: false, error: 'approvedPilId is required and must be a string' };
  }
  
  if (!changeTriggerDocumentId || typeof changeTriggerDocumentId !== 'string') {
    return { valid: false, error: 'changeTriggerDocumentId is required and must be a string' };
  }
  
  if (approvedPilId === changeTriggerDocumentId) {
    return { valid: false, error: 'approvedPilId and changeTriggerDocumentId must be different documents' };
  }
  
  return { valid: true };
}

/**
 * Generate a Word document showing tracked changes (old vs new)
 * Red strikethrough for removed text, green underline for added text
 */
async function generateTrackedChangesDocx(sectionDiffs, classification, productName) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, Packer } = await import('docx');

  const children = [];

  // Header
  children.push(new Paragraph({
    children: [new TextRun({ text: `PIL Variation Report — ${productName || 'Product'}`, bold: true, size: 28, color: '1B365D' })],
    heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, spacing: { after: 100 }
  }));
  children.push(new Paragraph({
    children: [
      new TextRun({ text: `Classification: `, size: 22 }),
      new TextRun({ text: classification.classification?.toUpperCase() || 'PENDING', bold: true, size: 22, color: classification.classification === 'complicated' ? 'CC0000' : '008800' })
    ],
    alignment: AlignmentType.CENTER, spacing: { after: 100 }
  }));
  children.push(new Paragraph({
    children: [new TextRun({ text: `Generated: ${new Date().toISOString().split('T')[0]}`, size: 18, color: '999999', italics: true })],
    alignment: AlignmentType.CENTER, spacing: { after: 400 }
  }));

  // Justification
  if (classification.justification) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Classification Justification', bold: true, size: 24 })],
      heading: HeadingLevel.HEADING_2, spacing: { before: 200, after: 100 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: classification.justification, size: 20 })],
      spacing: { after: 300 }
    }));
  }

  // Section-by-section changes
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Section-by-Section Changes', bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 200 }
  }));

  for (const diff of sectionDiffs) {
    if (diff.changeType === 'unchanged') continue;

    const changeColor = diff.changeType === 'added' ? '008800'
      : diff.changeType === 'removed' ? 'CC0000'
      : 'DD6600';
    const changeLabel = diff.changeType.toUpperCase();

    children.push(new Paragraph({
      children: [
        new TextRun({ text: `${diff.sectionName || 'Section'} `, bold: true, size: 22 }),
        new TextRun({ text: `[${changeLabel}]`, bold: true, size: 18, color: changeColor }),
        new TextRun({ text: ` — Significance: ${diff.significanceScore || 0}/100`, size: 18, color: '666666' })
      ],
      heading: HeadingLevel.HEADING_3, spacing: { before: 200, after: 100 }
    }));

    if (diff.changeType === 'modified') {
      // Show old text with strikethrough
      if (diff.approvedText) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'APPROVED (old): ', bold: true, size: 18, color: 'CC0000' })],
          spacing: { after: 40 }
        }));
        for (const line of diff.approvedText.substring(0, 2000).split('\n').filter(l => l.trim())) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 18, color: 'CC0000', strike: true })],
            spacing: { after: 30 }
          }));
        }
      }
      // Show new text with underline
      if (diff.updatedText) {
        children.push(new Paragraph({
          children: [new TextRun({ text: 'UPDATED (new): ', bold: true, size: 18, color: '008800' })],
          spacing: { before: 80, after: 40 }
        }));
        for (const line of diff.updatedText.substring(0, 2000).split('\n').filter(l => l.trim())) {
          children.push(new Paragraph({
            children: [new TextRun({ text: line, size: 18, color: '008800', underline: {} })],
            spacing: { after: 30 }
          }));
        }
      }
    } else if (diff.changeType === 'added') {
      const text = diff.updatedText || diff.approvedText || '';
      for (const line of text.substring(0, 2000).split('\n').filter(l => l.trim())) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: '008800', underline: {} })],
          spacing: { after: 30 }
        }));
      }
    } else if (diff.changeType === 'removed') {
      const text = diff.approvedText || '';
      for (const line of text.substring(0, 2000).split('\n').filter(l => l.trim())) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 18, color: 'CC0000', strike: true })],
          spacing: { after: 30 }
        }));
      }
    }

    if (diff.significanceReason) {
      children.push(new Paragraph({
        children: [new TextRun({ text: `Note: ${diff.significanceReason}`, size: 16, color: '888888', italics: true })],
        spacing: { before: 40, after: 100 }
      }));
    }
  }

  // Summary table
  children.push(new Paragraph({
    children: [new TextRun({ text: 'Change Summary', bold: true, size: 24 })],
    heading: HeadingLevel.HEADING_2, spacing: { before: 400, after: 200 }
  }));

  const summaryData = [
    ['Change Type', 'Count'],
    ['Modified', String(sectionDiffs.filter(s => s.changeType === 'modified').length)],
    ['Added', String(sectionDiffs.filter(s => s.changeType === 'added').length)],
    ['Removed', String(sectionDiffs.filter(s => s.changeType === 'removed').length)],
    ['Unchanged', String(sectionDiffs.filter(s => s.changeType === 'unchanged').length)]
  ];
  const rows = summaryData.map((row, i) => new TableRow({
    children: row.map(cell => new TableCell({
      children: [new Paragraph({ children: [new TextRun({ text: cell, bold: i === 0, size: 18 })] })],
      width: { size: 50, type: WidthType.PERCENTAGE }
    }))
  }));
  children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer.toString('base64');
}