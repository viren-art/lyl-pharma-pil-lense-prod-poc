import { Router } from 'express';
import { executeGenerateAW, validateGenerateAWInputs } from '../workflows/generateAW.js';

const router = Router();

/**
 * POST /api/generateAW/execute
 * Execute Generate AW Draft workflow
 */
router.post('/execute', async (req, res) => {
  try {
    const { approvedPilId, market, diecutSpecificationId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    // Validate inputs
    const validation = validateGenerateAWInputs(approvedPilId, market, diecutSpecificationId);
    if (!validation.valid) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Invalid workflow inputs',
          errors: validation.errors,
          retryable: false
        }
      });
    }
    
    // Execute workflow
    const result = await executeGenerateAW(approvedPilId, market, diecutSpecificationId, sessionId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('[GenerateAW] Workflow execution failed:', error);
    
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
 * GET /api/generateAW/markets
 * Get available target markets
 */
router.get('/markets', (req, res) => {
  res.status(200).json({
    markets: [
      {
        code: 'taiwan_tfda',
        name: 'Taiwan TFDA',
        description: 'Taiwan Food and Drug Administration format'
      },
      {
        code: 'thailand_fda',
        name: 'Thailand FDA',
        description: 'Thailand Food and Drug Administration format'
      }
    ]
  });
});

export default router;