import { extractDocument } from '../services/extractionRouter.js';
import { detectDeviations } from '../services/deviationDetector.js';
import { getDocumentById } from '../services/documentManager.js';
import { randomUUID } from 'crypto';

/**
 * Review AW Workflow
 * Detects deviations between AW Draft PDF and Approved PIL
 * Categorizes findings by severity (critical, major, minor)
 */

const workflowExecutions = new Map();

/**
 * Execute Review AW workflow
 * @param {string} awDraftId - UUID of AW Draft PDF
 * @param {string} approvedPilId - UUID of Approved PIL
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Workflow execution result
 */
export async function executeReviewAW(awDraftId, approvedPilId, sessionId) {
  const workflowId = randomUUID();
  const startTime = Date.now();
  
  try {
    // Validate documents exist
    const awDraft = getDocumentById(awDraftId);
    const approvedPil = getDocumentById(approvedPilId);
    
    if (!awDraft) {
      throw new Error(`AW Draft document not found: ${awDraftId}`);
    }
    
    if (!approvedPil) {
      throw new Error(`Approved PIL document not found: ${approvedPilId}`);
    }
    
    // Validate document types
    if (awDraft.type !== 'aw_draft') {
      throw new Error(`Document ${awDraftId} is not an AW Draft (type: ${awDraft.type})`);
    }
    
    if (approvedPil.type !== 'approved_pil') {
      throw new Error(`Document ${approvedPilId} is not an Approved PIL (type: ${approvedPil.type})`);
    }
    
    console.log(`[ReviewAW] Starting workflow ${workflowId}`, {
      awDraftId,
      approvedPilId,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    // Stage 1: Extract both documents
    console.log(`[ReviewAW] Extracting AW Draft: ${awDraftId}`);
    const awExtractionResult = await extractDocument(awDraftId, sessionId);
    
    console.log(`[ReviewAW] Extracting Approved PIL: ${approvedPilId}`);
    const approvedExtractionResult = await extractDocument(approvedPilId, sessionId);
    
    // Stage 2: Detect deviations using semantic intelligence
    console.log(`[ReviewAW] Detecting deviations between documents`);
    const deviationAnalysis = await detectDeviations(
      approvedExtractionResult.sections,
      awExtractionResult.sections
    );
    
    // Calculate summary statistics
    const summary = {
      totalCritical: deviationAnalysis.deviations.filter(d => d.severity === 'critical').length,
      totalMajor: deviationAnalysis.deviations.filter(d => d.severity === 'major').length,
      totalMinor: deviationAnalysis.deviations.filter(d => d.severity === 'minor').length
    };
    
    const executionTimeMs = Date.now() - startTime;
    
    const result = {
      workflowId,
      workflowType: 'review_aw',
      deviations: deviationAnalysis.deviations,
      summary,
      executionTimeMs,
      executedDate: new Date().toISOString(),
      inputDocuments: [
        {
          id: awDraftId,
          name: awDraft.name,
          type: awDraft.type
        },
        {
          id: approvedPilId,
          name: approvedPil.name,
          type: approvedPil.type
        }
      ],
      extractionResults: [
        {
          documentId: awDraftId,
          provider: awExtractionResult.provider,
          sections: awExtractionResult.sections,
          pageImages: awExtractionResult.pageImages,
          processingTimeMs: awExtractionResult.processingTimeMs
        },
        {
          documentId: approvedPilId,
          provider: approvedExtractionResult.provider,
          sections: approvedExtractionResult.sections,
          pageImages: approvedExtractionResult.pageImages,
          processingTimeMs: approvedExtractionResult.processingTimeMs
        }
      ]
    };
    
    // Store workflow execution
    workflowExecutions.set(workflowId, result);
    
    console.log(`[ReviewAW] Workflow ${workflowId} completed`, {
      executionTimeMs,
      totalDeviations: deviationAnalysis.deviations.length,
      criticalCount: summary.totalCritical,
      majorCount: summary.totalMajor,
      minorCount: summary.totalMinor
    });
    
    return result;
    
  } catch (error) {
    console.error(`[ReviewAW] Workflow ${workflowId} failed`, {
      error: error.message,
      stack: error.stack,
      awDraftId,
      approvedPilId
    });
    
    throw error;
  }
}

/**
 * Get workflow execution result by ID
 * @param {string} workflowId - Workflow execution UUID
 * @returns {Object|null} Workflow result or null if not found
 */
export function getWorkflowResult(workflowId) {
  return workflowExecutions.get(workflowId) || null;
}

/**
 * Get all workflow executions for a session
 * @param {string} sessionId - Session identifier
 * @returns {Array<Object>} Array of workflow results
 */
export function getSessionWorkflows(sessionId) {
  const results = [];
  
  for (const [workflowId, result] of workflowExecutions.entries()) {
    // Note: sessionId not stored in result, would need to track separately
    // For MVP, return all workflows
    results.push(result);
  }
  
  return results.sort((a, b) => 
    new Date(b.executedDate).getTime() - new Date(a.executedDate).getTime()
  );
}

/**
 * Clear all workflow executions (for testing)
 */
export function clearWorkflowExecutions() {
  workflowExecutions.clear();
}