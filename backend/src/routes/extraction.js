import { Router } from 'express';
import { extractDocument, getExtractionProvider, getConfidenceThresholds } from '../services/extractionRouter.js';

const router = Router();

/**
 * POST /api/extraction/extract
 * Extract content from uploaded document
 */
router.post('/extract', async (req, res) => {
  try {
    const { documentId } = req.body;
    const sessionId = req.headers['x-session-id'] || 'default-session';
    
    if (!documentId) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Document ID is required',
          retryable: false
        }
      });
    }
    
    console.info('Starting extraction', { documentId, sessionId });
    
    const result = await extractDocument(documentId, sessionId);
    
    res.json({
      extractionId: result.documentId,
      provider: result.provider,
      fallbackUsed: result.fallbackUsed,
      sections: result.sections,
      pageImages: result.pageImages,
      processingTimeMs: result.processingTimeMs,
      processedDate: result.processedDate
    });
    
  } catch (error) {
    console.error('Extraction failed', {
      error: error.message,
      stack: error.stack
    });
    
    const statusCode = error.message.includes('not found') ? 404 : 500;
    const retryable = error.message.includes('timeout') || error.message.includes('failed');
    
    res.status(statusCode).json({
      error: {
        code: 'EXTRACTION_FAILED',
        message: error.message,
        retryable
      }
    });
  }
});

/**
 * GET /api/extraction/config
 * Get extraction configuration
 */
router.get('/config', (req, res) => {
  try {
    const provider = getExtractionProvider();
    const thresholds = getConfidenceThresholds();
    
    res.json({
      provider,
      thresholds
    });
    
  } catch (error) {
    console.error('Failed to get extraction config', {
      error: error.message
    });
    
    res.status(500).json({
      error: {
        code: 'CONFIG_ERROR',
        message: 'Failed to retrieve extraction configuration',
        retryable: false
      }
    });
  }
});

export default router;