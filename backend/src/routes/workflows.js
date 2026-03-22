import { Router } from 'express';

const router = Router();

/**
 * POST /api/workflows/review-aw
 */
router.post('/review-aw', async (req, res) => {
  try {
    const { awDraftId, approvedPilId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!awDraftId || !approvedPilId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'awDraftId and approvedPilId are required', retryable: false }
      });
    }

    const { executeReviewAW } = await import('../workflows/reviewAW.js');
    const result = await executeReviewAW(awDraftId, approvedPilId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Review AW failed:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: false }
    });
  }
});

/**
 * POST /api/workflows/create-draft
 */
router.post('/create-draft', async (req, res) => {
  try {
    const { innovatorPilId, regulatorySourceId, marketFormatId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!innovatorPilId || !regulatorySourceId || !marketFormatId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'innovatorPilId, regulatorySourceId, and marketFormatId are required', retryable: false }
      });
    }

    const { executeCreateDraftWorkflow } = await import('../workflows/createDraft.js');
    const result = await executeCreateDraftWorkflow(innovatorPilId, regulatorySourceId, marketFormatId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Create Draft failed:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: false }
    });
  }
});

/**
 * POST /api/workflows/assess-variation
 */
router.post('/assess-variation', async (req, res) => {
  try {
    const { approvedPilId, changeTriggerDocumentId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!approvedPilId || !changeTriggerDocumentId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'approvedPilId and changeTriggerDocumentId are required', retryable: false }
      });
    }

    const { executeAssessVariation } = await import('../workflows/assessVariation.js');
    const result = await executeAssessVariation(approvedPilId, changeTriggerDocumentId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Assess Variation failed:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: false }
    });
  }
});

/**
 * POST /api/workflows/generate-aw
 */
router.post('/generate-aw', async (req, res) => {
  try {
    const { approvedPilId, market, diecutSpecificationId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!approvedPilId || !market) {
      return res.status(400).json({
        error: { code: 'VALIDATION_FAILED', message: 'approvedPilId and market are required', retryable: false }
      });
    }

    const { executeGenerateAW } = await import('../workflows/generateAW.js');
    const result = await executeGenerateAW(approvedPilId, market, diecutSpecificationId, sessionId);
    res.status(200).json(result);

  } catch (error) {
    console.error('[WorkflowsAPI] Generate AW failed:', error.message);
    res.status(error.message.includes('not found') ? 404 : 500).json({
      error: { code: 'WORKFLOW_EXECUTION_FAILED', message: error.message, retryable: false }
    });
  }
});

/**
 * GET /api/workflows/:id/result
 */
router.get('/:id/result', async (req, res) => {
  try {
    const { id } = req.params;
    const { getWorkflowResult } = await import('../workflows/reviewAW.js');
    const result = getWorkflowResult(id);

    if (!result) {
      return res.status(404).json({
        error: { code: 'WORKFLOW_NOT_FOUND', message: `Workflow ${id} not found`, retryable: false }
      });
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('[WorkflowsAPI] Get result failed:', error.message);
    res.status(500).json({
      error: { code: 'RETRIEVAL_FAILED', message: error.message, retryable: false }
    });
  }
});

export default router;
