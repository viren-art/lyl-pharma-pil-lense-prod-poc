import { convertPdfToImages } from '../utils/pdfToImage.js';

// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const USE_MOCK = !CLAUDE_API_KEY;

// Timeout configuration
const EXTRACTION_TIMEOUT_MS = 30000; // 30 seconds total timeout
const BATCH_TIMEOUT_MS = 15000; // 15 seconds per batch

// Critical sections that must be present
const REQUIRED_CRITICAL_SECTIONS = [
  'DOSAGE AND ADMINISTRATION',
  'WARNINGS AND PRECAUTIONS',
  'CONTRAINDICATIONS',
  'ACTIVE INGREDIENTS'
];

/**
 * Extract document content using Claude Vision
 * Fallback provider with consistent JSON output
 */
export async function extractWithClaudeVision(document) {
  console.info('Starting Claude Vision extraction', {
    documentId: document.id,
    documentName: document.name,
    pageCount: document.pageCount
  });
  
  // Convert PDF to images
  const pageImages = await convertPdfToImages(document.buffer);
  
  if (USE_MOCK) {
    console.warn('Using mock Claude Vision (no API key configured)');
    return mockExtraction(document, pageImages);
  }
  
  try {
    // Initialize Claude client
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({
      apiKey: CLAUDE_API_KEY
    });
    
    // Process pages in batches with timeout
    const sections = await Promise.race([
      processBatchesWithClaude(client, pageImages),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude Vision extraction timeout')), EXTRACTION_TIMEOUT_MS)
      )
    ]);
    
    // Validate critical sections are present
    validateCriticalSections(sections);
    
    return {
      sections,
      pageImages
    };
    
  } catch (error) {
    console.error('Claude Vision extraction failed', {
      documentId: document.id,
      error: error.message,
      stack: error.stack
    });
    
    // Re-throw to signal complete failure
    throw new Error(`Claude Vision extraction failed: ${error.message}`);
  }
}

/**
 * Process batches with Claude Vision
 */
async function processBatchesWithClaude(client, pageImages) {
  const sections = [];
  const batchSize = 5; // Process 5 pages at a time
  
  for (let i = 0; i < pageImages.length; i += batchSize) {
    const batchImages = pageImages.slice(i, i + batchSize);
    const batchStartPage = i + 1;
    
    console.info('Processing batch with Claude Vision', {
      batchStartPage,
      batchSize: batchImages.length
    });
    
    // Process batch with timeout
    const batchSections = await Promise.race([
      processSingleBatch(client, batchImages, batchStartPage),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Claude Vision batch timeout')), BATCH_TIMEOUT_MS)
      )
    ]);
    
    sections.push(...batchSections);
  }
  
  // Merge sections with same name across batches
  const mergedSections = mergeSections(sections);
  
  if (mergedSections.length === 0) {
    throw new Error('No sections extracted after merging');
  }
  
  return mergedSections;
}

/**
 * Process a single batch of pages
 */
async function processSingleBatch(client, batchImages, batchStartPage) {
  // Create vision messages for Claude
  const imageMessages = batchImages.map((img, idx) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: img.imageBase64
    }
  }));
  
  const prompt = `You are analyzing pharmaceutical Patient Information Leaflet (PIL) pages. Extract all sections with their content.

For each section found, provide:
1. Section name (e.g., "PRODUCT NAME", "ACTIVE INGREDIENTS", "DOSAGE AND ADMINISTRATION")
2. Complete section content (preserve all text, dosage tables, warnings)
3. Page numbers where this section appears (pages ${batchStartPage} to ${batchStartPage + batchImages.length - 1})
4. Confidence score (0.0-1.0) based on text clarity and completeness

Common PIL sections include:
- PRODUCT NAME
- ACTIVE INGREDIENTS
- INDICATIONS / THERAPEUTIC INDICATIONS
- DOSAGE AND ADMINISTRATION / POSOLOGY
- CONTRAINDICATIONS
- WARNINGS AND PRECAUTIONS / SPECIAL WARNINGS
- ADVERSE REACTIONS / UNDESIRABLE EFFECTS
- DRUG INTERACTIONS
- PREGNANCY AND LACTATION
- STORAGE / STORAGE CONDITIONS
- OVERDOSAGE
- PHARMACOLOGICAL PROPERTIES

Return ONLY a JSON array with this exact structure:
[
  {
    "sectionName": "SECTION NAME IN CAPS",
    "content": "Complete section text...",
    "pageReferences": [1, 2],
    "confidenceScore": 0.92
  }
]

Important:
- Preserve all dosage information, chemical formulas, and warnings exactly
- For CJK/Thai/Korean text, maintain original characters
- If a section spans multiple pages, include all page numbers
- Confidence should be 0.85+ for critical sections (dosage, warnings, active ingredients)
- Return valid JSON only, no markdown formatting`;
  
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          ...imageMessages,
          {
            type: 'text',
            text: prompt
          }
        ]
      }
    ]
  });
  
  if (!response || !response.content || response.content.length === 0) {
    throw new Error('Claude Vision returned empty response');
  }
  
  // Parse Claude's JSON response
  const responseText = response.content[0].text;
  const batchSections = parseClaudeResponse(responseText, batchStartPage);
  
  if (batchSections.length === 0) {
    throw new Error('Claude Vision failed to extract any sections');
  }
  
  return batchSections;
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
 * Parse Claude's JSON response into standardized format
 */
function parseClaudeResponse(responseText, startPage) {
  try {
    // Remove markdown code blocks if present
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate structure
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    
    if (parsed.length === 0) {
      throw new Error('Response array is empty');
    }
    
    return parsed.map(section => ({
      sectionName: section.sectionName || 'UNKNOWN SECTION',
      content: section.content || '',
      pageReferences: Array.isArray(section.pageReferences) 
        ? section.pageReferences 
        : [startPage],
      confidenceScore: typeof section.confidenceScore === 'number'
        ? Math.max(0, Math.min(1, section.confidenceScore))
        : 0.75
    }));
    
  } catch (error) {
    console.error('Failed to parse Claude Vision response', {
      error: error.message,
      responseText: responseText.substring(0, 200)
    });
    
    // Throw error instead of returning empty array
    throw new Error(`Failed to parse Claude response: ${error.message}`);
  }
}

/**
 * Merge sections with same name from different batches
 */
function mergeSections(sections) {
  const sectionMap = new Map();
  
  for (const section of sections) {
    const existing = sectionMap.get(section.sectionName);
    
    if (existing) {
      // Merge content and page references
      existing.content += '\n' + section.content;
      existing.pageReferences = [
        ...new Set([...existing.pageReferences, ...section.pageReferences])
      ].sort((a, b) => a - b);
      // Average confidence scores
      existing.confidenceScore = (existing.confidenceScore + section.confidenceScore) / 2;
    } else {
      sectionMap.set(section.sectionName, { ...section });
    }
  }
  
  return Array.from(sectionMap.values());
}

/**
 * Mock extraction for development/testing
 */
function mockExtraction(document, pageImages) {
  console.warn('Using mock Claude Vision - replace with actual API in production');
  
  const sections = [
    {
      sectionName: 'PRODUCT NAME',
      content: `${document.productName}\nPatient Information Leaflet`,
      pageReferences: [1],
      confidenceScore: 0.94
    },
    {
      sectionName: 'ACTIVE INGREDIENTS',
      content: 'Active pharmaceutical ingredient: As specified in product name\nExcipients: Standard pharmaceutical excipients',
      pageReferences: [1, 2],
      confidenceScore: 0.91
    },
    {
      sectionName: 'THERAPEUTIC INDICATIONS',
      content: 'Indicated for treatment of conditions as approved by regulatory authorities in target markets.',
      pageReferences: [2],
      confidenceScore: 0.87
    },
    {
      sectionName: 'DOSAGE AND ADMINISTRATION',
      content: 'Recommended dosage: As prescribed by physician\nAdministration route: Oral\nTiming: With or without food',
      pageReferences: [2, 3],
      confidenceScore: 0.89
    },
    {
      sectionName: 'CONTRAINDICATIONS',
      content: 'Contraindicated in:\n- Known hypersensitivity\n- Severe organ impairment\n- Specific patient populations as detailed',
      pageReferences: [3],
      confidenceScore: 0.86
    },
    {
      sectionName: 'WARNINGS AND PRECAUTIONS',
      content: 'Monitor for:\n- Adverse reactions\n- Drug interactions\n- Special populations (elderly, pediatric)',
      pageReferences: [3, 4],
      confidenceScore: 0.84
    },
    {
      sectionName: 'UNDESIRABLE EFFECTS',
      content: 'Very common: nausea, fatigue\nCommon: headache, dizziness\nUncommon: serious adverse events',
      pageReferences: [4, 5],
      confidenceScore: 0.88
    },
    {
      sectionName: 'STORAGE CONDITIONS',
      content: 'Store at controlled room temperature\nProtect from light and moisture\nKeep out of reach of children',
      pageReferences: [5],
      confidenceScore: 0.92
    }
  ];
  
  return {
    sections,
    pageImages
  };
}