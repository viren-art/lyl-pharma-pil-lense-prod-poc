/**
 * Session Manager Middleware
 * Handles session creation and validation
 */

/**
 * Create or retrieve session
 * @param {string} sessionId - Optional session ID
 * @returns {Object} Session object with ID and metadata
 */
export function createSession(sessionId) {
  return {
    id: sessionId || generateSessionId(),
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };
}

/**
 * Validate session exists and is active
 * @param {string} sessionId - Session ID to validate
 * @returns {boolean} True if session is valid
 */
export function validateSession(sessionId) {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }
  return sessionId.length > 0;
}

/**
 * Generate unique session ID
 * @returns {string} Generated session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Session middleware for Express
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (!sessionId) {
    return res.status(400).json({
      error: {
        code: 'MISSING_SESSION_ID',
        message: 'Session ID is required in x-session-id header or sessionId query parameter',
        retryable: false
      }
    });
  }
  
  if (!validateSession(sessionId)) {
    return res.status(400).json({
      error: {
        code: 'INVALID_SESSION_ID',
        message: 'Session ID is invalid',
        retryable: false
      }
    });
  }
  
  req.sessionId = sessionId;
  next();
}