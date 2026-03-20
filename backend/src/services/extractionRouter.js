import { getCachedExtraction, cacheExtraction } from './extractionCache.js';

/**
 * Extraction Router Service
 * Routes extraction requests to appropriate provider with caching
 */

// Mock extraction function (replace with actual implementation)
async function mockExtractDocument(documentId, provider) {
  // Simulate extraction delay
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return {
    documentId,
    provider,
    sections: [
      {
        sectionName: 'PRODUCT NAME',
        content: 'ZENORA (Abiraterone Acetate) 250 mg Tablets',
        pageReferences: [1],
        confidenceScore: 0.98
      },
      {
        sectionName: 'ACTIVE INGREDIENTS',
        content: 'Each tablet contains 250 mg of abiraterone acetate',
        pageReferences: [1],
        confidenceScore: 0.96
      },
      {
        sectionName: 'DOSAGE AND ADMINISTRATION',
        content: 'The recommended dose is 1,000 mg (four 250 mg tablets) administered orally once daily...',
        pageReferences: [2, 3],
        confidenceScore: 0.92
      }
    ],
    pageImages: [
      { pageNumber: 1, imageBase64: 'mock-base64-page1' },
      { pageNumber: 2, imageBase64: 'mock-base64-page2' },
      { pageNumber: 3, imageBase64: 'mock-base64-page3' }
    ],
    processingTimeMs: 1000
  };
}

/**
 * Extract document with caching
 * @param {string} documentId - Document UUID
 * @param {string} sessionId - Session identifier
 * @param {string} provider - Optional provider override (defaults to configured provider)
 * @returns {Promise<Object>} Extraction result
 */
export async function extractDocument(documentId, sessionId, provider = 'google_docai') {
  // Check cache first
  const cached = getCachedExtraction(documentId, provider);
  if (cached) {
    console.log(`[ExtractionRouter] Using cached extraction for ${documentId}`);
    return cached;
  }
  
  console.log(`[ExtractionRouter] Extracting document ${documentId} with ${provider}`);
  
  const startTime = Date.now();
  
  // Perform extraction (using mock for now)
  const result = await mockExtractDocument(documentId, provider);
  
  const processingTimeMs = Date.now() - startTime;
  result.processingTimeMs = processingTimeMs;
  
  // Cache the result
  cacheExtraction(documentId, provider, result);
  
  console.log(`[ExtractionRouter] Extraction completed in ${processingTimeMs}ms`, {
    documentId,
    provider,
    sections: result.sections.length,
    cached: false
  });
  
  return result;
}