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

// Performance constants
const WORKFLOW_TIMEOUT_MS = 75000; // 75 seconds SLA
const EXTRACTION_TIMEOUT_MS = 30000; // 30 seconds per document extraction
const CLASSIFICATION_TIMEOUT_MS = 10000; // 10 seconds for classification
const MAX_DOCUMENT_SIZE_MB = 25; // Maximum document size
const MAX_PAGES_PER_DOCUMENT = 50; // Maximum pages to prevent excessive processing

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
  
  const result = {
    workflowId,
    workflowType: 'assess_variation',
    classification: classificationResult.classification,
    justification: classificationResult.justification,
    confidenceScore: classificationResult.confidenceScore,
    sectionDiffs: sectionDiff,
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