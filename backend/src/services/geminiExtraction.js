/**
 * Gemini PDF Extraction Service
 *
 * Uses Vertex AI in us-central1 for Gemini 2.5 Pro access.
 * 1M token context window — eliminates chunking, truncation, and JSON repair.
 * One call. Full document. Complete extraction.
 *
 * Authentication: Application Default Credentials (ADC) on Cloud Run.
 * Confirmed working: us-central1 endpoint with gemini-2.5-pro model.
 */
import { VertexAI } from '@google-cloud/vertexai';

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'lyl-poc-1';
const GCP_LOCATION = 'us-central1'; // Confirmed working — gemini-2.5-pro available here
const GEMINI_MODEL = 'gemini-2.5-pro';

let model = null;

try {
  const vertexAI = new VertexAI({ project: GCP_PROJECT, location: GCP_LOCATION });
  model = vertexAI.preview.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: 65536,
      temperature: 0.0,
      // No responseMimeType — let Gemini output freely, we parse JSON from response
    },
  });
  console.log(`[GeminiExtraction] ✓ Initialized, model: ${GEMINI_MODEL}, location: ${GCP_LOCATION}`);
} catch (e) {
  console.warn(`[GeminiExtraction] ⚠ Init failed: ${e.message}`);
}

/**
 * Check if Gemini is available
 */
export function isGeminiAvailable() {
  return model !== null;
}

/**
 * Extract structured content from a PDF using Gemini.
 * Single call — no chunking, no truncation, no JSON repair.
 */
export async function extractPdfWithGemini(pdfBuffer, options = {}) {
  if (!model) {
    throw new Error('Gemini not initialized — check GCP credentials');
  }

  const pdfBase64 = pdfBuffer.toString('base64');
  const prompt = buildGeminiExtractionPrompt(options);

  console.log(`[GeminiExtraction] Starting extraction, PDF size: ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  const startTime = Date.now();

  try {
    const request = {
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } },
          { text: prompt }
        ]
      }],
    };

    const responseStream = await model.generateContent(request);
    const response = await responseStream.response;

    if (!response?.candidates?.length) {
      throw new Error('Gemini returned no candidates');
    }

    let responseText = response.candidates[0].content.parts[0].text;

    // Strip markdown code blocks if present
    if (responseText.includes('```json')) {
      responseText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (responseText.includes('```')) {
      responseText = responseText.replace(/```\n?/g, '');
    }
    responseText = responseText.trim();

    let parsed;
    try {
      parsed = JSON.parse(responseText);
    } catch (parseErr) {
      // Try to extract JSON object from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        console.error('[GeminiExtraction] Could not parse response:', responseText.substring(0, 500));
        throw new Error('Failed to parse Gemini response as JSON');
      }
    }

    console.log(`[GeminiExtraction] Raw response keys: ${Object.keys(parsed)}, sections: ${(parsed.sections || []).length}`);

    // Normalize to standard format
    const rawSections = parsed.sections || (Array.isArray(parsed) ? parsed : []);
    const rawDiagrams = parsed.diagrams || [];

    const sections = rawSections.map(s => ({
      sectionName: s.sectionName || s.name || s.title || 'UNKNOWN',
      content: s.content || s.text || '',
      pageReferences: s.pageNumber ? [s.pageNumber]
        : (Array.isArray(s.pageReferences) ? s.pageReferences : [1]),
      confidenceScore: typeof s.confidence === 'number'
        ? Math.max(0, Math.min(1, s.confidence))
        : 0.90,
      flags: {
        hasDosageTable: s.flags?.hasDosageTable || s.hasDosageTable || false,
        hasChemicalFormula: s.flags?.hasChemicalFormula || s.hasChemicalFormula || false,
        hasWarningBox: s.flags?.hasWarningBox || false,
        isContinuedFromPrevious: false,
        continuesOnNext: false,
        crossRefResolved: s.flags?.crossRefResolved || false,
        originalRef: s.flags?.originalRef || null,
      }
    }));

    const diagrams = rawDiagrams.map(d => ({
      type: d.type || 'table',
      description: d.description || '',
      pageNumber: d.pageNumber || d.page || 1,
      coordinates: d.coordinates || null,
      relatedSection: d.relatedSection || ''
    }));

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GeminiExtraction] ✓ Complete: ${sections.length} sections, ${diagrams.length} diagrams in ${elapsed}s`);

    return { sections, diagrams };

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[GeminiExtraction] ✗ Failed after ${elapsed}s:`, error.message);
    throw new Error(`Gemini PDF extraction failed: ${error.message}`);
  }
}

/**
 * Build the extraction prompt for Gemini.
 */
function buildGeminiExtractionPrompt(options = {}) {
  return `You are a pharmaceutical regulatory document expert extracting structured data from a regulatory document.

IMPORTANT: Return a JSON object with a "sections" array containing ONE OBJECT PER SECTION. Each section MUST be a separate entry in the array. Do NOT merge all content into one section. A typical SmPC has 20-30 separate sections.

This document may be an EPAR, SmPC, or PIL.

CRITICAL: If this document contains BOTH a Summary of Product Characteristics (SmPC, detailed prescribing information, typically sections numbered 1-13 with subsections like 4.1-4.9, 5.1-5.3, 6.1-6.6) AND a Patient Information Leaflet (simplified consumer version at the end, typically "What X is and what it is used for"), extract from the SmPC (the DETAILED version), NOT the consumer PIL.

Extract ALL SmPC sections with their COMPLETE content. Do NOT summarize — include every paragraph, every number, every table row, every footnote.

For each section return:
{
  "sectionName": "exact section heading including number (e.g. '4.2 Posology and method of administration')",
  "content": "COMPLETE text content of this section — every single paragraph, table, number, footnote. Preserve all dosage values, percentages, p-values, confidence intervals, chemical formulas exactly.",
  "pageNumber": <page number where section starts>,
  "confidence": <0.0-1.0 your confidence in extraction accuracy>,
  "hasDosageTable": true/false,
  "hasChemicalFormula": true/false
}

Also identify diagrams, charts, chemical structures, and data tables:
{
  "type": "chemical_structure" | "dosage_chart" | "flow_diagram" | "table",
  "description": "what it shows",
  "pageNumber": <page>,
  "relatedSection": "section name this diagram belongs to"
}

SmPC sections to extract (include ALL that exist):
1. Name of the medicinal product
2. Qualitative and quantitative composition
3. Pharmaceutical form
4.1 Therapeutic indications
4.2 Posology and method of administration
4.3 Contraindications
4.4 Special warnings and precautions for use
4.5 Interaction with other medicinal products
4.6 Fertility, pregnancy and lactation
4.7 Effects on ability to drive
4.8 Undesirable effects
4.9 Overdose
5.1 Pharmacodynamic properties (including ALL clinical trial results with statistical data)
5.2 Pharmacokinetic properties
5.3 Preclinical safety data
6.1 List of excipients
6.2 Incompatibilities
6.3 Shelf life
6.4 Special precautions for storage
6.5 Nature and contents of container
6.6 Special precautions for disposal

Rules:
- Preserve ALL text exactly as printed including numbers, units, chemical names
- For tables: extract as structured text preserving column headers and all row data
- For chemical formulas: preserve subscripts (C26H33NO2)
- Include cross-references as-is (e.g. "see section 4.4")
- Include BOTH 250mg and 500mg strength information where applicable
- Confidence < 0.85 means uncertain — flag it

Return JSON object:
{
  "sections": [ ... ],
  "diagrams": [ ... ]
}`;
}
