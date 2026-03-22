import { convertPdfToImages } from '../utils/pdfToImage.js';

// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
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
 *
 * Now also extracts:
 * - Diagrams, charts, chemical structures, tables (Change 2)
 * - Cross-reference resolution (Change 4)
 */
export async function extractWithClaudeVision(document, options = {}) {
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
    const result = await Promise.race([
      processBatchesWithClaude(client, pageImages, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude Vision extraction timeout')), EXTRACTION_TIMEOUT_MS)
      )
    ]);

    // Validate critical sections are present (skip for market format docs)
    if (!options.skipCriticalValidation) {
      validateCriticalSections(result.sections);
    }

    return {
      sections: result.sections,
      diagrams: result.diagrams,
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
async function processBatchesWithClaude(client, pageImages, options = {}) {
  const allSections = [];
  const allDiagrams = [];
  const batchSize = 5; // Process 5 pages at a time

  for (let i = 0; i < pageImages.length; i += batchSize) {
    const batchImages = pageImages.slice(i, i + batchSize);
    const batchStartPage = i + 1;

    console.info('Processing batch with Claude Vision', {
      batchStartPage,
      batchSize: batchImages.length
    });

    // Process batch with timeout
    const batchResult = await Promise.race([
      processSingleBatch(client, batchImages, batchStartPage, options),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude Vision batch timeout')), BATCH_TIMEOUT_MS)
      )
    ]);

    allSections.push(...batchResult.sections);
    allDiagrams.push(...batchResult.diagrams);
  }

  // Merge sections that span across pages using continuation flags
  const mergedSections = mergeSectionsWithContinuation(allSections);

  if (mergedSections.length === 0) {
    throw new Error('No sections extracted after merging');
  }

  return {
    sections: mergedSections,
    diagrams: allDiagrams
  };
}

/**
 * Build the extraction prompt with diagram extraction + cross-reference resolution
 */
function buildExtractionPrompt(batchStartPage, batchEndPage, options = {}) {
  const marketTemplateSection = options.marketTemplate
    ? `\nTARGET MARKET SECTIONS (map extracted content to these):
${JSON.stringify(options.marketTemplate.sections, null, 2)}
Map source document content to each target section. If a section is not found in the source, mark as MISSING. If content doesn't map cleanly, mark as NEEDS_REVIEW.`
    : '';

  return `You are a pharmaceutical regulatory document expert analyzing Patient Information Leaflet (PIL) pages.

Extract ALL sections visible on these pages. For each section return:
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

DIAGRAMS AND VISUAL ELEMENTS:
For each diagram, chart, chemical structure, or visual table found on these pages, also include in a separate "diagrams" array:
{
  "type": "chemical_structure" | "dosage_chart" | "flow_diagram" | "table",
  "description": "Brief description of the visual element (e.g., Chemical structure of abiraterone acetate (C₂₄H₃₁NO₂))",
  "pageNumber": <page number where found>,
  "coordinates": { "ymin": 0.0-1.0, "xmin": 0.0-1.0, "ymax": 0.0-1.0, "xmax": 0.0-1.0 },
  "relatedSection": "section heading this diagram belongs to"
}

CROSS-REFERENCE RESOLUTION:
IMPORTANT: If any extracted text contains internal references like 'see section 6.1', 'listed in Annexure II', 'as described in section 4.4', you MUST:
1. Find that referenced section in the same document
2. Extract the actual content from the referenced section
3. Replace the reference with the real content inline
4. Flag in the section metadata: add "crossRefResolved": true and "originalRef": "section 6.1" to the flags object
The output PIL must be STANDALONE. No 'see section X' references should remain in the final extracted content.
${marketTemplateSection}

Page range: ${batchStartPage} to ${batchEndPage}

Rules:
- Preserve ALL text exactly as printed, including numbers, units, chemical names
- For dosage tables, extract as structured data (rows and columns), not flattened text
- For chemical formulas, preserve subscripts and special characters
- Mark sections that span across pages with continuation flags
- If text is in multiple languages, extract ALL languages present
- Confidence < 0.85 means you're uncertain — flag it

Return ONLY a JSON object with this structure:
{
  "sections": [ ... array of section objects ... ],
  "diagrams": [ ... array of diagram objects ... ]
}
Do not wrap in markdown code blocks.`;
}

/**
 * Process a single batch of pages with the spec extraction prompt
 */
async function processSingleBatch(client, batchImages, batchStartPage, options = {}) {
  const imageMessages = batchImages.map((img) => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: img.imageBase64
    }
  }));

  const batchEndPage = batchStartPage + batchImages.length - 1;
  const prompt = buildExtractionPrompt(batchStartPage, batchEndPage, options);

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
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
  return parseClaudeResponseWithDiagrams(responseText, batchStartPage);
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
 * Parse Claude's JSON response that includes both sections and diagrams
 */
function parseClaudeResponseWithDiagrams(responseText, startPage) {
  try {
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    // Handle both old format (array) and new format ({ sections, diagrams })
    let rawSections, rawDiagrams;
    if (Array.isArray(parsed)) {
      rawSections = parsed;
      rawDiagrams = [];
    } else {
      rawSections = parsed.sections || [];
      rawDiagrams = parsed.diagrams || [];
    }

    const sections = rawSections.map(section => ({
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
        crossRefResolved: section.flags?.crossRefResolved || false,
        originalRef: section.flags?.originalRef || null,
      }
    }));

    const diagrams = rawDiagrams.map(d => ({
      type: d.type || 'table',
      description: d.description || '',
      pageNumber: d.pageNumber || startPage,
      coordinates: d.coordinates || { ymin: 0, xmin: 0, ymax: 1, xmax: 1 },
      relatedSection: d.relatedSection || null
    }));

    return { sections, diagrams };

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
      pendingContinuation.flags.crossRefResolved =
        pendingContinuation.flags.crossRefResolved || section.flags.crossRefResolved;

      if (!section.flags.continuesOnNext) {
        pendingContinuation.flags.isContinuedFromPrevious = false;
        pendingContinuation.flags.continuesOnNext = false;
        merged.push(pendingContinuation);
        pendingContinuation = null;
      }
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
          existing.flags.crossRefResolved = existing.flags.crossRefResolved || section.flags.crossRefResolved;
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
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'ACTIVE INGREDIENTS',
      content: 'Active pharmaceutical ingredient: As specified in product name\nExcipients: Standard pharmaceutical excipients',
      pageReferences: [1, 2],
      confidenceScore: 0.91,
      flags: { hasDosageTable: false, hasChemicalFormula: true, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'THERAPEUTIC INDICATIONS',
      content: 'Indicated for treatment of conditions as approved by regulatory authorities in target markets.',
      pageReferences: [2],
      confidenceScore: 0.87,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'DOSAGE AND ADMINISTRATION',
      content: 'Recommended dosage: 250mg once daily\nAdministration route: Oral\nTiming: Take with food\n\nDosage Table:\n| Condition | Dose | Frequency |\n| Standard | 250mg | Once daily |\n| Adjusted | 125mg | Once daily |',
      pageReferences: [2, 3],
      confidenceScore: 0.89,
      flags: { hasDosageTable: true, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'CONTRAINDICATIONS',
      content: 'Contraindicated in:\n- Known hypersensitivity to the active substance\n- Severe hepatic impairment (Child-Pugh C)\n- Pregnancy and women of childbearing potential not using contraception',
      pageReferences: [3],
      confidenceScore: 0.86,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'WARNINGS AND PRECAUTIONS',
      content: 'WARNING: May cause severe hepatotoxicity.\nMonitor liver function tests before and during treatment.\n- Hepatotoxicity: ALT/AST monitoring required\n- Hypertension: Blood pressure monitoring\n- Adrenal insufficiency: Monitor for signs\n- Special populations (elderly, pediatric): Use with caution',
      pageReferences: [3, 4],
      confidenceScore: 0.84,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'UNDESIRABLE EFFECTS',
      content: 'Very common (≥1/10): fatigue, arthralgia, peripheral oedema\nCommon (≥1/100): urinary tract infection, hypokalaemia\nUncommon (≥1/1,000): adrenal insufficiency, cardiac failure',
      pageReferences: [4, 5],
      confidenceScore: 0.88,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'STORAGE CONDITIONS',
      content: 'Store below 30°C\nStore in the original package to protect from moisture\nKeep out of the sight and reach of children',
      pageReferences: [5],
      confidenceScore: 0.92,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    }
  ];

  const diagrams = [
    {
      type: 'chemical_structure',
      description: 'Chemical structure diagram of active pharmaceutical ingredient',
      pageNumber: 1,
      coordinates: { ymin: 0.3, xmin: 0.2, ymax: 0.6, xmax: 0.8 },
      relatedSection: 'ACTIVE INGREDIENTS'
    },
    {
      type: 'dosage_chart',
      description: 'Dosage adjustment table based on patient weight and condition',
      pageNumber: 3,
      coordinates: { ymin: 0.4, xmin: 0.1, ymax: 0.8, xmax: 0.9 },
      relatedSection: 'DOSAGE AND ADMINISTRATION'
    }
  ];

  return {
    sections,
    diagrams,
    pageImages
  };
}
