import { Router } from 'express';
import multer from 'multer';
import {
  uploadDocument,
  getDocuments,
  getDocumentById,
  deleteDocument,
  getDocumentTypes
} from '../services/documentManager.js';

const router = Router();

// Configure multer for in-memory file storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024 // 25MB
  }
});

/**
 * POST /api/documents/upload
 * Upload a pharmaceutical document
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const { type, productName } = req.body;
    const file = req.file;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    if (!file) {
      return res.status(400).json({
        error: {
          code: 'NO_FILE',
          message: 'No file provided',
          retryable: false
        }
      });
    }

    const document = await uploadDocument(file, type, productName, sessionId);

    res.status(201).json(document);
  } catch (error) {
    console.error('Document upload failed:', error);

    if (error.message.includes('Session limit exceeded')) {
      return res.status(400).json({
        error: {
          code: 'SESSION_LIMIT_EXCEEDED',
          message: error.message,
          retryable: false
        }
      });
    }

    if (error.message.includes('Unsupported file type')) {
      return res.status(400).json({
        error: {
          code: 'INVALID_FILE_TYPE',
          message: error.message,
          retryable: false
        }
      });
    }

    if (error.message.includes('File size')) {
      return res.status(413).json({
        error: {
          code: 'FILE_SIZE_EXCEEDED',
          message: error.message,
          retryable: false
        }
      });
    }

    res.status(400).json({
      error: {
        code: 'UPLOAD_FAILED',
        message: error.message,
        retryable: false
      }
    });
  }
});

/**
 * GET /api/documents
 * List all documents in session
 */
router.get('/', (req, res) => {
  try {
    const sessionId = req.headers['x-session-id'] || 'default-session';
    const documents = getDocuments(sessionId);

    res.json({
      documents,
      total: documents.length
    });
  } catch (error) {
    console.error('Failed to list documents:', error);
    res.status(500).json({
      error: {
        code: 'LIST_FAILED',
        message: 'Failed to retrieve documents',
        retryable: true
      }
    });
  }
});

/**
 * GET /api/documents/types
 * Get available document types
 */
router.get('/types', (req, res) => {
  try {
    const types = getDocumentTypes();
    res.json({ types });
  } catch (error) {
    console.error('Failed to get document types:', error);
    res.status(500).json({
      error: {
        code: 'TYPES_FAILED',
        message: 'Failed to retrieve document types',
        retryable: true
      }
    });
  }
});

/**
 * DELETE /api/documents/:id
 * Delete a document
 */
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const sessionId = req.headers['x-session-id'] || 'default-session';

    const result = deleteDocument(id, sessionId);

    res.json(result);
  } catch (error) {
    console.error('Failed to delete document:', error);

    if (error.message === 'Document not found') {
      return res.status(404).json({
        error: {
          code: 'DOCUMENT_NOT_FOUND',
          message: error.message,
          retryable: false
        }
      });
    }

    if (error.message.includes('Unauthorized')) {
      return res.status(403).json({
        error: {
          code: 'UNAUTHORIZED',
          message: error.message,
          retryable: false
        }
      });
    }

    res.status(500).json({
      error: {
        code: 'DELETE_FAILED',
        message: 'Failed to delete document',
        retryable: true
      }
    });
  }
});

export default router;