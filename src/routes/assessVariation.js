import { Router } from 'express';
import { executeAssessVariation, validateAssessVariationInput } from '../workflows/assessVariation.js';

const router = Router();

/**
 * POST /api/assessVariation/execute
 * Execute Assess Variation workflow with 75-second SLA enforcement
 */
router.post('/execute', async (req, res) => {
  const requestStartTime = Date.now();
  
  try {
    const { approvedPilId, changeTriggerDocumentId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    // Validate input
    const validation = validateAssessVariationInput(approvedPilId, changeTriggerDocumentId);
    if (!validation.valid) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: validation.error,
          retryable: false
        }
      });
    }
    
    console.log('[Assess Variation API] Starting workflow', {
      approvedPilId,
      changeTriggerDocumentId,
      sessionId,
      timestamp: new Date().toISOString()
    });
    
    const result = await executeAssessVariation(approvedPilId, changeTriggerDocumentId, sessionId);
    
    const requestTimeMs = Date.now() - requestStartTime;
    
    // Log performance metrics
    console.log('[Assess Variation API] Workflow completed', {
      workflowId: result.workflowId,
      classification: result.classification,
      executionTimeMs: result.executionTimeMs,
      requestTimeMs,
      withinSLA: result.performance.withinSLA,
      timestamp: new Date().toISOString()
    });
    
    // Add performance warning header if SLA exceeded
    if (!result.performance.withinSLA) {
      res.setHeader('X-Performance-Warning', 'SLA-Exceeded');
      res.setHeader('X-Execution-Time-Ms', result.executionTimeMs.toString());
    }
    
    res.status(200).json(result);
    
  } catch (error) {
    const requestTimeMs = Date.now() - requestStartTime;
    
    console.error('[Assess Variation API] Workflow failed', {
      error: error.message,
      stack: error.stack,
      requestTimeMs,
      timestamp: new Date().toISOString()
    });
    
    // Determine error type and status code
    let statusCode = 500;
    let errorCode = 'WORKFLOW_EXECUTION_FAILED';
    let retryable = false;
    
    if (error.message.includes('not found')) {
      statusCode = 404;
      errorCode = 'DOCUMENT_NOT_FOUND';
      retryable = false;
    } else if (error.message.includes('timeout') || error.message.includes('exceeded')) {
      statusCode = 504;
      errorCode = 'WORKFLOW_TIMEOUT';
      retryable = true;
    } else if (error.message.includes('size') || error.message.includes('page count')) {
      statusCode = 413;
      errorCode = 'DOCUMENT_TOO_LARGE';
      retryable = false;
    } else if (error.message.includes('API') || error.message.includes('extraction')) {
      statusCode = 503;
      errorCode = 'EXTERNAL_SERVICE_UNAVAILABLE';
      retryable = true;
    }
    
    res.status(statusCode).json({
      error: {
        code: errorCode,
        message: error.message,
        retryable,
        executionTimeMs: requestTimeMs
      }
    });
  }
});

export default router;