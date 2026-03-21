import { Router } from 'express';
import { executeReviewAW, getWorkflowResult } from '../workflows/reviewAW.js';
import { executeCreateDraftWorkflow } from '../workflows/createDraft.js';
import { executeAssessVariation } from '../workflows/assessVariation.js';
import { executeGenerateAW } from '../workflows/generateAW.js';

const router = Router();

/**
 * POST /api/workflows/review-aw
 * Execute Review AW workflow
 */
router.post('/review-aw', async (req, res) => {
  try {
    const { awDraftId, approvedPilId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

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
    console.error('[WorkflowsAPI] Review AW failed', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: error.message.includes('timeout') }
    });
  }
});

/**
 * POST /api/workflows/create-draft
 * Execute Create PIL Draft workflow
 */
router.post('/create-draft', async (req, res) => {
  try {
    const { innovatorPilId, regulatorySourceId, marketFormatId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!innovatorPilId || !regulatorySourceId || !marketFormatId) {
      return res.status(400).json({
        error: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: 'Missing required documents',
          fields: {
            innovatorPilId: !innovatorPilId ? 'Innovator PIL document ID is required' : undefined,
            regulatorySourceId: !regulatorySourceId ? 'Regulatory Source document ID is required' : undefined,
            marketFormatId: !marketFormatId ? 'Local Market PIL Format document ID is required' : undefined
          },
          retryable: false
        }
      });
    }

    const result = await executeCreateDraftWorkflow(innovatorPilId, regulatorySourceId, marketFormatId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Create Draft failed', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: error.message.includes('timeout') }
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

    if (!approvedPilId || !changeTriggerDocumentId) {
      return res.status(400).json({
        error: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: 'Missing required documents',
          fields: {
            approvedPilId: !approvedPilId ? 'Approved PIL document ID is required' : undefined,
            changeTriggerDocumentId: !changeTriggerDocumentId ? 'Change Trigger document ID is required' : undefined
          },
          retryable: false
        }
      });
    }

    const result = await executeAssessVariation(approvedPilId, changeTriggerDocumentId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Assess Variation failed', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: error.message.includes('timeout') }
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

    if (!approvedPilId || !market) {
      return res.status(400).json({
        error: {
          code: 'WORKFLOW_VALIDATION_FAILED',
          message: 'Missing required inputs',
          fields: {
            approvedPilId: !approvedPilId ? 'Approved PIL document ID is required' : undefined,
            market: !market ? 'Target market is required' : undefined
          },
          retryable: false
        }
      });
    }

    const result = await executeGenerateAW(approvedPilId, market, diecutSpecificationId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Generate AW failed', { error: error.message });
    const statusCode = error.message.includes('not found') ? 404 : 500;
    res.status(statusCode).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: error.message.includes('timeout') }
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
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${id} not found`, retryable: false }
      });
    }

    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Get result failed', { error: error.message });
    res.status(500).json({
      error: { code: 'WORKFLOW_RETRIEVAL_FAILED', message: error.message, retryable: false }
    });
  }
});

export default router;
