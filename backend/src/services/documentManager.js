import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { PDFDocument } from 'pdf-lib';
import mammoth from 'mammoth';

// LYL_DEP: pdf-lib@^1.17.1
// LYL_DEP: mammoth@^1.6.0

// In-memory document storage (cleared on server restart)
const documents = new Map();
const MAX_DOCUMENTS_PER_SESSION = 100;

// Document type enum
const DOCUMENT_TYPES = [
  'innovator_pil',
  'approved_pil',
  'aw_draft',
  'regulatory_source',
  'updated_pil',
  'regulatory_announcement',
  'local_market_pil_format',
  'diecut_specification',
  'stamped_pil'
];

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB

/**
 * Validate document upload request
 */
function validateUpload(file, type, productName, sessionId) {
  const errors = [];

  // Check file exists
  if (!file) {
    errors.push('No file provided');
  }

  // Check file size
  if (file && file.size > MAX_FILE_SIZE_BYTES) {
    errors.push(`File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum 25MB`);
  }

  // Check MIME type
  if (file && !ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    errors.push(`Unsupported file type: ${file.mimetype}. Only PDF and Word (.docx) files are allowed`);
  }

  // Check document type
  if (!DOCUMENT_TYPES.includes(type)) {
    errors.push(`Invalid document type: ${type}. Must be one of: ${DOCUMENT_TYPES.join(', ')}`);
  }

  // Check product name
  if (!productName || productName.trim().length === 0) {
    errors.push('Product name is required');
  }

  // Check session document limit
  const sessionDocCount = getSessionDocumentCount(sessionId);
  if (sessionDocCount >= MAX_DOCUMENTS_PER_SESSION) {
    errors.push(`Session limit exceeded: maximum ${MAX_DOCUMENTS_PER_SESSION} documents per session`);
  }

  return errors;
}

/**
 * Get count of documents in session
 */
function getSessionDocumentCount(sessionId) {
  if (!sessionId) return 0;
  
  let count = 0;
  for (const doc of documents.values()) {
    if (doc.sessionId === sessionId) {
      count++;
    }
  }
  return count;
}

/**
 * Convert Word document to PDF
 * Uses mammoth to extract HTML from Word, then pdf-lib to create PDF
 */
async function convertWordToPdf(fileBuffer, originalName) {
  try {
    // Extract HTML from Word document using mammoth
    const result = await mammoth.convertToHtml({ buffer: fileBuffer });
    const html = result.value;

    // Create a new PDF document
    const pdfDoc = await PDFDocument.create();
    
    // Add a page with standard A4 dimensions (595.28 x 841.89 points)
    const page = pdfDoc.addPage([595.28, 841.89]);
    
    // Get page dimensions
    const { width, height } = page.getSize();
    
    // Strip HTML tags for plain text extraction (basic implementation)
    // In production, would use a proper HTML-to-PDF renderer like Puppeteer
    const plainText = html
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Draw text on page (basic implementation - wraps at page width)
    const fontSize = 11;
    const lineHeight = fontSize * 1.2;
    const margin = 50;
    const maxWidth = width - (margin * 2);
    
    let yPosition = height - margin;
    const words = plainText.split(' ');
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = testLine.length * (fontSize * 0.5); // Rough estimate
      
      if (textWidth > maxWidth && currentLine) {
        page.drawText(currentLine, {
          x: margin,
          y: yPosition,
          size: fontSize,
        });
        currentLine = word;
        yPosition -= lineHeight;
        
        // Add new page if needed
        if (yPosition < margin) {
          const newPage = pdfDoc.addPage([595.28, 841.89]);
          yPosition = newPage.getSize().height - margin;
        }
      } else {
        currentLine = testLine;
      }
    }
    
    // Draw remaining text
    if (currentLine) {
      page.drawText(currentLine, {
        x: margin,
        y: yPosition,
        size: fontSize,
      });
    }
    
    // Serialize PDF to bytes
    const pdfBytes = await pdfDoc.save();
    
    console.log(`Successfully converted Word document to PDF: ${originalName}`);
    return Buffer.from(pdfBytes);
    
  } catch (error) {
    console.error(`Word-to-PDF conversion failed for ${originalName}:`, error.message);
    throw new Error(`Failed to convert Word document to PDF: ${error.message}`);
  }
}

/**
 * Extract page count from PDF using pdf-lib
 */
async function extractPageCount(pdfBuffer) {
  try {
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pageCount = pdfDoc.getPageCount();
    return pageCount;
  } catch (error) {
    console.error('Failed to extract page count from PDF:', error.message);
    return null;
  }
}

/**
 * Upload and store document
 */
export async function uploadDocument(file, type, productName, sessionId) {
  // Validate input
  const validationErrors = validateUpload(file, type, productName, sessionId);
  if (validationErrors.length > 0) {
    throw new Error(validationErrors.join('; '));
  }

  const documentId = randomUUID();
  const uploadDate = new Date().toISOString();
  
  let fileBuffer = file.buffer;
  let mimeType = file.mimetype;
  let fileName = file.originalname;
  let pageCount = null;

  // Convert Word to PDF if needed
  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const pdfBuffer = await convertWordToPdf(fileBuffer, fileName);
    if (pdfBuffer) {
      fileBuffer = pdfBuffer;
      mimeType = 'application/pdf';
      fileName = fileName.replace(/\.docx$/i, '.pdf');
    }
  }

  // Extract page count for PDFs
  if (mimeType === 'application/pdf') {
    pageCount = await extractPageCount(fileBuffer);
  }

  // Store document in memory
  const document = {
    id: documentId,
    name: fileName,
    type,
    productName,
    fileBuffer,
    mimeType,
    fileSize: fileBuffer.length,
    pageCount,
    uploadDate,
    sessionId
  };

  documents.set(documentId, document);

  // Return document metadata (without buffer)
  return {
    id: document.id,
    name: document.name,
    type: document.type,
    productName: document.productName,
    uploadDate: document.uploadDate,
    fileSize: document.fileSize,
    pageCount: document.pageCount
  };
}

/**
 * Get all documents for a session
 */
export function getDocuments(sessionId) {
  const sessionDocs = [];
  
  for (const doc of documents.values()) {
    if (!sessionId || doc.sessionId === sessionId) {
      sessionDocs.push({
        id: doc.id,
        name: doc.name,
        type: doc.type,
        productName: doc.productName,
        uploadDate: doc.uploadDate,
        fileSize: doc.fileSize,
        pageCount: doc.pageCount
      });
    }
  }
  
  return sessionDocs.sort((a, b) => new Date(b.uploadDate) - new Date(a.uploadDate));
}

/**
 * Get single document by ID
 */
export function getDocumentById(documentId) {
  return documents.get(documentId);
}

/**
 * Delete document
 */
export function deleteDocument(documentId, sessionId) {
  const doc = documents.get(documentId);
  
  if (!doc) {
    throw new Error('Document not found');
  }
  
  // Verify session ownership
  if (sessionId && doc.sessionId !== sessionId) {
    throw new Error('Unauthorized: document belongs to different session');
  }
  
  documents.delete(documentId);
  
  return { success: true, deletedId: documentId };
}

/**
 * Clear all documents for a session
 */
export function clearSessionDocuments(sessionId) {
  if (!sessionId) return;
  
  const toDelete = [];
  for (const [id, doc] of documents.entries()) {
    if (doc.sessionId === sessionId) {
      toDelete.push(id);
    }
  }
  
  toDelete.forEach(id => documents.delete(id));
  
  return { cleared: toDelete.length };
}

/**
 * Get document types enum
 */
export function getDocumentTypes() {
  return DOCUMENT_TYPES;
}