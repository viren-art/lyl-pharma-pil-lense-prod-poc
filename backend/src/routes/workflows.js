import { Router } from 'express';
import { executeReviewAW, getWorkflowResult } from '../workflows/reviewAW.js';

const router = Router();

/**
 * POST /api/workflows/review-aw
 * Execute Review AW workflow
 */
router.post('/review-aw', async (req, res) => {
  try {
    const { awDraftId, approvedPilId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    // Validate required fields
    if (!awDraftId || !approvedPilId) {
      return res.status(400).json({
        error: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: 'Missing required documents',
          fields: {
            awDraftId: !awDraftId ? 'AW Draft document ID is required' : undefined,
            approvedPilId: !approvedPilId ? 'Approved PIL document ID is required' : undefined
          },
          retryable: false
        }
      });
    }
    
    const result = await executeReviewAW(awDraftId, approvedPilId, sessionId);
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('[WorkflowsAPI] Review AW workflow failed', {
      error: error.message,
      stack: error.stack
    });
    
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
 * Get workflow execution result
 */
router.get('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    
    const result = getWorkflowResult(id);
    
    if (!result) {
      return res.status(404).json({
        error: {
          code: 'WORKFLOW_NOT_FOUND',
          message: `Workflow ${id} not found`,
          retryable: false
        }
      });
    }
    
    res.status(200).json(result);
    
  } catch (error) {
    console.error('[WorkflowsAPI] Get workflow result failed', {
      error: error.message,
      workflowId: req.params.id
    });
    
    res.status(500).json({
      error: {
        code: 'WORKFLOW_RETRIEVAL_FAILED',
        message: error.message,
        retryable: false
      }
    });
  }
});

export default router;