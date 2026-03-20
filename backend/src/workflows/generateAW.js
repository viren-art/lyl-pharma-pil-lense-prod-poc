import { extractDocument } from '../services/extractionRouter.js';
import { getDocumentById } from '../services/documentManager.js';
import { generateAWPdf } from '../services/awGenerator.js';
import { parseDiecutSpecification } from '../services/diecutApplier.js';

/**
 * Generate AW Draft Workflow
 * Produces formatted artwork PDF from Approved PIL using market-specific templates
 * Implements strict 60-second timeout with performance monitoring
 */
export async function executeGenerateAW(approvedPilId, market, diecutSpecificationId, sessionId) {
  const startTime = Date.now();
  const WORKFLOW_TIMEOUT = 60000; // 60 seconds total workflow timeout (hard SLA)
  
  try {
    // Wrap entire workflow in timeout
    return await Promise.race([
      executeGenerateAWInternal(approvedPilId, market, diecutSpecificationId, sessionId, startTime),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Workflow timeout: Generate AW Draft exceeded 60 seconds (SLA violation)')), WORKFLOW_TIMEOUT)
      )
    ]);
  } catch (error) {
    const executionTimeMs = Date.now() - startTime;
    console.error(`[GenerateAW] Workflow failed`, {
      approvedPilId,
      market,
      executionTimeMs,
      slaViolation: executionTimeMs >= WORKFLOW_TIMEOUT,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Internal workflow execution with performance tracking
 */
async function executeGenerateAWInternal(approvedPilId, market, diecutSpecificationId, sessionId, startTime) {
  // Validate inputs
  if (!approvedPilId || !market) {
    throw new Error('Missing required parameters: approvedPilId and market are required');
  }
  
  if (!['taiwan_tfda', 'thailand_fda'].includes(market)) {
    throw new Error('Invalid market. Must be taiwan_tfda or thailand_fda');
  }
  
  // Verify documents exist
  const approvedPil = getDocumentById(approvedPilId);
  if (!approvedPil) {
    throw new Error(`Approved PIL document not found: ${approvedPilId}`);
  }
  
  let diecutSpec = null;
  if (diecutSpecificationId) {
    const diecutDoc = getDocumentById(diecutSpecificationId);
    if (!diecutDoc) {
      throw new Error(`Diecut Specification document not found: ${diecutSpecificationId}`);
    }
    // Parse diecut specification
    const diecutStartTime = Date.now();
    diecutSpec = await parseDiecutSpecification(diecutDoc);
    const diecutTimeMs = Date.now() - diecutStartTime;
    console.log(`[GenerateAW] Diecut parsing completed in ${diecutTimeMs}ms`);
  }
  
  // Stage 1: Extract Approved PIL content
  console.log(`[GenerateAW] Extracting Approved PIL: ${approvedPilId}`);
  const extractionStartTime = Date.now();
  const extractionResult = await extractDocument(approvedPilId, sessionId);
  const extractionTimeMs = Date.now() - extractionStartTime;
  
  if (!extractionResult || !extractionResult.sections || extractionResult.sections.length === 0) {
    throw new Error('Extraction failed: No sections extracted from Approved PIL');
  }
  
  console.log(`[GenerateAW] Extraction completed in ${extractionTimeMs}ms, ${extractionResult.sections.length} sections found`);
  
  // Performance check: Warn if extraction took too long
  if (extractionTimeMs > 30000) { // 30 seconds
    console.warn(`[GenerateAW] Extraction time approaching limits`, {
      extractionTimeMs,
      sectionsExtracted: extractionResult.sections.length,
      timeRemaining: 60000 - (Date.now() - startTime)
    });
  }
  
  // Stage 2: Generate AW PDF using market template with regulatory verification
  console.log(`[GenerateAW] Generating AW PDF for market: ${market}`);
  const generationStartTime = Date.now();
  const pdfResult = await generateAWPdf({
    sections: extractionResult.sections,
    market,
    diecutSpec,
    productName: approvedPil.productName,
    documentName: approvedPil.name
  });
  const generationTimeMs = Date.now() - generationStartTime;
  
  console.log(`[GenerateAW] PDF generation completed in ${generationTimeMs}ms`);
  
  const executionTimeMs = Date.now() - startTime;
  
  // Performance monitoring: Log if approaching timeout
  if (executionTimeMs > 50000) { // 50 seconds (83% of SLA)
    console.warn(`[GenerateAW] Workflow approaching timeout threshold`, {
      executionTimeMs,
      extractionTimeMs,
      generationTimeMs,
      sectionsProcessed: extractionResult.sections.length,
      slaRemaining: 60000 - executionTimeMs,
      slaUtilization: `${((executionTimeMs / 60000) * 100).toFixed(1)}%`
    });
  }
  
  // SLA compliance check
  const slaMet = executionTimeMs < 60000;
  
  return {
    workflowType: 'generate_aw',
    pdfBase64: pdfResult.pdfBase64,
    market,
    diecutApplied: !!diecutSpec,
    sectionsProcessed: extractionResult.sections.length,
    generationTimeMs: pdfResult.generationTimeMs,
    executionTimeMs,
    regulatoryVerification: pdfResult.regulatoryVerification,
    finalVerification: pdfResult.finalVerification,
    performanceMetrics: {
      extractionTimeMs,
      generationTimeMs,
      totalTimeMs: executionTimeMs,
      timeoutThreshold: 60000,
      timeRemaining: 60000 - executionTimeMs,
      slaMet,
      slaUtilization: `${((executionTimeMs / 60000) * 100).toFixed(1)}%`
    },
    extractionResult: {
      documentId: approvedPilId,
      provider: extractionResult.provider,
      sections: extractionResult.sections,
      pageImages: extractionResult.pageImages,
      processingTimeMs: extractionResult.processingTimeMs
    }
  };
}

/**
 * Validate workflow inputs
 */
export function validateGenerateAWInputs(approvedPilId, market, diecutSpecificationId) {
  const errors = [];
  
  if (!approvedPilId) {
    errors.push('Approved PIL document is required');
  }
  
  if (!market) {
    errors.push('Target market is required');
  } else if (!['taiwan_tfda', 'thailand_fda'].includes(market)) {
    errors.push('Invalid market. Must be taiwan_tfda or thailand_fda');
  }
  
  // Diecut specification is optional
  
  return {
    valid: errors.length === 0,
    errors
  };
}