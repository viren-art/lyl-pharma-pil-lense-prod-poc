/**
 * Document Manager Service
 * In-memory document storage and retrieval with session support
 */

import { randomUUID } from 'crypto';

const documents = new Map();

const DOCUMENT_TYPES = [
  'innovator_pil',
  'approved_pil',
  'aw_draft',
  'regulatory_source',
  'updated_pil',
  'regulatory_announcement',
  'local_market_pil_format',
  'diecut_specification',
  'stamped_pil',
];

const SESSION_LIMIT = 100;

/**
 * Upload a document (used by routes)
 * @param {Object} file - Multer file object
 * @param {string} type - Document type
 * @param {string} productName - Product name
 * @param {string} sessionId - Session identifier
 * @returns {Object} Stored document metadata
 */
export function uploadDocument(file, type, productName, sessionId) {
  // Validate file type
  const allowedMimes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];
  if (!allowedMimes.includes(file.mimetype)) {
    throw new Error('Unsupported file type. Only PDF and Word (.docx) files are accepted.');
  }

  // Validate file size
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('File size exceeds 25 MB limit.');
  }

  // Check session limit
  const sessionDocs = Array.from(documents.values()).filter(d => d.sessionId === sessionId);
  if (sessionDocs.length >= SESSION_LIMIT) {
    throw new Error(`Session limit exceeded. Maximum ${SESSION_LIMIT} documents per session.`);
  }

  const id = randomUUID();
  const document = {
    id,
    name: file.originalname,
    type: type || 'other',
    productName: productName || '',
    fileSize: file.size,
    mimeType: file.mimetype,
    pageCount: null,
    uploadDate: new Date().toISOString(),
    sessionId,
    buffer: file.buffer,
  };

  documents.set(id, document);

  // Return metadata (without buffer)
  const { buffer, ...metadata } = document;
  return metadata;
}

/**
 * Get all documents for a session (used by routes)
 * @param {string} sessionId - Session identifier
 * @returns {Array<Object>} Array of document metadata
 */
export function getDocuments(sessionId) {
  return Array.from(documents.values())
    .filter(d => d.sessionId === sessionId || sessionId === 'default-session')
    .map(({ buffer, ...metadata }) => metadata);
}

/**
 * Get available document types (used by routes)
 * @returns {Array<Object>} Array of document type objects
 */
export function getDocumentTypes() {
  return DOCUMENT_TYPES.map(type => ({
    key: type,
    label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
  }));
}

/**
 * Store a document in memory
 * @param {Object} document - Document object with id, name, type, etc.
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
 * Get all documents (no session filter)
 * @returns {Array<Object>} Array of all documents
 */
export function getAllDocuments() {
  return Array.from(documents.values());
}

/**
 * Delete document by ID
 * @param {string} documentId - Document UUID
 * @param {string} sessionId - Session identifier (optional, for authorization check)
 * @returns {Object} Deletion result
 */
export function deleteDocument(documentId, sessionId) {
  const doc = documents.get(documentId);
  if (!doc) {
    throw new Error('Document not found');
  }
  if (sessionId && doc.sessionId && doc.sessionId !== sessionId && sessionId !== 'default-session') {
    throw new Error('Unauthorized: document belongs to a different session');
  }
  documents.delete(documentId);
  return { deleted: true, id: documentId };
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
