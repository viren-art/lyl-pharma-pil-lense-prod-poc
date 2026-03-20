/**
 * Session Manager Middleware
 * Handles session creation, validation, and tracking
 */

const sessions = new Map();

/**
 * Create or retrieve a session
 * @param {string} sessionId - Session identifier
 * @returns {Object} Session object
 */
export function getOrCreateSession(sessionId) {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      workflows: [],
      documents: []
    });
  }
  
  const session = sessions.get(sessionId);
  session.lastActivity = new Date().toISOString();
  return session;
}

/**
 * Get session by ID
 * @param {string} sessionId - Session identifier
 * @returns {Object|null} Session object or null if not found
 */
export function getSession(sessionId) {
  return sessions.get(sessionId) || null;
}

/**
 * Add workflow to session
 * @param {string} sessionId - Session identifier
 * @param {string} workflowId - Workflow ID
 */
export function addWorkflowToSession(sessionId, workflowId) {
  const session = getOrCreateSession(sessionId);
  if (!session.workflows.includes(workflowId)) {
    session.workflows.push(workflowId);
  }
}

/**
 * Add document to session
 * @param {string} sessionId - Session identifier
 * @param {string} documentId - Document ID
 */
export function addDocumentToSession(sessionId, documentId) {
  const session = getOrCreateSession(sessionId);
  if (!session.documents.includes(documentId)) {
    session.documents.push(documentId);
  }
}

/**
 * Clear all sessions (for testing)
 */
export function clearSessions() {
  sessions.clear();
}

/**
 * Get all sessions
 * @returns {Array<Object>} Array of all sessions
 */
export function getAllSessions() {
  return Array.from(sessions.values());
}

/**
 * Session middleware for Express
 * Ensures session exists and is tracked
 */
export function sessionMiddleware(req, res, next) {
  const sessionId = req.headers['x-session-id'] || `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Create or retrieve session
  const session = getOrCreateSession(sessionId);
  
  // Attach to request
  req.sessionId = sessionId;
  req.session = session;
  
  // Set session ID in response headers
  res.setHeader('x-session-id', sessionId);
  
  next();
}