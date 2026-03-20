import { randomUUID } from 'crypto';

/**
 * In-Memory Session Manager for PIL Lens
 * 
 * Manages document storage and workflow state per browser session.
 * Enforces 100-document limit and automatic cleanup on disconnect.
 * 
 * Architecture Decision: ADR-001 (In-Memory Storage with No Database)
 * NFR Constraints: NFR-005 (session-only persistence), NFR-010 (100 doc limit)
 */

// In-memory session store
const sessions = new Map();

// Session configuration
const SESSION_CONFIG = {
  MAX_DOCUMENTS: parseInt(process.env.MAX_DOCUMENTS_PER_SESSION || '100', 10),
  CLEANUP_INTERVAL_MS: 60000, // 1 minute
  SESSION_TIMEOUT_MS: 3600000, // 1 hour of inactivity
};

/**
 * Session data structure
 * @typedef {Object} Session
 * @property {string} id - Unique session identifier
 * @property {Map<string, Document>} documents - Uploaded documents
 * @property {Map<string, WorkflowResult>} workflowResults - Workflow execution results
 * @property {number} lastActivity - Timestamp of last activity
 * @property {Date} createdAt - Session creation timestamp
 */

/**
 * Create new session
 * @returns {Session}
 */
function createSession() {
  return {
    id: randomUUID(),
    documents: new Map(),
    workflowResults: new Map(),
    lastActivity: Date.now(),
    createdAt: new Date(),
  };
}

/**
 * Get or create session
 * @param {string} sessionId - Session identifier from cookie/header
 * @returns {Session}
 */
function getOrCreateSession(sessionId) {
  if (!sessionId || !sessions.has(sessionId)) {
    const newSession = createSession();
    sessions.set(newSession.id, newSession);
    return newSession;
  }

  const session = sessions.get(sessionId);
  session.lastActivity = Date.now();
  return session;
}

/**
 * Update session activity timestamp
 * @param {string} sessionId
 */
function touchSession(sessionId) {
  if (sessions.has(sessionId)) {
    sessions.get(sessionId).lastActivity = Date.now();
  }
}

/**
 * Delete session and clear all data
 * @param {string} sessionId
 */
function deleteSession(sessionId) {
  if (sessions.has(sessionId)) {
    const session = sessions.get(sessionId);
    
    // Clear document blobs from memory
    session.documents.clear();
    session.workflowResults.clear();
    
    sessions.delete(sessionId);
    
    console.log(`[SessionManager] Session ${sessionId} deleted. Active sessions: ${sessions.size}`);
  }
}

/**
 * Cleanup inactive sessions
 * Runs periodically to remove sessions exceeding timeout threshold
 */
function cleanupInactiveSessions() {
  const now = Date.now();
  const timeoutThreshold = now - SESSION_CONFIG.SESSION_TIMEOUT_MS;
  
  let cleanedCount = 0;
  
  for (const [sessionId, session] of sessions.entries()) {
    if (session.lastActivity < timeoutThreshold) {
      deleteSession(sessionId);
      cleanedCount++;
    }
  }
  
  if (cleanedCount > 0) {
    console.log(`[SessionManager] Cleaned ${cleanedCount} inactive sessions. Active: ${sessions.size}`);
  }
}

// Start periodic cleanup
setInterval(cleanupInactiveSessions, SESSION_CONFIG.CLEANUP_INTERVAL_MS);

/**
 * Express middleware for session management
 * Attaches session object to req.session
 */
export function sessionMiddleware(req, res, next) {
  // Extract session ID from cookie or create new
  const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];
  
  // Get or create session
  const session = getOrCreateSession(sessionId);
  
  // Attach session to request
  req.session = session;
  
  // Set session cookie if new session
  if (!sessionId || sessionId !== session.id) {
    res.cookie('sessionId', session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: SESSION_CONFIG.SESSION_TIMEOUT_MS,
    });
  }
  
  // Touch session activity
  touchSession(session.id);
  
  next();
}

/**
 * Check if session has reached document limit
 * @param {Session} session
 * @returns {boolean}
 */
export function isSessionAtDocumentLimit(session) {
  return session.documents.size >= SESSION_CONFIG.MAX_DOCUMENTS;
}

/**
 * Get session statistics
 * @param {Session} session
 * @returns {Object}
 */
export function getSessionStats(session) {
  return {
    sessionId: session.id,
    documentCount: session.documents.size,
    workflowCount: session.workflowResults.size,
    maxDocuments: SESSION_CONFIG.MAX_DOCUMENTS,
    documentsRemaining: SESSION_CONFIG.MAX_DOCUMENTS - session.documents.size,
    createdAt: session.createdAt,
    lastActivity: new Date(session.lastActivity),
  };
}

/**
 * Add document to session
 * @param {Session} session
 * @param {string} documentId
 * @param {Object} document
 * @throws {Error} if session at document limit
 */
export function addDocument(session, documentId, document) {
  if (isSessionAtDocumentLimit(session)) {
    throw new Error(`Session document limit reached (${SESSION_CONFIG.MAX_DOCUMENTS} documents)`);
  }
  
  session.documents.set(documentId, document);
  touchSession(session.id);
}

/**
 * Get document from session
 * @param {Session} session
 * @param {string} documentId
 * @returns {Object|null}
 */
export function getDocument(session, documentId) {
  return session.documents.get(documentId) || null;
}

/**
 * Delete document from session
 * @param {Session} session
 * @param {string} documentId
 * @returns {boolean} true if deleted
 */
export function removeDocument(session, documentId) {
  const deleted = session.documents.delete(documentId);
  if (deleted) {
    touchSession(session.id);
  }
  return deleted;
}

/**
 * Get all documents in session
 * @param {Session} session
 * @returns {Array<Object>}
 */
export function getAllDocuments(session) {
  return Array.from(session.documents.values());
}

/**
 * Add workflow result to session
 * @param {Session} session
 * @param {string} workflowId
 * @param {Object} result
 */
export function addWorkflowResult(session, workflowId, result) {
  session.workflowResults.set(workflowId, result);
  touchSession(session.id);
}

/**
 * Get workflow result from session
 * @param {Session} session
 * @param {string} workflowId
 * @returns {Object|null}
 */
export function getWorkflowResult(session, workflowId) {
  return session.workflowResults.get(workflowId) || null;
}

/**
 * Get all workflow results in session
 * @param {Session} session
 * @returns {Array<Object>}
 */
export function getAllWorkflowResults(session) {
  return Array.from(session.workflowResults.values());
}

/**
 * Clear all session data (for manual cleanup)
 * @param {Session} session
 */
export function clearSession(session) {
  session.documents.clear();
  session.workflowResults.clear();
  touchSession(session.id);
}

/**
 * Get global session statistics
 * @returns {Object}
 */
export function getGlobalStats() {
  let totalDocuments = 0;
  let totalWorkflows = 0;
  
  for (const session of sessions.values()) {
    totalDocuments += session.documents.size;
    totalWorkflows += session.workflowResults.size;
  }
  
  return {
    activeSessions: sessions.size,
    totalDocuments,
    totalWorkflows,
    maxDocumentsPerSession: SESSION_CONFIG.MAX_DOCUMENTS,
    sessionTimeoutMs: SESSION_CONFIG.SESSION_TIMEOUT_MS,
  };
}

// Export session manager functions
export default {
  sessionMiddleware,
  isSessionAtDocumentLimit,
  getSessionStats,
  addDocument,
  getDocument,
  removeDocument,
  getAllDocuments,
  addWorkflowResult,
  getWorkflowResult,
  getAllWorkflowResults,
  clearSession,
  getGlobalStats,
  deleteSession,
};