/**
 * Session management middleware
 * Handles session creation, validation, and cleanup
 */

const sessions = new Map();

/**
 * Create or retrieve a session
 */
export function getOrCreateSession(sessionId) {
  if (!sessionId) {
    sessionId = generateSessionId();
  }
  
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      data: {}
    });
  } else {
    // Update last activity
    const session = sessions.get(sessionId);
    session.lastActivity = Date.now();
  }
  
  return sessions.get(sessionId);
}

/**
 * Get session by ID
 */
export function getSession(sessionId) {
  return sessions.get(sessionId);
}

/**
 * Validate session exists and is not expired
 */
export function validateSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return false;
  }
  
  // Check if session has expired (24 hours)
  const sessionAge = Date.now() - session.createdAt;
  const maxAge = 24 * 60 * 60 * 1000;
  
  if (sessionAge > maxAge) {
    sessions.delete(sessionId);
    return false;
  }
  
  return true;
}

/**
 * Store data in session
 */
export function setSessionData(sessionId, key, value) {
  const session = getOrCreateSession(sessionId);
  session.data[key] = value;
}

/**
 * Retrieve data from session
 */
export function getSessionData(sessionId, key) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  return session.data[key];
}

/**
 * Clear session
 */
export function clearSession(sessionId) {
  sessions.delete(sessionId);
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Cleanup expired sessions (run periodically)
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(sessionId);
    }
  }
}

/**
 * Express middleware for session handling
 */
export function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'] || req.query.sessionId;
  
  if (sessionId) {
    if (!validateSession(sessionId)) {
      return res.status(401).json({
        error: {
          code: 'SESSION_EXPIRED',
          message: 'Session has expired',
          retryable: false
        }
      });
    }
    req.sessionId = sessionId;
  } else {
    req.sessionId = generateSessionId();
  }
  
  req.session = getOrCreateSession(req.sessionId);
  
  next();
}