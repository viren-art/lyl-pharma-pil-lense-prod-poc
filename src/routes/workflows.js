import { Router } from 'express';
import { executeCreateDraftWorkflow } from '../workflows/createDraft.js';
import { executeAssessVariation } from '../workflows/assessVariation.js';
import { executeReviewAW } from '../workflows/reviewAW.js';
import { executeGenerateAW } from '../workflows/generateAW.js';
import { exportWorkflowResultAsPdf } from '../services/pdfExporter.js';
import { validateSession } from '../middleware/sessionManager.js';

const router = Router();

// In-memory storage for workflow results (all workflow types)
const workflowResults = new Map();

/**
 * POST /api/workflows/create-draft
 * Execute Create PIL Draft workflow
 */
router.post('/create-draft', async (req, res) => {
  try {
    const { innovatorPilId, regulatorySourceId, localMarketFormatId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    // Validate session
    if (!validateSession(sessionId)) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session not found or expired',
          retryable: false
        }
      });
    }
    
    // Validate required inputs
    if (!innovatorPilId || !regulatorySourceId || !localMarketFormatId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing required document IDs',
          retryable: false
        }
      });
    }
    
    const result = await executeCreateDraftWorkflow(
      innovatorPilId,
      regulatorySourceId,
      localMarketFormatId,
      sessionId
    );
    
    // Store result
    workflowResults.set(result.workflowId, result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Create draft workflow error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const retryable = error.message.includes('timeout') || 
                     error.message.includes('API');
    
    res.status(statusCode).json({
      error: {
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: error.message,
        retryable
      }
    });
  }
});

/**
 * POST /api/workflows/assess-variation
 * Execute Assess Variation workflow
 */
router.post('/assess-variation', async (req, res) => {
  try {
    const { approvedPilId, changeTriggerDocumentId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    if (!validateSession(sessionId)) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session not found or expired',
          retryable: false
        }
      });
    }
    
    if (!approvedPilId || !changeTriggerDocumentId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing required document IDs',
          retryable: false
        }
      });
    }
    
    const result = await executeAssessVariation(approvedPilId, changeTriggerDocumentId, sessionId);
    
    // Store result
    workflowResults.set(result.workflowId, result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Assess variation workflow error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const retryable = error.message.includes('timeout') || error.message.includes('API');
    
    res.status(statusCode).json({
      error: {
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: error.message,
        retryable
      }
    });
  }
});

/**
 * POST /api/workflows/review-aw
 * Execute Review AW workflow
 */
router.post('/review-aw', async (req, res) => {
  try {
    const { awDraftId, approvedPilId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    if (!validateSession(sessionId)) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session not found or expired',
          retryable: false
        }
      });
    }
    
    if (!awDraftId || !approvedPilId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing required document IDs',
          retryable: false
        }
      });
    }
    
    const result = await executeReviewAW(awDraftId, approvedPilId, sessionId);
    
    // Store result
    workflowResults.set(result.workflowId, result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Review AW workflow error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const retryable = error.message.includes('timeout') || error.message.includes('failed');
    
    res.status(statusCode).json({
      error: {
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: error.message,
        retryable
      }
    });
  }
});

/**
 * POST /api/workflows/generate-aw
 * Execute Generate AW Draft workflow
 */
router.post('/generate-aw', async (req, res) => {
  try {
    const { approvedPilId, market, diecutSpecificationId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    if (!validateSession(sessionId)) {
      return res.status(401).json({
        error: {
          code: 'INVALID_SESSION',
          message: 'Session not found or expired',
          retryable: false
        }
      });
    }
    
    if (!approvedPilId || !market) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Missing required fields (approvedPilId, market)',
          retryable: false
        }
      });
    }
    
    const result = await executeGenerateAW(approvedPilId, market, diecutSpecificationId, sessionId);
    
    // Store result
    workflowResults.set(result.workflowId, result);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Generate AW workflow error:', error);
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const retryable = error.message.includes('timeout') || error.message.includes('failed');
    
    res.status(statusCode).json({
      error: {
        code: 'WORKFLOW_EXECUTION_FAILED',
        message: error.message,
        retryable
      }
    });
  }
});

/**
 * GET /api/workflows/:id/result
 * Get workflow execution result by ID
 */
router.get('/:id/result', (req, res) => {
  try {
    const { id } = req.params;
    
    const result = workflowResults.get(id);
    
    if (!result) {
      return res.status(404).json({
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow result not found for ID: ${id}`,
          retryable: false
        }
      });
    }
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Get workflow result error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        retryable: false
      }
    });
  }
});

/**
 * GET /api/workflows/:id/export
 * Export workflow result as PDF report
 */
router.get('/:id/export', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = workflowResults.get(id);
    
    if (!result) {
      return res.status(404).json({
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow result not found for ID: ${id}`,
          retryable: false
        }
      });
    }
    
    // Generate PDF report
    const pdfBuffer = await exportWorkflowResultAsPdf(result);
    
    // Set response headers for PDF download
    const filename = `workflow-${result.workflowType}-${Date.now()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    res.send(pdfBuffer);
  } catch (error) {
    console.error('Export workflow result error:', error);
    res.status(500).json({
      error: {
        code: 'EXPORT_FAILED',
        message: error.message,
        retryable: true
      }
    });
  }
});

/**
 * GET /api/workflows
 * Get all workflow results for current session
 */
router.get('/', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    const sessionResults = [];
    for (const [id, result] of workflowResults.entries()) {
      // Filter by session if session tracking is implemented
      sessionResults.push({
        workflowId: id,
        workflowType: result.workflowType,
        executedDate: result.executedDate,
        executionTimeMs: result.executionTimeMs
      });
    }
    
    res.status(200).json({
      workflows: sessionResults,
      total: sessionResults.length
    });
  } catch (error) {
    console.error('List workflows error:', error);
    res.status(500).json({
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message,
        retryable: false
      }
    });
  }
});

export default router;