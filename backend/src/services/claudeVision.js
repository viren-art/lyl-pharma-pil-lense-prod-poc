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
 * Vision-first strategy: send each page as IMAGE to Claude so the LLM
 * understands layout, formatting, and context simultaneously.
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

  // Merge sections that span across pages using continuation flags
  const mergedSections = mergeSectionsWithContinuation(sections);

  if (mergedSections.length === 0) {
    throw new Error('No sections extracted after merging');
  }

  return mergedSections;
}

/**
 * Process a single batch of pages with the spec extraction prompt
 */
async function processSingleBatch(client, batchImages, batchStartPage) {
  const imageMessages = batchImages.map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: img.imageBase64
    }
  }));

  const prompt = `You are a pharmaceutical regulatory document expert analyzing a Patient Information Leaflet (PIL) page.

Extract ALL sections visible on this page. For each section return:
{
  "sectionName": "exact section heading as printed",
  "content": "complete text content of this section",
  "pageNumber": <this page number>,
  "confidence": <0.0-1.0 your confidence in extraction accuracy>,
  "flags": {
    "hasDosageTable": true/false,
    "hasChemicalFormula": true/false,
    "hasWarningBox": true/false,
    "isContinuedFromPrevious": true/false,
    "continuesOnNext": true/false
  }
}

Page range: ${batchStartPage} to ${batchStartPage + batchImages.length - 1}

Rules:
- Preserve ALL text exactly as printed, including numbers, units, chemical names
- For dosage tables, extract as structured data (rows and columns), not flattened text
- For chemical formulas, preserve subscripts and special characters
- Mark sections that span across pages with continuation flags
- If text is in multiple languages, extract ALL languages present
- Confidence < 0.85 means you're uncertain — flag it

Return ONLY a JSON array of sections. If page has no identifiable sections (e.g., cover page, blank page), return empty array with a note.
Do not wrap in markdown code blocks.`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          ...imageMessages,
          { type: 'text', text: prompt }
        ]
      }
    ]
  });

  if (!response || !response.content || response.content.length === 0) {
    throw new Error('Claude Vision returned empty response');
  }

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
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }

    if (parsed.length === 0) {
      // Empty page — return empty
      return [];
    }

    return parsed.map(section => ({
      sectionName: section.sectionName || 'UNKNOWN SECTION',
      content: section.content || '',
      pageReferences: section.pageNumber
        ? [section.pageNumber]
        : (Array.isArray(section.pageReferences) ? section.pageReferences : [startPage]),
      confidenceScore: typeof section.confidence === 'number'
        ? Math.max(0, Math.min(1, section.confidence))
        : (typeof section.confidenceScore === 'number'
          ? Math.max(0, Math.min(1, section.confidenceScore))
          : 0.75),
      flags: {
        hasDosageTable: section.flags?.hasDosageTable || false,
        hasChemicalFormula: section.flags?.hasChemicalFormula || false,
        hasWarningBox: section.flags?.hasWarningBox || false,
        isContinuedFromPrevious: section.flags?.isContinuedFromPrevious || false,
        continuesOnNext: section.flags?.continuesOnNext || false,
      }
    }));

  } catch (error) {
    console.error('Failed to parse Claude Vision response', {
      error: error.message,
      responseText: responseText.substring(0, 200)
    });

    throw new Error(`Failed to parse Claude response: ${error.message}`);
  }
}

/**
 * Merge sections that span across pages using continuation flags.
 * When page N has continuesOnNext: true and page N+1 has
 * isContinuedFromPrevious: true for the same section name, merge them.
 */
function mergeSectionsWithContinuation(sections) {
  const merged = [];
  let pendingContinuation = null;

  for (const section of sections) {
    if (section.flags.isContinuedFromPrevious && pendingContinuation) {
      // This section continues the pending one — merge
      pendingContinuation.content += '\n' + section.content;
      pendingContinuation.pageReferences = [
        ...new Set([...pendingContinuation.pageReferences, ...section.pageReferences])
      ].sort((a, b) => a - b);
      pendingContinuation.confidenceScore =
        (pendingContinuation.confidenceScore + section.confidenceScore) / 2;
      // Merge flags (OR logic for content flags)
      pendingContinuation.flags.hasDosageTable =
        pendingContinuation.flags.hasDosageTable || section.flags.hasDosageTable;
      pendingContinuation.flags.hasChemicalFormula =
        pendingContinuation.flags.hasChemicalFormula || section.flags.hasChemicalFormula;
      pendingContinuation.flags.hasWarningBox =
        pendingContinuation.flags.hasWarningBox || section.flags.hasWarningBox;

      if (!section.flags.continuesOnNext) {
        // Continuation chain complete — finalize
        pendingContinuation.flags.isContinuedFromPrevious = false;
        pendingContinuation.flags.continuesOnNext = false;
        merged.push(pendingContinuation);
        pendingContinuation = null;
      }
      // else: chain continues, keep pendingContinuation
    } else {
      // Flush any pending continuation that wasn't matched
      if (pendingContinuation) {
        pendingContinuation.flags.continuesOnNext = false;
        merged.push(pendingContinuation);
        pendingContinuation = null;
      }

      if (section.flags.continuesOnNext) {
        pendingContinuation = { ...section };
      } else {
        // Also check for same-name sections to merge (batch boundary)
        const existing = merged.find(m => m.sectionName === section.sectionName);
        if (existing) {
          existing.content += '\n' + section.content;
          existing.pageReferences = [
            ...new Set([...existing.pageReferences, ...section.pageReferences])
          ].sort((a, b) => a - b);
          existing.confidenceScore = (existing.confidenceScore + section.confidenceScore) / 2;
          existing.flags.hasDosageTable = existing.flags.hasDosageTable || section.flags.hasDosageTable;
          existing.flags.hasChemicalFormula = existing.flags.hasChemicalFormula || section.flags.hasChemicalFormula;
          existing.flags.hasWarningBox = existing.flags.hasWarningBox || section.flags.hasWarningBox;
        } else {
          merged.push({ ...section });
        }
      }
    }
  }

  // Flush final pending
  if (pendingContinuation) {
    pendingContinuation.flags.continuesOnNext = false;
    merged.push(pendingContinuation);
  }

  return merged;
}

/**
 * Mock extraction for development/testing
 */
function mockExtraction(document, pageImages) {
  console.warn('Using mock Claude Vision - replace with actual API in production');

  const sections = [
    {
      sectionName: 'PRODUCT NAME',
      content: `${document.productName || 'Pharmaceutical Product'}\nPatient Information Leaflet`,
      pageReferences: [1],
      confidenceScore: 0.94,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'ACTIVE INGREDIENTS',
      content: 'Active pharmaceutical ingredient: As specified in product name\nExcipients: Standard pharmaceutical excipients',
      pageReferences: [1, 2],
      confidenceScore: 0.91,
      flags: { hasDosageTable: false, hasChemicalFormula: true, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'THERAPEUTIC INDICATIONS',
      content: 'Indicated for treatment of conditions as approved by regulatory authorities in target markets.',
      pageReferences: [2],
      confidenceScore: 0.87,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'DOSAGE AND ADMINISTRATION',
      content: 'Recommended dosage: 250mg once daily\nAdministration route: Oral\nTiming: Take with food\n\nDosage Table:\n| Condition | Dose | Frequency |\n| Standard | 250mg | Once daily |\n| Adjusted | 125mg | Once daily |',
      pageReferences: [2, 3],
      confidenceScore: 0.89,
      flags: { hasDosageTable: true, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'CONTRAINDICATIONS',
      content: 'Contraindicated in:\n- Known hypersensitivity to the active substance\n- Severe hepatic impairment (Child-Pugh C)\n- Pregnancy and women of childbearing potential not using contraception',
      pageReferences: [3],
      confidenceScore: 0.86,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'WARNINGS AND PRECAUTIONS',
      content: 'WARNING: May cause severe hepatotoxicity.\nMonitor liver function tests before and during treatment.\n- Hepatotoxicity: ALT/AST monitoring required\n- Hypertension: Blood pressure monitoring\n- Adrenal insufficiency: Monitor for signs\n- Special populations (elderly, pediatric): Use with caution',
      pageReferences: [3, 4],
      confidenceScore: 0.84,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'UNDESIRABLE EFFECTS',
      content: 'Very common (≥1/10): fatigue, arthralgia, peripheral oedema\nCommon (≥1/100): urinary tract infection, hypokalaemia\nUncommon (≥1/1,000): adrenal insufficiency, cardiac failure',
      pageReferences: [4, 5],
      confidenceScore: 0.88,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    },
    {
      sectionName: 'STORAGE CONDITIONS',
      content: 'Store below 30°C\nStore in the original package to protect from moisture\nKeep out of the sight and reach of children',
      pageReferences: [5],
      confidenceScore: 0.92,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false }
    }
  ];

  return {
    sections,
    pageImages
  };
}
