/**
 * Claude Vision Extraction Service
 *
 * Sends PDF directly to Claude Vision API as a document
 * (Claude supports native PDF input with media_type "application/pdf").
 * No image conversion needed — eliminates pdf-poppler dependency entirely.
 *
 * For Word documents, mammoth handles extraction in extractionRouter.js.
 */
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !CLAUDE_API_KEY;

// Initialize client at module scope (singleton)
let client = null;
if (CLAUDE_API_KEY) {
  client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  console.log('[ClaudeVision] ✓ Client initialized, model:', CLAUDE_MODEL);
} else {
  console.warn('[ClaudeVision] ⚠ No API key — mock mode active');
}

// Timeout configuration
const EXTRACTION_TIMEOUT_MS = 540000; // 9 minutes — large pharma docs can be 100+ pages

// Critical sections that must be present
const REQUIRED_CRITICAL_SECTIONS = [
  'DOSAGE AND ADMINISTRATION',
  'WARNINGS AND PRECAUTIONS',
  'CONTRAINDICATIONS',
  'ACTIVE INGREDIENTS'
];

/**
 * Extract document content using Claude Vision
 * Sends the entire PDF directly to Claude — no page-to-image conversion needed.
 */
export async function extractWithClaudeVision(document, options = {}) {
  console.info('[ClaudeVision] Starting extraction', {
    documentId: document.id,
    documentName: document.name,
    bufferSize: document.buffer?.length
  });

  if (USE_MOCK) {
    console.warn('[ClaudeVision] No API key — using mock extraction');
    return mockExtraction(document);
  }

  try {
    if (!client) {
      throw new Error('Anthropic client not initialized — check ANTHROPIC_API_KEY');
    }

    const pdfBase64 = document.buffer.toString('base64');
    const prompt = buildExtractionPrompt(options);

    const result = await Promise.race([
      sendPdfToClaude(client, pdfBase64, prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Claude Vision extraction timeout (60s)')), EXTRACTION_TIMEOUT_MS)
      )
    ]);

    // Merge sections that span across pages
    const mergedSections = mergeSectionsWithContinuation(result.sections);

    // Log extracted sections instead of hard-failing on missing English headings
    // Pharmaceutical docs in Thai/Chinese/other languages won't have English section names
    const sectionNames = mergedSections.map(s => s.sectionName);
    console.info('[ClaudeVision] Extracted sections:', sectionNames);

    if (mergedSections.length === 0) {
      throw new Error('No sections extracted from document');
    }

    console.info('[ClaudeVision] Extraction complete', {
      sections: mergedSections.length,
      diagrams: result.diagrams.length
    });

    return {
      sections: mergedSections,
      diagrams: result.diagrams,
      pageImages: [] // No page images when using native PDF — Claude reads the PDF directly
    };

  } catch (error) {
    console.error('[ClaudeVision] Extraction failed', {
      documentId: document.id,
      error: error.message
    });
    throw new Error(`Claude Vision extraction failed: ${error.message}`);
  }
}

/**
 * Send PDF directly to Claude as a document (native PDF support)
 */
async function sendPdfToClaude(client, pdfBase64, prompt) {
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 16384,
    messages: [{
      role: 'user',
      content: [
        {
          type: 'document',
          source: {
            type: 'base64',
            media_type: 'application/pdf',
            data: pdfBase64
          }
        },
        { type: 'text', text: prompt }
      ]
    }]
  });

  if (!response?.content?.length) {
    throw new Error('Claude returned empty response');
  }

  return parseClaudeResponse(response.content[0].text);
}

/**
 * Build the extraction prompt with diagram extraction + cross-reference resolution
 */
function buildExtractionPrompt(options = {}) {
  const marketTemplateSection = options.marketTemplate
    ? `\nTARGET MARKET SECTIONS (map extracted content to these):
${JSON.stringify(options.marketTemplate.sections, null, 2)}
Map source document content to each target section. If a section is not found in the source, mark as MISSING. If content doesn't map cleanly, mark as NEEDS_REVIEW.`
    : '';

  return `You are a pharmaceutical regulatory document expert. This document may be an EPAR, SmPC, or PIL.

CRITICAL: If this document contains BOTH a Summary of Product Characteristics (SmPC, detailed prescribing information, typically sections numbered 1-13) AND a Patient Information Leaflet (simplified consumer version, typically "What X is and what it is used for"), extract from the SmPC (the DETAILED version), NOT the consumer PIL. The SmPC has the complete clinical data needed for regulatory submissions.

Extract ALL sections with their FULL content (not summaries). For each section return:
{
  "sectionName": "exact section heading as printed",
  "content": "COMPLETE text content — every paragraph, every number, every table",
  "pageNumber": <page number where section starts>,
  "confidence": <0.0-1.0 your confidence in extraction accuracy>,
  "flags": {
    "hasDosageTable": true/false,
    "hasChemicalFormula": true/false,
    "hasWarningBox": true/false,
    "isContinuedFromPrevious": true/false,
    "continuesOnNext": true/false,
    "crossRefResolved": true/false,
    "originalRef": null or "section X.X" if cross-ref was resolved
  }
}

SmPC sections to look for (extract ALL that exist):
1. Name of the medicinal product
2. Qualitative and quantitative composition (active substance, molecular formula, excipients per strength)
3. Pharmaceutical form
4. Clinical particulars
  4.1 Therapeutic indications (exact approved indications)
  4.2 Posology and method of administration (all dosing regimens, dose adjustments, hepatic impairment thresholds)
  4.3 Contraindications
  4.4 Special warnings and precautions (EVERY subsection: hepatotoxicity, cardiovascular, adrenal insufficiency, etc.)
  4.5 Interaction with other medicinal products (CYP3A4, CYP2D6, CYP2C8 with specific drug names)
  4.6 Fertility, pregnancy and lactation
  4.7 Effects on ability to drive
  4.8 Undesirable effects (clinical trial data with percentages, Grade 3-4 events, SOC grouping)
  4.9 Overdose
5. Pharmacological properties
  5.1 Pharmacodynamic properties (mechanism, clinical trial results with HR/CI/p-values)
  5.2 Pharmacokinetic properties (absorption, food effect, distribution, metabolism, elimination)
  5.3 Preclinical safety data
6. Pharmaceutical particulars (storage, packaging, both strengths if applicable)

Preserve ALL numbers: dosages, percentages, p-values, confidence intervals, hazard ratios.
Include BOTH strengths (e.g., 250mg and 500mg) where applicable.

DIAGRAMS AND VISUAL ELEMENTS:
For each diagram, chart, chemical structure, or visual table found, include in a separate "diagrams" array:
{
  "type": "chemical_structure" | "dosage_chart" | "flow_diagram" | "table",
  "description": "Brief description (e.g., Chemical structure of abiraterone acetate (C₂₄H₃₁NO₂))",
  "pageNumber": <page number>,
  "coordinates": { "ymin": 0.0-1.0, "xmin": 0.0-1.0, "ymax": 0.0-1.0, "xmax": 0.0-1.0 },
  "relatedSection": "section heading this diagram belongs to"
}

CROSS-REFERENCE RESOLUTION:
If any text contains internal references like 'see section 6.1', 'listed in Annexure II':
1. Find that referenced section in the same document
2. Extract the actual content from the referenced section
3. Replace the reference with the real content inline
4. Set crossRefResolved: true and originalRef: "section 6.1" in flags
The output must be STANDALONE.
${marketTemplateSection}

Rules:
- Preserve ALL text exactly as printed, including numbers, units, chemical names
- For dosage tables, extract as structured data (rows and columns), not flattened text
- For chemical formulas, preserve subscripts and special characters
- Mark sections that span across pages with continuation flags
- If text is in multiple languages, extract ALL languages present
- Confidence < 0.85 means you're uncertain — flag it

Return ONLY a JSON object (no markdown code blocks):
{
  "sections": [ ... ],
  "diagrams": [ ... ]
}`;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(responseText) {
  try {
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
    }

    const parsed = JSON.parse(jsonText);

    // Handle both array (old format) and object (new format)
    let rawSections, rawDiagrams;
    if (Array.isArray(parsed)) {
      rawSections = parsed;
      rawDiagrams = [];
    } else {
      rawSections = parsed.sections || [];
      rawDiagrams = parsed.diagrams || [];
    }

    const sections = rawSections.map(s => ({
      sectionName: s.sectionName || 'UNKNOWN SECTION',
      content: s.content || '',
      pageReferences: s.pageNumber ? [s.pageNumber]
        : (Array.isArray(s.pageReferences) ? s.pageReferences : [1]),
      confidenceScore: typeof s.confidence === 'number'
        ? Math.max(0, Math.min(1, s.confidence))
        : (typeof s.confidenceScore === 'number'
          ? Math.max(0, Math.min(1, s.confidenceScore))
          : 0.75),
      flags: {
        hasDosageTable: s.flags?.hasDosageTable || false,
        hasChemicalFormula: s.flags?.hasChemicalFormula || false,
        hasWarningBox: s.flags?.hasWarningBox || false,
        isContinuedFromPrevious: s.flags?.isContinuedFromPrevious || false,
        continuesOnNext: s.flags?.continuesOnNext || false,
        crossRefResolved: s.flags?.crossRefResolved || false,
        originalRef: s.flags?.originalRef || null,
      }
    }));

    const diagrams = rawDiagrams.map(d => ({
      type: d.type || 'table',
      description: d.description || '',
      pageNumber: d.pageNumber || 1,
      coordinates: d.coordinates || { ymin: 0, xmin: 0, ymax: 1, xmax: 1 },
      relatedSection: d.relatedSection || null
    }));

    return { sections, diagrams };

  } catch (error) {
    console.error('[ClaudeVision] Failed to parse response', {
      error: error.message,
      preview: responseText.substring(0, 200)
    });
    throw new Error(`Failed to parse Claude response: ${error.message}`);
  }
}

/**
 * Validate critical sections are present
 */
function validateCriticalSections(sections) {
  const names = sections.map(s => s.sectionName.toUpperCase());
  const missing = REQUIRED_CRITICAL_SECTIONS.filter(req =>
    !names.some(n => n.includes(req) || req.includes(n))
  );

  if (missing.length > 0) {
    console.error('[ClaudeVision] Critical sections missing:', missing);
    throw new Error(`Critical sections missing: ${missing.join(', ')}`);
  }
}

/**
 * Merge sections that span across pages using continuation flags
 */
function mergeSectionsWithContinuation(sections) {
  const merged = [];
  let pending = null;

  for (const section of sections) {
    if (section.flags.isContinuedFromPrevious && pending) {
      pending.content += '\n' + section.content;
      pending.pageReferences = [...new Set([...pending.pageReferences, ...section.pageReferences])].sort((a, b) => a - b);
      pending.confidenceScore = (pending.confidenceScore + section.confidenceScore) / 2;
      pending.flags.hasDosageTable = pending.flags.hasDosageTable || section.flags.hasDosageTable;
      pending.flags.hasChemicalFormula = pending.flags.hasChemicalFormula || section.flags.hasChemicalFormula;
      pending.flags.hasWarningBox = pending.flags.hasWarningBox || section.flags.hasWarningBox;
      pending.flags.crossRefResolved = pending.flags.crossRefResolved || section.flags.crossRefResolved;

      if (!section.flags.continuesOnNext) {
        pending.flags.isContinuedFromPrevious = false;
        pending.flags.continuesOnNext = false;
        merged.push(pending);
        pending = null;
      }
    } else {
      if (pending) {
        pending.flags.continuesOnNext = false;
        merged.push(pending);
        pending = null;
      }

      if (section.flags.continuesOnNext) {
        pending = { ...section };
      } else {
        const existing = merged.find(m => m.sectionName === section.sectionName);
        if (existing) {
          existing.content += '\n' + section.content;
          existing.pageReferences = [...new Set([...existing.pageReferences, ...section.pageReferences])].sort((a, b) => a - b);
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

  if (pending) {
    pending.flags.continuesOnNext = false;
    merged.push(pending);
  }

  return merged;
}

/**
 * Mock extraction for development (no API key)
 */
function mockExtraction(document) {
  const sections = [
    {
      sectionName: 'PRODUCT NAME',
      content: `${document.productName || 'Pharmaceutical Product'}\nPatient Information Leaflet`,
      pageReferences: [1], confidenceScore: 0.94,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'ACTIVE INGREDIENTS',
      content: 'Active pharmaceutical ingredient: As specified in product name\nExcipients: Standard pharmaceutical excipients',
      pageReferences: [1, 2], confidenceScore: 0.91,
      flags: { hasDosageTable: false, hasChemicalFormula: true, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'THERAPEUTIC INDICATIONS',
      content: 'Indicated for treatment of conditions as approved by regulatory authorities.',
      pageReferences: [2], confidenceScore: 0.87,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'DOSAGE AND ADMINISTRATION',
      content: 'Recommended dosage: 250mg once daily\nAdministration route: Oral\nTiming: Take with food\n\nDosage Table:\n| Condition | Dose | Frequency |\n| Standard | 250mg | Once daily |\n| Adjusted | 125mg | Once daily |',
      pageReferences: [2, 3], confidenceScore: 0.89,
      flags: { hasDosageTable: true, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'CONTRAINDICATIONS',
      content: 'Contraindicated in:\n- Known hypersensitivity to the active substance\n- Severe hepatic impairment (Child-Pugh C)\n- Pregnancy and women of childbearing potential not using contraception',
      pageReferences: [3], confidenceScore: 0.86,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'WARNINGS AND PRECAUTIONS',
      content: 'WARNING: May cause severe hepatotoxicity.\nMonitor liver function tests before and during treatment.\n- Hepatotoxicity: ALT/AST monitoring required\n- Hypertension: Blood pressure monitoring\n- Adrenal insufficiency: Monitor for signs',
      pageReferences: [3, 4], confidenceScore: 0.84,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: true, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'UNDESIRABLE EFFECTS',
      content: 'Very common (≥1/10): fatigue, arthralgia, peripheral oedema\nCommon (≥1/100): urinary tract infection, hypokalaemia\nUncommon (≥1/1,000): adrenal insufficiency, cardiac failure',
      pageReferences: [4, 5], confidenceScore: 0.88,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    },
    {
      sectionName: 'STORAGE CONDITIONS',
      content: 'Store below 30°C\nStore in the original package to protect from moisture\nKeep out of the sight and reach of children',
      pageReferences: [5], confidenceScore: 0.92,
      flags: { hasDosageTable: false, hasChemicalFormula: false, hasWarningBox: false, isContinuedFromPrevious: false, continuesOnNext: false, crossRefResolved: false, originalRef: null }
    }
  ];

  const diagrams = [
    { type: 'chemical_structure', description: 'Chemical structure of active ingredient', pageNumber: 1, coordinates: { ymin: 0.3, xmin: 0.2, ymax: 0.6, xmax: 0.8 }, relatedSection: 'ACTIVE INGREDIENTS' },
    { type: 'dosage_chart', description: 'Dosage adjustment table', pageNumber: 3, coordinates: { ymin: 0.4, xmin: 0.1, ymax: 0.8, xmax: 0.9 }, relatedSection: 'DOSAGE AND ADMINISTRATION' }
  ];

  return { sections, diagrams, pageImages: [] };
}
