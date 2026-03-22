/**
 * Gemini PDF Extraction Service
 *
 * Uses Vertex AI Gemini 2.5 Pro in us-central1 for PDF extraction.
 * 1M token context window — eliminates chunking, truncation, and JSON repair.
 * Uses responseSchema to force structured output — no regex parsing.
 *
 * Authentication: Application Default Credentials (ADC) on Cloud Run.
 */
import { VertexAI, Type } from '@google-cloud/vertexai';

const GCP_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCP_PROJECT || 'lyl-poc-1';
const GCP_LOCATION = 'us-central1';
const GEMINI_MODEL = 'gemini-2.5-pro';

let model = null;

try {
  const vertexAI = new VertexAI({ project: GCP_PROJECT, location: GCP_LOCATION });
  model = vertexAI.preview.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      maxOutputTokens: 65536,
      temperature: 0.0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            sectionTitle: { type: Type.STRING, description: 'Exact section heading including number, e.g. "4.2 Posology and method of administration"' },
            content: { type: Type.STRING, description: 'Complete section text. Every paragraph, table (as markdown), number, footnote. No summarizing.' },
            pageNumber: { type: Type.INTEGER, description: 'Page number where this section starts' },
            confidence: { type: Type.NUMBER, description: 'Extraction confidence 0.0-1.0' },
            hasDosageTable: { type: Type.BOOLEAN },
            hasChemicalFormula: { type: Type.BOOLEAN },
            isDiagram: { type: Type.BOOLEAN, description: 'True if this entry describes a diagram/chart/table figure rather than text content' },
            diagramDescription: { type: Type.STRING, description: 'If isDiagram=true, describe what the diagram shows' },
          },
          required: ['sectionTitle', 'content']
        }
      }
    },
  });
  console.log(`[GeminiExtraction] ✓ Initialized, model: ${GEMINI_MODEL}, location: ${GCP_LOCATION}, schema: enforced`);
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
 * Single call — no chunking, no truncation. Schema-enforced output.
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

    const responseText = response.candidates[0].content.parts[0].text;

    // responseSchema guarantees valid JSON array
    const parsed = JSON.parse(responseText);

    // Separate sections from diagrams
    const rawSections = [];
    const rawDiagrams = [];

    const items = Array.isArray(parsed) ? parsed : (parsed.sections || [parsed]);

    for (const item of items) {
      if (item.isDiagram) {
        rawDiagrams.push({
          type: 'table',
          description: item.diagramDescription || item.content || '',
          pageNumber: item.pageNumber || 1,
          coordinates: null,
          relatedSection: item.sectionTitle || ''
        });
      } else {
        rawSections.push({
          sectionName: item.sectionTitle || item.sectionName || 'UNKNOWN',
          content: item.content || '',
          pageReferences: item.pageNumber ? [item.pageNumber] : [1],
          confidenceScore: typeof item.confidence === 'number'
            ? Math.max(0, Math.min(1, item.confidence))
            : 0.90,
          flags: {
            hasDosageTable: item.hasDosageTable || false,
            hasChemicalFormula: item.hasChemicalFormula || false,
            hasWarningBox: false,
            isContinuedFromPrevious: false,
            continuesOnNext: false,
            crossRefResolved: false,
            originalRef: null,
          }
        });
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[GeminiExtraction] ✓ Complete: ${rawSections.length} sections, ${rawDiagrams.length} diagrams in ${elapsed}s`);

    return { sections: rawSections, diagrams: rawDiagrams };

  } catch (error) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`[GeminiExtraction] ✗ Failed after ${elapsed}s:`, error.message);
    throw new Error(`Gemini PDF extraction failed: ${error.message}`);
  }
}

/**
 * Build the extraction prompt — treats PDF as visual document.
 */
function buildGeminiExtractionPrompt(options = {}) {
  return `# ROLE
You are a Senior Regulatory Affairs Specialist at Lotus Pharmaceutical. Your task is to perform a High-Fidelity Multimodal Extraction of this pharmaceutical regulatory document.

# OBJECTIVE
Extract EVERY section of this PDF into a structured JSON array. You must preserve the semantic meaning and technical precision required for a Taiwan FDA (TFDA) submission.

# DOCUMENT TYPE
This document likely contains BOTH:
- Summary of Product Characteristics (SmPC) — detailed prescribing information, sections 1-13 with subsections 4.1-4.9, 5.1-5.3, 6.1-6.6
- Patient Information Leaflet (PIL) — simplified consumer version at the end

Extract ONLY from the SmPC (the DETAILED version). Do NOT extract the consumer PIL.

# EXTRACTION RULES
1. **Visual Hierarchy**: Use your vision capabilities to identify sections based on font size, bolding, numbering, and layout (e.g., section 4.1, 4.2). Each numbered section or subsection MUST be a SEPARATE entry in the output array.
2. **Table Preservation**: Convert all clinical trial results tables and dosage tables into Markdown-formatted strings within the 'content' field. Preserve all row/column relationships, percentages, p-values, confidence intervals.
3. **Strength Aggregation**: Identify all dosage strengths (e.g., 250mg and 500mg) and extract the specific properties and compositions for each.
4. **No Summarization**: Extract the FULL technical text. Do not paraphrase. Every paragraph, every number, every footnote.
5. **Chemical Formulas**: Preserve exactly as printed (C26H33NO2, molecular weights, etc.)
6. **Cross-References**: Include as-is (e.g., "see section 4.4")
7. **Diagrams**: For charts, chemical structures, Kaplan-Meier curves — set isDiagram=true and describe what the figure shows.

# SECTIONS TO EXTRACT (each as a SEPARATE array entry)
- 1. Name of the medicinal product
- 2. Qualitative and quantitative composition
- 3. Pharmaceutical form
- 4.1 Therapeutic indications
- 4.2 Posology and method of administration
- 4.3 Contraindications
- 4.4 Special warnings and precautions for use
- 4.5 Interaction with other medicinal products
- 4.6 Fertility, pregnancy and lactation
- 4.7 Effects on ability to drive and use machines
- 4.8 Undesirable effects (include ALL adverse reaction tables with frequencies)
- 4.9 Overdose
- 5.1 Pharmacodynamic properties (include ALL clinical trial data: COU-AA-301, COU-AA-302, LATITUDE with full statistical results)
- 5.2 Pharmacokinetic properties
- 5.3 Preclinical safety data
- 6.1 List of excipients
- 6.2 Incompatibilities
- 6.3 Shelf life
- 6.4 Special precautions for storage
- 6.5 Nature and contents of container
- 6.6 Special precautions for disposal

Each section MUST be a separate object in the array. A typical SmPC has 20-28 separate entries.`;
}
