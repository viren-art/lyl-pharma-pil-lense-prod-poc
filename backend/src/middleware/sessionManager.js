/**
 * Session Manager Middleware
 * Manages user sessions and validates session tokens
 */

const activeSessions = new Map();

/**
 * Create a new session
 * @param {string} sessionId - Unique session identifier
 * @returns {Object} Session object
 */
export function createSession(sessionId) {
  const session = {
    id: sessionId,
    createdAt: new Date(),
    lastActivity: new Date(),
    documentCount: 0
  };
  activeSessions.set(sessionId, session);
  return session;
}

/**
 * Validate if a session exists and is active
 * @param {string} sessionId - Session identifier to validate
 * @returns {boolean} True if session is valid and active
 */
export function validateSession(sessionId) {
  if (!sessionId) {
    return false;
  }
  
  const session = activeSessions.get(sessionId);
  if (!session) {
    return false;
  }
  
  // Check if session has expired (24 hour timeout)
  const now = new Date();
  const sessionAge = now - session.lastActivity;
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  if (sessionAge > maxAge) {
    activeSessions.delete(sessionId);
    return false;
  }
  
  // Update last activity
  session.lastActivity = now;
  return true;
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session object or null if not found
 */
export function getSession(sessionId) {
  return activeSessions.get(sessionId) || null;
}

/**
 * Update session document count
 * @param {string} sessionId - Session identifier
 * @param {number} count - New document count
 */
export function updateSessionDocumentCount(sessionId, count) {
  const session = activeSessions.get(sessionId);
  if (session) {
    session.documentCount = count;
    session.lastActivity = new Date();
  }
}

/**
 * Destroy a session
 * @param {string} sessionId - Session identifier
 */
export function destroySession(sessionId) {
  activeSessions.delete(sessionId);
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions() {
  const now = new Date();
  const maxAge = 24 * 60 * 60 * 1000; // 24 hours
  
  for (const [sessionId, session] of activeSessions.entries()) {
    const sessionAge = now - session.lastActivity;
    if (sessionAge > maxAge) {
      activeSessions.delete(sessionId);
    }
  }
}

/**
 * Express middleware for session validation
 */
export function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  
  if (!sessionId) {
    return res.status(401).json({
      error: {
        code: 'MISSING_SESSION',
        message: 'Session ID is required',
        retryable: false
      }
    });
  }
  
  if (!validateSession(sessionId)) {
    return res.status(401).json({
      error: {
        code: 'INVALID_SESSION',
        message: 'Session not found or expired',
        retryable: false
      }
    });
  }
  
  req.sessionId = sessionId;
  next();
}