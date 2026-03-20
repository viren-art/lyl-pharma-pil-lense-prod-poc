import { convertPdfToImages } from '../utils/pdfToImage.js';

// LYL_DEP: @google-cloud/documentai@^8.0.0
// LYL_DEP: dotenv@^16.3.1

// Google Document AI configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT_ID;
const LOCATION = 'asia-southeast1'; // Optimized for CJK/Thai/Korean
const PROCESSOR_ID = process.env.GOOGLE_DOCAI_PROCESSOR_ID;

// Timeout configuration
const EXTRACTION_TIMEOUT_MS = 30000; // 30 seconds total timeout
const PAGE_TIMEOUT_MS = 3000; // 3 seconds per page target

// Mock implementation for development (replace with actual SDK in production)
const USE_MOCK = !PROJECT_ID || !PROCESSOR_ID;

// Critical sections that must be present
const REQUIRED_CRITICAL_SECTIONS = [
  'DOSAGE AND ADMINISTRATION',
  'WARNINGS AND PRECAUTIONS',
  'CONTRAINDICATIONS',
  'ACTIVE INGREDIENTS'
];

/**
 * Extract document content using Google Document AI
 * Optimized for CJK/Thai/Korean pharmaceutical text
 */
export async function extractWithGoogleDocAI(document) {
  console.info('Starting Google Document AI extraction', {
    documentId: document.id,
    documentName: document.name,
    pageCount: document.pageCount
  });
  
  // Convert PDF to images for processing
  const pageImages = await convertPdfToImages(document.buffer);
  
  if (USE_MOCK) {
    console.warn('Using mock Google Document AI (no credentials configured)');
    return mockExtraction(document, pageImages);
  }
  
  try {
    // Initialize Document AI client
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
    const client = new DocumentProcessorServiceClient({
      apiEndpoint: `${LOCATION}-documentai.googleapis.com`
    });
    
    const name = `projects/${PROJECT_ID}/locations/${LOCATION}/processors/${PROCESSOR_ID}`;
    
    // Process entire document with timeout
    const sections = await Promise.race([
      processDocumentWithDocAI(client, name, document),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Google Document AI extraction timeout')), EXTRACTION_TIMEOUT_MS)
      )
    ]);
    
    // Validate critical sections are present
    validateCriticalSections(sections);
    
    return {
      sections,
      pageImages
    };
    
  } catch (error) {
    console.error('Google Document AI extraction failed', {
      documentId: document.id,
      error: error.message,
      stack: error.stack
    });
    
    // Re-throw to trigger fallback in extractionRouter
    throw new Error(`Google Document AI extraction failed: ${error.message}`);
  }
}

/**
 * Process document with Google Document AI
 */
async function processDocumentWithDocAI(client, name, document) {
  const request = {
    name,
    rawDocument: {
      content: document.buffer.toString('base64'),
      mimeType: 'application/pdf'
    },
    // Enable CJK/Thai/Korean language hints for optimal extraction
    processOptions: {
      ocrConfig: {
        languageHints: ['zh-TW', 'zh-CN', 'th', 'ko', 'en'],
        enableNativePdfParsing: true,
        // Enable advanced features for pharmaceutical documents
        premiumFeatures: {
          enableMathOcr: true, // For chemical formulas
          enableSelectionMarkDetection: true, // For checkboxes in forms
          computeStyleInfo: true // For preserving formatting
        }
      }
    }
  };
  
  const [result] = await client.processDocument(request);
  const { document: docAiDocument } = result;
  
  if (!docAiDocument || !docAiDocument.text) {
    throw new Error('Google Document AI returned empty response');
  }
  
  // Extract sections from Document AI response
  const sections = parseDocumentAISections(docAiDocument, 1);
  
  if (sections.length === 0) {
    throw new Error('No sections extracted from document');
  }
  
  return sections;
}

/**
 * Validate that critical sections are present in extracted content
 */
function validateCriticalSections(sections) {
  const extractedSectionNames = sections.map(s => s.sectionName.toUpperCase());
  const missingSections = [];
  
  for (const requiredSection of REQUIRED_CRITICAL_SECTIONS) {
    const found = extractedSectionNames.some(name => 
      name.includes(requiredSection) || requiredSection.includes(name)
    );
    
    if (!found) {
      missingSections.push(requiredSection);
    }
  }
  
  if (missingSections.length > 0) {
    console.error('Critical sections missing from extraction', {
      missingSections,
      extractedSections: extractedSectionNames
    });
    
    throw new Error(`Critical sections missing: ${missingSections.join(', ')}`);
  }
  
  console.info('All critical sections validated', {
    criticalSectionsFound: REQUIRED_CRITICAL_SECTIONS.length
  });
}

/**
 * Parse Document AI response into standardized section format
 */
function parseDocumentAISections(docAiDocument, startPage) {
  const sections = [];
  const text = docAiDocument.text;
  
  if (!text || text.trim().length === 0) {
    throw new Error('Document AI returned empty text content');
  }
  
  // Document AI returns entities and layout information
  // We need to identify section headers and group content
  const entities = docAiDocument.entities || [];
  const pages = docAiDocument.pages || [];
  
  // Common PIL section headers (case-insensitive patterns)
  const sectionPatterns = [
    /PRODUCT NAME/i,
    /ACTIVE INGREDIENTS?/i,
    /INDICATIONS?/i,
    /THERAPEUTIC INDICATIONS?/i,
    /DOSAGE AND ADMINISTRATION/i,
    /POSOLOGY AND METHOD OF ADMINISTRATION/i,
    /CONTRAINDICATIONS?/i,
    /WARNINGS? AND PRECAUTIONS?/i,
    /SPECIAL WARNINGS?/i,
    /ADVERSE REACTIONS?/i,
    /UNDESIRABLE EFFECTS?/i,
    /DRUG INTERACTIONS?/i,
    /PREGNANCY AND LACTATION/i,
    /STORAGE/i,
    /STORAGE CONDITIONS?/i,
    /OVERDOSAGE/i,
    /PHARMACOLOGICAL PROPERTIES/i
  ];
  
  // Split text into lines and identify sections
  const lines = text.split('\n');
  let currentSection = null;
  let currentContent = [];
  let currentPageRefs = new Set();
  
  // Calculate average lines per page for page reference estimation
  const avgLinesPerPage = lines.length / pages.length;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Estimate page number from line position
    const estimatedPage = startPage + Math.floor(i / avgLinesPerPage);
    
    // Check if line is a section header
    const matchedPattern = sectionPatterns.find(pattern => pattern.test(line));
    
    if (matchedPattern) {
      // Save previous section
      if (currentSection) {
        const content = currentContent.join('\n').trim();
        sections.push({
          sectionName: currentSection,
          content: content,
          pageReferences: Array.from(currentPageRefs).sort((a, b) => a - b),
          confidenceScore: calculateConfidenceScore(content, currentSection)
        });
      }
      
      // Start new section
      currentSection = line.toUpperCase();
      currentContent = [];
      currentPageRefs = new Set([estimatedPage]);
    } else if (currentSection) {
      // Add content to current section
      currentContent.push(line);
      currentPageRefs.add(estimatedPage);
    }
  }
  
  // Save last section
  if (currentSection) {
    const content = currentContent.join('\n').trim();
    sections.push({
      sectionName: currentSection,
      content: content,
      pageReferences: Array.from(currentPageRefs).sort((a, b) => a - b),
      confidenceScore: calculateConfidenceScore(content, currentSection)
    });
  }
  
  if (sections.length === 0) {
    throw new Error('No sections extracted from document');
  }
  
  return sections;
}

/**
 * Calculate confidence score based on content characteristics
 * Higher confidence for well-structured content with clear formatting
 */
function calculateConfidenceScore(content, sectionName) {
  let score = 0.70; // Base score
  
  // Critical sections (dosage, warnings, active ingredients) need higher base confidence
  const criticalSections = [
    'DOSAGE AND ADMINISTRATION',
    'WARNINGS AND PRECAUTIONS',
    'CONTRAINDICATIONS',
    'ACTIVE INGREDIENTS',
    'DOSAGE',
    'WARNINGS',
    'PRECAUTIONS'
  ];
  
  const isCritical = criticalSections.some(critical => 
    sectionName.toUpperCase().includes(critical)
  );
  
  if (isCritical) {
    score = 0.75; // Higher base for critical sections
  }
  
  // Increase confidence for structured content
  if (content.includes('•') || content.includes('-') || content.includes('–')) score += 0.05; // Bullet points
  if (/\d+\s*mg/.test(content) || /\d+\s*mcg/.test(content)) score += 0.05; // Dosage information
  if (content.length > 100) score += 0.05; // Substantial content
  if (/[A-Z][a-z]+\s+[A-Z][a-z]+/.test(content)) score += 0.05; // Proper capitalization
  if (/\n\n/.test(content)) score += 0.03; // Paragraph breaks
  
  // Decrease confidence for potential OCR issues
  if (/[^\x00-\x7F]{20,}/.test(content) && !/[\u4e00-\u9fff\u0e00-\u0e7f\uac00-\ud7af]/.test(content)) {
    // Many non-ASCII chars that aren't CJK/Thai/Korean (potential OCR errors)
    score -= 0.05;
  }
  if (content.split('\n').length < 2) score -= 0.05; // Very short section
  if (content.length < 50) score -= 0.08; // Suspiciously short content
  
  // Boost confidence for CJK/Thai/Korean content (Document AI is optimized for these)
  if (/[\u4e00-\u9fff\u0e00-\u0e7f\uac00-\ud7af]/.test(content)) {
    score += 0.08;
  }
  
  return Math.max(0.60, Math.min(0.98, score));
}

/**
 * Mock extraction for development/testing
 */
function mockExtraction(document, pageImages) {
  console.warn('Using mock extraction - replace with actual Google Document AI in production');
  
  const sections = [
    {
      sectionName: 'PRODUCT NAME',
      content: `${document.productName}\nPharmaceutical Product Information`,
      pageReferences: [1],
      confidenceScore: 0.95
    },
    {
      sectionName: 'ACTIVE INGREDIENTS',
      content: 'Each tablet contains:\n- Active ingredient as specified\n- Excipients: lactose, microcrystalline cellulose',
      pageReferences: [1, 2],
      confidenceScore: 0.92
    },
    {
      sectionName: 'INDICATIONS',
      content: 'This medication is indicated for the treatment of specific conditions as approved by regulatory authorities.',
      pageReferences: [2],
      confidenceScore: 0.88
    },
    {
      sectionName: 'DOSAGE AND ADMINISTRATION',
      content: 'Adults: Take as directed by physician\nDosage: 250mg once daily\nAdministration: Oral, with or without food',
      pageReferences: [2, 3],
      confidenceScore: 0.90
    },
    {
      sectionName: 'CONTRAINDICATIONS',
      content: 'Do not use if:\n- Hypersensitive to active ingredient\n- Severe hepatic impairment\n- Pregnancy (Category X)',
      pageReferences: [3],
      confidenceScore: 0.87
    },
    {
      sectionName: 'WARNINGS AND PRECAUTIONS',
      content: 'Special warnings:\n- Monitor liver function\n- Risk of serious adverse reactions\n- Use with caution in elderly patients',
      pageReferences: [3, 4],
      confidenceScore: 0.85
    },
    {
      sectionName: 'ADVERSE REACTIONS',
      content: 'Common (>1%): nausea, headache, fatigue\nUncommon (0.1-1%): dizziness, rash\nRare (<0.1%): severe allergic reactions',
      pageReferences: [4, 5],
      confidenceScore: 0.89
    },
    {
      sectionName: 'STORAGE',
      content: 'Store at room temperature (15-30°C)\nKeep in original container\nProtect from moisture and light',
      pageReferences: [5],
      confidenceScore: 0.93
    }
  ];
  
  return {
    sections,
    pageImages
  };
}