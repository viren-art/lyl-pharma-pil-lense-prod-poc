import { Router } from 'express';
import { validateSession } from '../middleware/sessionManager.js';

const router = Router();

/**
 * GET /api/health
 * Health check endpoint
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/health/session
 * Check session health
 */
router.get('/session', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'];
    
    if (!sessionId) {
      return res.status(400).json({
        error: {
          code: 'MISSING_SESSION',
          message: 'Session ID is required',
          retryable: false
        }
      });
    }
    
    const isValid = validateSession(sessionId);
    
    res.json({
      status: isValid ? 'active' : 'invalid',
      sessionId,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Session health check failed', {
      error: error.message
    });
    
    res.status(500).json({
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Failed to check session health',
        retryable: true
      }
    });
  }
});

export default router;