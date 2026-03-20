import { extractWithGoogleDocAI } from './googleDocAI.js';
import { extractWithClaudeVision } from './claudeVision.js';
import { getDocumentById } from './documentManager.js';

// LYL_DEP: dotenv@^16.3.1

// Configuration for extraction provider
const EXTRACTION_PROVIDER = process.env.EXTRACTION_PROVIDER || 'google_docai';
const CRITICAL_SECTIONS = [
  'DOSAGE AND ADMINISTRATION',
  'WARNINGS AND PRECAUTIONS',
  'CONTRAINDICATIONS',
  'ACTIVE INGREDIENTS',
  'DOSAGE',
  'WARNINGS',
  'PRECAUTIONS'
];
const CRITICAL_CONFIDENCE_THRESHOLD = 0.85;
const GENERAL_CONFIDENCE_THRESHOLD = 0.70;

/**
 * Route extraction request to configured provider
 * Returns standardized extraction result with fallback logic
 */
export async function extractDocument(documentId, sessionId) {
  const document = getDocumentById(documentId);
  
  if (!document) {
    throw new Error(`Document ${documentId} not found`);
  }
  
  if (document.sessionId !== sessionId) {
    throw new Error('Document does not belong to this session');
  }
  
  const startTime = Date.now();
  let extractionResult;
  let provider = EXTRACTION_PROVIDER;
  let fallbackUsed = false;
  let primaryError = null;
  
  try {
    // Try primary provider
    console.info('Attempting extraction with primary provider', {
      documentId,
      provider
    });
    
    if (provider === 'google_docai') {
      extractionResult = await extractWithGoogleDocAI(document);
    } else if (provider === 'claude_vision') {
      extractionResult = await extractWithClaudeVision(document);
    } else {
      throw new Error(`Unknown extraction provider: ${provider}`);
    }
    
    // Validate extraction result
    if (!extractionResult || !extractionResult.sections || extractionResult.sections.length === 0) {
      throw new Error('Primary provider returned no sections');
    }
    
    // Check if critical sections meet confidence threshold
    const needsFallback = checkCriticalConfidence(extractionResult.sections);
    
    if (needsFallback && provider === 'google_docai') {
      console.warn('Critical sections below confidence threshold, falling back to Claude Vision', {
        documentId,
        provider: 'google_docai'
      });
      
      // Store primary result for comparison
      primaryError = new Error('Critical sections below confidence threshold');
      
      // Fallback to Claude Vision
      try {
        extractionResult = await extractWithClaudeVision(document);
        provider = 'claude_vision';
        fallbackUsed = true;
        
        console.info('Fallback extraction successful', {
          documentId,
          fallbackProvider: 'claude_vision',
          sectionCount: extractionResult.sections.length
        });
      } catch (fallbackError) {
        console.error('Fallback extraction also failed', {
          documentId,
          fallbackProvider: 'claude_vision',
          error: fallbackError.message
        });
        
        // If fallback fails, throw error indicating both providers failed
        throw new Error(`Both extraction providers failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
      }
    }
    
  } catch (error) {
    console.error('Primary extraction provider failed', {
      documentId,
      provider,
      error: error.message
    });
    
    // Only attempt fallback if we haven't already tried it
    if (!fallbackUsed && provider === 'google_docai') {
      console.info('Attempting fallback to Claude Vision after primary failure', {
        documentId
      });
      
      try {
        extractionResult = await extractWithClaudeVision(document);
        provider = 'claude_vision';
        fallbackUsed = true;
        
        console.info('Fallback extraction successful after primary failure', {
          documentId,
          fallbackProvider: 'claude_vision',
          sectionCount: extractionResult.sections.length
        });
      } catch (fallbackError) {
        console.error('Both extraction providers failed', {
          documentId,
          primaryProvider: 'google_docai',
          fallbackProvider: 'claude_vision',
          primaryError: error.message,
          fallbackError: fallbackError.message
        });
        
        // Both providers failed - throw comprehensive error
        throw new Error(`Both extraction providers failed. Google Document AI: ${error.message}. Claude Vision: ${fallbackError.message}`);
      }
    } else {
      // No fallback available or already tried - re-throw original error
      throw error;
    }
  }
  
  const processingTimeMs = Date.now() - startTime;
  
  // Add metadata to result
  const result = {
    ...extractionResult,
    documentId,
    provider,
    fallbackUsed,
    processingTimeMs,
    processedDate: new Date().toISOString()
  };
  
  console.info('Document extraction completed', {
    documentId,
    provider,
    fallbackUsed,
    processingTimeMs,
    sectionCount: result.sections.length,
    pageCount: result.pageImages.length
  });
  
  return result;
}

/**
 * Check if critical sections meet confidence threshold
 * Returns true if fallback is needed
 */
function checkCriticalConfidence(sections) {
  for (const section of sections) {
    const isCritical = CRITICAL_SECTIONS.some(criticalName => 
      section.sectionName.toUpperCase().includes(criticalName)
    );
    
    if (isCritical && section.confidenceScore < CRITICAL_CONFIDENCE_THRESHOLD) {
      console.warn('Critical section below confidence threshold', {
        sectionName: section.sectionName,
        confidenceScore: section.confidenceScore,
        threshold: CRITICAL_CONFIDENCE_THRESHOLD
      });
      return true;
    }
  }
  
  return false;
}

/**
 * Get current extraction provider configuration
 */
export function getExtractionProvider() {
  return EXTRACTION_PROVIDER;
}

/**
 * Get confidence thresholds
 */
export function getConfidenceThresholds() {
  return {
    critical: CRITICAL_CONFIDENCE_THRESHOLD,
    general: GENERAL_CONFIDENCE_THRESHOLD
  };
}