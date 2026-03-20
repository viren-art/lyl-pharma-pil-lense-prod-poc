/**
 * Document Manager Service
 * In-memory document storage and retrieval
 */

const documents = new Map();

/**
 * Store a document in memory
 * @param {Object} document - Document object with id, name, type, fileBlob, etc.
 * @returns {Object} Stored document
 */
export function storeDocument(document) {
  if (!document.id) {
    throw new Error('Document must have an id');
  }
  
  documents.set(document.id, document);
  return document;
}

/**
 * Get document by ID
 * @param {string} documentId - Document UUID
 * @returns {Object|null} Document object or null if not found
 */
export function getDocumentById(documentId) {
  return documents.get(documentId) || null;
}

/**
 * Get all documents
 * @returns {Array<Object>} Array of all documents
 */
export function getAllDocuments() {
  return Array.from(documents.values());
}

/**
 * Delete document by ID
 * @param {string} documentId - Document UUID
 * @returns {boolean} True if deleted, false if not found
 */
export function deleteDocument(documentId) {
  return documents.delete(documentId);
}

/**
 * Clear all documents (for testing)
 */
export function clearAllDocuments() {
  documents.clear();
}

/**
 * Get documents by type
 * @param {string} type - Document type
 * @returns {Array<Object>} Array of documents matching type
 */
export function getDocumentsByType(type) {
  return Array.from(documents.values()).filter(doc => doc.type === type);
}

/**
 * Get document count
 * @returns {number} Total number of documents in memory
 */
export function getDocumentCount() {
  return documents.size;
}