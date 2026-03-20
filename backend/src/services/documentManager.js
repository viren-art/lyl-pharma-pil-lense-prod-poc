/**
 * Document Manager Service
 * In-memory document storage and retrieval
 */

// In-memory document store (session-scoped)
const documentStore = new Map();

// Session document tracking
const sessionDocuments = new Map();

// Maximum documents per session
const MAX_DOCUMENTS_PER_SESSION = 100;

/**
 * Store document in memory
 * @param {Object} document - Document object with id, name, type, fileBlob, etc.
 * @param {string} sessionId - Session identifier
 * @returns {Object} Stored document
 */
export function storeDocument(document, sessionId) {
  if (!document.id) {
    throw new Error('Document must have an id');
  }
  
  // Track session document count
  if (!sessionDocuments.has(sessionId)) {
    sessionDocuments.set(sessionId, new Set());
  }
  
  const sessionDocs = sessionDocuments.get(sessionId);
  
  // Enforce session limit
  if (!sessionDocs.has(document.id) && sessionDocs.size >= MAX_DOCUMENTS_PER_SESSION) {
    throw new Error(`Session document limit exceeded: ${MAX_DOCUMENTS_PER_SESSION} documents maximum`);
  }
  
  // Store document
  documentStore.set(document.id, {
    ...document,
    sessionId,
    storedAt: new Date().toISOString()
  });
  
  sessionDocs.add(document.id);
  
  console.log(`[DocumentManager] Document stored`, {
    documentId: document.id,
    sessionId,
    type: document.type,
    sessionDocCount: sessionDocs.size
  });
  
  return documentStore.get(document.id);
}

/**
 * Retrieve document by ID
 * @param {string} documentId - Document UUID
 * @returns {Object|null} Document object or null if not found
 */
export function getDocumentById(documentId) {
  if (!documentId) {
    return null;
  }
  
  const document = documentStore.get(documentId);
  
  if (!document) {
    console.warn(`[DocumentManager] Document not found: ${documentId}`);
    return null;
  }
  
  return document;
}

/**
 * Get all documents for a session
 * @param {string} sessionId - Session identifier
 * @returns {Array} Array of documents
 */
export function getSessionDocuments(sessionId) {
  if (!sessionDocuments.has(sessionId)) {
    return [];
  }
  
  const sessionDocs = sessionDocuments.get(sessionId);
  const documents = [];
  
  for (const docId of sessionDocs) {
    const doc = documentStore.get(docId);
    if (doc) {
      documents.push(doc);
    }
  }
  
  return documents;
}

/**
 * Delete document from memory
 * @param {string} documentId - Document UUID
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteDocument(documentId, sessionId) {
  const document = documentStore.get(documentId);
  
  if (!document) {
    return false;
  }
  
  // Verify session ownership
  if (document.sessionId !== sessionId) {
    throw new Error('Document does not belong to this session');
  }
  
  // Remove from session tracking
  if (sessionDocuments.has(sessionId)) {
    sessionDocuments.get(sessionId).delete(documentId);
  }
  
  // Remove from store
  documentStore.delete(documentId);
  
  console.log(`[DocumentManager] Document deleted`, {
    documentId,
    sessionId
  });
  
  return true;
}

/**
 * Clear all documents for a session
 * @param {string} sessionId - Session identifier
 * @returns {number} Number of documents cleared
 */
export function clearSession(sessionId) {
  if (!sessionDocuments.has(sessionId)) {
    return 0;
  }
  
  const sessionDocs = sessionDocuments.get(sessionId);
  let clearedCount = 0;
  
  for (const docId of sessionDocs) {
    if (documentStore.delete(docId)) {
      clearedCount++;
    }
  }
  
  sessionDocuments.delete(sessionId);
  
  console.log(`[DocumentManager] Session cleared`, {
    sessionId,
    documentsCleared: clearedCount
  });
  
  return clearedCount;
}

/**
 * Get document count for session
 * @param {string} sessionId - Session identifier
 * @returns {number} Number of documents in session
 */
export function getSessionDocumentCount(sessionId) {
  if (!sessionDocuments.has(sessionId)) {
    return 0;
  }
  
  return sessionDocuments.get(sessionId).size;
}

/**
 * Check if session has reached document limit
 * @param {string} sessionId - Session identifier
 * @returns {boolean} True if at limit
 */
export function isSessionAtLimit(sessionId) {
  return getSessionDocumentCount(sessionId) >= MAX_DOCUMENTS_PER_SESSION;
}