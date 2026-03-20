import { extractWithGoogleDocAI } from './providers/googleDocAI.js';
import { extractWithClaudeVision } from './providers/claudeVision.js';
import { getDocumentById } from './documentManager.js';
import { convertPdfToImages } from '../utils/pdfConverter.js';

/**
 * Extraction Router Service
 * Routes document extraction to configured provider (Google Document AI or Claude Vision)
 * Returns standardized extraction result format
 */

// In-memory extraction results cache
const extractionResults = new Map();

// Configuration - can be changed via environment variable or config file
let primaryProvider = process.env.EXTRACTION_PROVIDER || 'google_docai';

/**
 * Extract document content using configured provider
 * @param {string} documentId - Document UUID
 * @param {string} sessionId - Session identifier
 * @returns {Promise<Object>} Standardized extraction result
 */
export async function extractDocument(documentId, sessionId) {
  const startTime = Date.now();
  
  try {
    // Check if already extracted
    const cached = extractionResults.get(documentId);
    if (cached) {
      console.log(`[ExtractionRouter] Using cached extraction for ${documentId}`);
      return cached;
    }
    
    // Get document from storage
    const document = getDocumentById(documentId);
    if (!document) {
      throw new Error(`Document not found: ${documentId}`);
    }
    
    console.log(`[ExtractionRouter] Extracting document ${documentId} using ${primaryProvider}`, {
      documentName: document.name,
      documentType: document.type,
      sessionId
    });
    
    // Convert PDF to images for extraction
    const pageImages = await convertPdfToImages(document.fileBlob);
    
    let extractionResult;
    let provider = primaryProvider;
    
    try {
      // Try primary provider
      if (primaryProvider === 'google_docai') {
        extractionResult = await extractWithGoogleDocAI(document.fileBlob, pageImages);
      } else if (primaryProvider === 'claude_vision') {
        extractionResult = await extractWithClaudeVision(document.fileBlob, pageImages);
      } else {
        throw new Error(`Unknown extraction provider: ${primaryProvider}`);
      }
    } catch (primaryError) {
      console.warn(`[ExtractionRouter] Primary provider ${primaryProvider} failed, attempting fallback`, {
        error: primaryError.message,
        documentId
      });
      
      // Fallback to alternative provider
      provider = primaryProvider === 'google_docai' ? 'claude_vision' : 'google_docai';
      
      if (provider === 'google_docai') {
        extractionResult = await extractWithGoogleDocAI(document.fileBlob, pageImages);
      } else {
        extractionResult = await extractWithClaudeVision(document.fileBlob, pageImages);
      }
      
      console.log(`[ExtractionRouter] Fallback to ${provider} successful`);
    }
    
    const processingTimeMs = Date.now() - startTime;
    
    // Standardize result format
    const result = {
      documentId,
      provider,
      sections: extractionResult.sections,
      pageImages: pageImages.map((img, idx) => ({
        pageNumber: idx + 1,
        imageBase64: img
      })),
      processingTimeMs,
      processedDate: new Date().toISOString()
    };
    
    // Cache result
    extractionResults.set(documentId, result);
    
    console.log(`[ExtractionRouter] Extraction completed for ${documentId}`, {
      provider,
      sectionCount: result.sections.length,
      processingTimeMs
    });
    
    return result;
    
  } catch (error) {
    console.error(`[ExtractionRouter] Extraction failed for ${documentId}`, {
      error: error.message,
      stack: error.stack
    });
    
    throw new Error(`Document extraction failed: ${error.message}`);
  }
}

/**
 * Set extraction provider
 * @param {string} provider - 'google_docai' or 'claude_vision'
 */
export function setExtractionProvider(provider) {
  if (provider !== 'google_docai' && provider !== 'claude_vision') {
    throw new Error(`Invalid provider: ${provider}. Must be 'google_docai' or 'claude_vision'`);
  }
  
  primaryProvider = provider;
  console.log(`[ExtractionRouter] Provider changed to ${provider}`);
}

/**
 * Get current extraction provider
 * @returns {string} Current provider name
 */
export function getExtractionProvider() {
  return primaryProvider;
}

/**
 * Clear extraction cache (for testing)
 */
export function clearExtractionCache() {
  extractionResults.clear();
}