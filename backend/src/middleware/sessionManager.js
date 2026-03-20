import { randomUUID } from 'crypto';

const sessions = new Map();
const SESSION_TIMEOUT = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Create a new session
 */
export function createSession() {
  const sessionId = randomUUID();
  const session = {
    id: sessionId,
    createdAt: Date.now(),
    lastActivity: Date.now(),
    documents: []
  };
  sessions.set(sessionId, session);
  return sessionId;
}

/**
 * Get session by ID
 */
export function getSession(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) {
    return null;
  }
  
  // Check if session has expired
  if (Date.now() - session.lastActivity > SESSION_TIMEOUT) {
    sessions.delete(sessionId);
    return null;
  }
  
  // Update last activity
  session.lastActivity = Date.now();
  return session;
}

/**
 * Validate session exists and is active
 */
export function validateSession(sessionId) {
  return getSession(sessionId) !== null;
}

/**
 * Add document to session
 */
export function addDocumentToSession(sessionId, documentId) {
  const session = getSession(sessionId);
  if (session && !session.documents.includes(documentId)) {
    session.documents.push(documentId);
  }
  return session;
}

/**
 * Get all documents in session
 */
export function getSessionDocuments(sessionId) {
  const session = getSession(sessionId);
  return session ? session.documents : [];
}

/**
 * Cleanup expired sessions
 */
export function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      sessions.delete(sessionId);
    }
  }
}

/**
 * Clear all sessions (for testing)
 */
export function clearAllSessions() {
  sessions.clear();
}