import { Router } from 'express';
import { getSessionStats, clearSession } from '../middleware/sessionManager.js';

const router = Router();

/**
 * Get current session statistics
 * GET /api/session/stats
 */
router.get('/stats', (req, res) => {
  try {
    const stats = getSessionStats(req.session);
    res.json(stats);
  } catch (error) {
    console.error('[Session] Error getting stats:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_STATS_FAILED',
        message: 'Failed to retrieve session statistics',
        retryable: false,
      },
    });
  }
});

/**
 * Clear all session data
 * DELETE /api/session/clear
 */
router.delete('/clear', (req, res) => {
  try {
    clearSession(req.session);
    res.json({
      success: true,
      message: 'Session data cleared',
      sessionId: req.session.id,
    });
  } catch (error) {
    console.error('[Session] Error clearing session:', error);
    res.status(500).json({
      error: {
        code: 'SESSION_CLEAR_FAILED',
        message: 'Failed to clear session data',
        retryable: true,
      },
    });
  }
});

export default router;