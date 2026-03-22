import { extractWithClaudeVision } from './claudeVision.js';
import { isGeminiAvailable, extractPdfWithGemini } from './geminiExtraction.js';
import { getDocumentById } from './documentManager.js';

/**
 * Extraction Router Service
 * Routes document extraction by file type:
 * - PDF → Claude Vision (layout-aware extraction)
 * - Word (.docx) → mammoth (text extraction, $0/page)
 */

// In-memory extraction results cache with TTL
const extractionResults = new Map();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

// Periodic cache cleanup (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of extractionResults) {
    if (now - new Date(value.processedDate).getTime() > CACHE_TTL_MS) {
      extractionResults.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Extract document content using appropriate method based on file type
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

    console.log(`[ExtractionRouter] Extracting document ${documentId}`, {
      documentName: document.name,
      documentType: document.type,
      mimeType: document.mimeType,
      sessionId
    });

    let extractionResult;

    // Route by file type: Word docs use mammoth, PDFs use Claude Vision
    const isWordDoc = document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || document.name?.endsWith('.docx');

    if (isWordDoc) {
      console.log(`[ExtractionRouter] Using mammoth for Word document extraction`);
      extractionResult = await extractWordWithMammoth(document);
    } else if (isGeminiAvailable()) {
      // Gemini: 1M context window — single call, no chunking, no truncation
      console.log(`[ExtractionRouter] Using Gemini for PDF extraction (1M context)`);
      try {
        extractionResult = await extractPdfWithGemini(document.buffer);
      } catch (geminiError) {
        console.warn(`[ExtractionRouter] Gemini failed, falling back to Claude: ${geminiError.message}`);
        extractionResult = await extractWithClaudeVision(document);
      }
    } else {
      // Claude Vision: chunked extraction (200K context limit)
      console.log(`[ExtractionRouter] Using Claude Vision for PDF extraction (chunked)`);
      extractionResult = await extractWithClaudeVision(document);
    }

    const processingTimeMs = Date.now() - startTime;

    // Standardize result format
    const result = {
      documentId,
      provider: isWordDoc ? 'mammoth' : (isGeminiAvailable() ? 'gemini' : 'claude_vision'),
      sections: extractionResult.sections,
      diagrams: extractionResult.diagrams || [],
      pageImages: extractionResult.pageImages || [],
      processingTimeMs,
      processedDate: new Date().toISOString()
    };

    // Cache result
    extractionResults.set(documentId, result);

    console.log(`[ExtractionRouter] Extraction completed for ${documentId}`, {
      provider: result.provider,
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
 * Extract Word document content using mammoth
 * Parses into sections by detecting heading patterns:
 * - ALL CAPS lines (e.g., "DOSAGE AND ADMINISTRATION")
 * - Numbered sections (e.g., "4.2 Posology")
 * - Bold text followed by content
 */
async function extractWordWithMammoth(document) {
  try {
    const mammoth = await import('mammoth');

    const result = await mammoth.default.extractRawText({ buffer: document.buffer });
    const rawText = result.value;

    if (!rawText || rawText.trim().length === 0) {
      throw new Error('Mammoth extracted empty text from Word document');
    }

    console.log(`[ExtractionRouter] Mammoth extracted ${rawText.length} characters`);

    // Parse into sections
    const sections = parseWordTextIntoSections(rawText);

    console.log(`[ExtractionRouter] Parsed ${sections.length} sections from Word document`);

    return {
      sections,
      diagrams: [], // Word docs don't have visual diagrams to extract
      pageImages: [] // Word docs don't have page images
    };

  } catch (error) {
    console.error('[ExtractionRouter] Mammoth extraction failed', { error: error.message });
    throw new Error(`Word document extraction failed: ${error.message}`);
  }
}

/**
 * Parse raw text into sections by detecting heading patterns
 */
function parseWordTextIntoSections(rawText) {
  const lines = rawText.split('\n');
  const sections = [];
  let currentSection = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const isHeading = detectHeading(line);

    if (isHeading) {
      // Save previous section
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }

      currentSection = {
        sectionName: normalizeHeading(line),
        content: '',
        pageReferences: [1], // Word docs don't have reliable page numbers
        confidenceScore: 0.90,
        flags: {
          hasDosageTable: false,
          hasChemicalFormula: false,
          hasWarningBox: false,
          isContinuedFromPrevious: false,
          continuesOnNext: false
        }
      };
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + line;

      // Detect content flags
      if (/\d+\s*(mg|mcg|ml|g|iu|units?)\b/i.test(line)) {
        currentSection.flags.hasDosageTable = true;
      }
      if (/[A-Z]\d+H\d+|C₂|H₂O|NaCl|[A-Z][a-z]?\d+/i.test(line)) {
        currentSection.flags.hasChemicalFormula = true;
      }
      if (/warning|caution|danger/i.test(line)) {
        currentSection.flags.hasWarningBox = true;
      }
    } else {
      // Content before first heading — create an intro section
      if (!currentSection) {
        currentSection = {
          sectionName: 'DOCUMENT HEADER',
          content: line,
          pageReferences: [1],
          confidenceScore: 0.85,
          flags: {
            hasDosageTable: false,
            hasChemicalFormula: false,
            hasWarningBox: false,
            isContinuedFromPrevious: false,
            continuesOnNext: false
          }
        };
      }
    }
  }

  // Push last section
  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Detect if a line is a section heading
 */
function detectHeading(line) {
  // ALL CAPS line with 3+ characters (e.g., "DOSAGE AND ADMINISTRATION")
  if (/^[A-Z][A-Z\s\/&,()-]{2,}$/.test(line) && line.length <= 80) {
    return true;
  }

  // Numbered section (e.g., "4.2 Posology and method of administration")
  if (/^\d+(\.\d+)*\s+[A-Z]/.test(line)) {
    return true;
  }

  // Section number followed by title in various formats
  if (/^Section\s+\d+/i.test(line)) {
    return true;
  }

  return false;
}

/**
 * Normalize heading text to consistent format
 */
function normalizeHeading(line) {
  // Remove leading numbers like "4.2 "
  let heading = line.replace(/^\d+(\.\d+)*\s+/, '').trim();
  // Normalize to uppercase
  heading = heading.toUpperCase();
  return heading;
}

/**
 * Clear extraction cache (for testing)
 */
export function clearExtractionCache() {
  extractionResults.clear();
}
