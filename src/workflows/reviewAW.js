import { getDocumentById } from '../services/documentManager.js';
import { randomUUID } from 'crypto';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

/**
 * Review AW Workflow — end-to-end
 *
 * 1. Fetch both documents from the in-memory store
 * 2. AW Draft (PDF): convert pages → images with pdf-lib, send to
 *    Claude Vision to extract sections with confidence scores
 * 3. Approved PIL (Word .docx): extract raw text with mammoth,
 *    parse into named sections
 * 4. Send both section lists to Claude to detect deviations
 * 5. Return the deviation report
 */

// ---------- workflow entry point ----------

export async function executeReviewAW(awDraftId, approvedPilId, sessionId) {
  const workflowId = randomUUID();
  const startTime = Date.now();

  // 1. Get documents from in-memory store
  const awDraft = getDocumentById(awDraftId);
  if (!awDraft) throw new Error(`AW Draft document not found: ${awDraftId}`);

  const approvedPil = getDocumentById(approvedPilId);
  if (!approvedPil) throw new Error(`Approved PIL document not found: ${approvedPilId}`);

  console.log(`[ReviewAW] Starting workflow ${workflowId}`, {
    awDraft: awDraft.name,
    approvedPil: approvedPil.name,
  });

  // 2. Extract AW Draft PDF via Claude Vision
  const awBuffer = awDraft.buffer || awDraft.fileBlob;
  if (!awBuffer) throw new Error('AW Draft has no file data');

  console.log(`[ReviewAW] Extracting AW Draft (PDF) via Claude Vision`);
  const awSections = await extractPdfSections(awBuffer);

  // 3. Extract Approved PIL Word doc via mammoth
  const pilBuffer = approvedPil.buffer || approvedPil.fileBlob;
  if (!pilBuffer) throw new Error('Approved PIL has no file data');

  console.log(`[ReviewAW] Extracting Approved PIL (Word) via mammoth`);
  const approvedSections = await extractWordSections(pilBuffer);

  // 4. Detect deviations via Claude
  console.log(`[ReviewAW] Detecting deviations (${approvedSections.length} approved vs ${awSections.length} artwork sections)`);
  const deviations = await detectDeviations(approvedSections, awSections);

  // 5. Build and return result
  const executionTimeMs = Date.now() - startTime;

  const summary = {
    totalCritical: deviations.filter(d => d.severity === 'critical').length,
    totalMajor: deviations.filter(d => d.severity === 'major').length,
    totalMinor: deviations.filter(d => d.severity === 'minor').length,
  };

  const result = {
    workflowId,
    workflowType: 'review_aw',
    deviations,
    summary,
    executionTimeMs,
    executedDate: new Date().toISOString(),
    inputDocuments: [
      { id: awDraftId, name: awDraft.name, type: awDraft.type },
      { id: approvedPilId, name: approvedPil.name, type: approvedPil.type },
    ],
    extractionResults: [
      { documentId: awDraftId, provider: 'claude_vision', sections: awSections },
      { documentId: approvedPilId, provider: 'mammoth', sections: approvedSections },
    ],
  };

  console.log(`[ReviewAW] Workflow ${workflowId} completed in ${executionTimeMs}ms`, summary);
  return result;
}

// ---------- Step 2: PDF extraction via Claude Vision ----------

async function extractPdfSections(pdfBuffer) {
  // Convert PDF pages to base64 PNG images using pdf-lib
  const pageImages = await pdfToImages(pdfBuffer);

  if (!ANTHROPIC_API_KEY) {
    console.warn('[ReviewAW] No ANTHROPIC_API_KEY — returning mock PDF sections');
    return mockPdfSections();
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  // Send all pages (up to 20) to Claude Vision in one request
  const imageContent = pageImages.slice(0, 20).map(img => ({
    type: 'image',
    source: {
      type: 'base64',
      media_type: 'image/png',
      data: img.base64,
    },
  }));

  const prompt = `You are analyzing a pharmaceutical artwork (AW) draft PDF.
Extract every section you find. For each section return:
- sectionName (uppercase, e.g. "DOSAGE AND ADMINISTRATION")
- content (the full text of that section, preserving dosage info and chemical formulas exactly)
- pageReferences (array of 1-based page numbers where the section appears)
- confidenceScore (0.0-1.0 based on text clarity)

Return ONLY a JSON array, no markdown fences:
[{"sectionName":"...","content":"...","pageReferences":[1],"confidenceScore":0.95}]`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    messages: [{ role: 'user', content: [...imageContent, { type: 'text', text: prompt }] }],
  });

  return parseJsonArray(response.content[0].text);
}

/**
 * Convert PDF buffer to an array of { pageNumber, base64 } PNG images.
 * Uses pdf-lib to split into single-page PDFs, then renders via a
 * minimal canvas approach. Falls back to sending the whole PDF as-is
 * if rendering is unavailable.
 */
async function pdfToImages(pdfBuffer) {
  const { PDFDocument } = await import('pdf-lib');
  const srcDoc = await PDFDocument.load(pdfBuffer);
  const pageCount = srcDoc.getPageCount();

  const images = [];

  for (let i = 0; i < pageCount; i++) {
    // Create a single-page PDF
    const singleDoc = await PDFDocument.create();
    const [copied] = await singleDoc.copyPages(srcDoc, [i]);
    singleDoc.addPage(copied);
    const singlePdfBytes = await singleDoc.save();

    // Try pdf-poppler for PNG conversion; fall back to raw PDF base64
    try {
      const pngBase64 = await renderPageWithPoppler(singlePdfBytes, i + 1);
      images.push({ pageNumber: i + 1, base64: pngBase64 });
    } catch {
      // Fallback: encode the single-page PDF as base64 (Claude can read PDFs)
      images.push({
        pageNumber: i + 1,
        base64: Buffer.from(singlePdfBytes).toString('base64'),
      });
    }
  }

  console.log(`[ReviewAW] Converted PDF to ${images.length} page images`);
  return images;
}

async function renderPageWithPoppler(pdfBytes, pageNumber) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const os = await import('os');
  const { convert } = await import('pdf-poppler');

  const tmpDir = path.join(os.tmpdir(), `pil-${randomUUID()}`);
  const pdfPath = path.join(tmpDir, 'page.pdf');

  try {
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(pdfPath, pdfBytes);
    await convert(pdfPath, { format: 'png', out_dir: tmpDir, out_prefix: 'img', page: null });

    const files = (await fs.readdir(tmpDir)).filter(f => f.endsWith('.png')).sort();
    if (files.length === 0) throw new Error('No PNG produced');

    const imgBuf = await fs.readFile(path.join(tmpDir, files[0]));
    return imgBuf.toString('base64');
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ---------- Step 3: Word extraction via mammoth ----------

async function extractWordSections(docxBuffer) {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer: docxBuffer });
  const rawText = result.value;

  if (!rawText || rawText.trim().length === 0) {
    throw new Error('mammoth extracted no text from the Word document');
  }

  // Parse raw text into sections.
  // PIL Word docs typically have section headings in ALL CAPS on their own line.
  const lines = rawText.split('\n');
  const sections = [];
  let currentSection = null;

  const SECTION_HEADING_RE = /^[A-Z][A-Z\s&,/()-]{4,}$/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (SECTION_HEADING_RE.test(trimmed)) {
      // Start a new section
      if (currentSection && currentSection.content.trim()) {
        sections.push(currentSection);
      }
      currentSection = {
        sectionName: trimmed,
        content: '',
        pageReferences: [1], // Word docs don't have page references
        confidenceScore: 1.0,
      };
    } else if (currentSection) {
      currentSection.content += (currentSection.content ? '\n' : '') + trimmed;
    }
  }

  // Push last section
  if (currentSection && currentSection.content.trim()) {
    sections.push(currentSection);
  }

  console.log(`[ReviewAW] Extracted ${sections.length} sections from Word doc`);
  return sections;
}

// ---------- Step 4: Deviation detection via Claude ----------

async function detectDeviations(approvedSections, artworkSections) {
  if (!ANTHROPIC_API_KEY) {
    console.warn('[ReviewAW] No ANTHROPIC_API_KEY — returning mock deviations');
    return mockDeviations();
  }

  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  const prompt = `Compare these AW Draft sections against the Approved PIL. For each deviation, classify as critical (dosage errors, missing warnings, wrong active ingredient), major (missing sections, content errors), or minor (formatting, spacing). Return JSON array of deviations with sectionName, approvedText, artworkText, severity, pageReference.

APPROVED PIL SECTIONS:
${JSON.stringify(approvedSections, null, 2)}

AW DRAFT SECTIONS:
${JSON.stringify(artworkSections, null, 2)}

Return ONLY a JSON array, no markdown fences:
[{"sectionName":"...","approvedText":"...","artworkText":"...","severity":"critical|major|minor","pageReference":1,"confidenceScore":0.95,"description":"..."}]

If no deviations found return an empty array [].`;

  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 8192,
    temperature: 0.3,
    messages: [{ role: 'user', content: prompt }],
  });

  return parseJsonArray(response.content[0].text);
}

// ---------- helpers ----------

function parseJsonArray(text) {
  let cleaned = text.trim();
  // Strip markdown fences
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
  }
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error('Expected JSON array from Claude');
  return parsed;
}

// ---------- mock data for development without API key ----------

function mockPdfSections() {
  return [
    { sectionName: 'PRODUCT NAME', content: 'Zenora (Abiraterone Acetate) 250mg Film-Coated Tablets', pageReferences: [1], confidenceScore: 0.96 },
    { sectionName: 'ACTIVE INGREDIENTS', content: 'Each tablet contains 250mg abiraterone acetate.', pageReferences: [1], confidenceScore: 0.85 },
    { sectionName: 'DOSAGE AND ADMINISTRATION', content: 'Take 1000mg (four 250mg tablets) once daily with food.', pageReferences: [3], confidenceScore: 0.94 },
    { sectionName: 'CONTRAINDICATIONS', content: 'Hypersensitivity to abiraterone acetate or any excipients.', pageReferences: [5], confidenceScore: 0.91 },
    { sectionName: 'WARNINGS AND PRECAUTIONS', content: 'Hepatotoxicity: Monitor liver function tests before treatment and monthly.', pageReferences: [6], confidenceScore: 0.88 },
    { sectionName: 'ADVERSE REACTIONS', content: 'Common side effects include fatigue, nausea, diarrhea, and hypertension.', pageReferences: [7], confidenceScore: 0.87 },
    { sectionName: 'STORAGE CONDITIONS', content: 'Store below 30°C in original package.', pageReferences: [12], confidenceScore: 0.79 },
  ];
}

function mockDeviations() {
  return [
    { sectionName: 'DOSAGE AND ADMINISTRATION', approvedText: 'Take 1000mg once daily at least one hour before or two hours after food.', artworkText: 'Take 1000mg once daily with food.', severity: 'critical', pageReference: 3, confidenceScore: 0.94, description: 'Food timing instruction changed — approved says on empty stomach, artwork says with food' },
    { sectionName: 'CONTRAINDICATIONS', approvedText: 'Hypersensitivity to abiraterone acetate or any excipients. Women who are or may become pregnant.', artworkText: 'Hypersensitivity to abiraterone acetate or any excipients.', severity: 'critical', pageReference: 5, confidenceScore: 0.91, description: 'Pregnancy contraindication missing from artwork' },
    { sectionName: 'WARNINGS AND PRECAUTIONS', approvedText: 'Monitor liver function tests every two weeks for first three months.', artworkText: 'Monitor liver function tests monthly.', severity: 'major', pageReference: 6, confidenceScore: 0.88, description: 'Monitoring frequency reduced from biweekly to monthly' },
    { sectionName: 'ACTIVE INGREDIENTS', approvedText: 'Each tablet contains 250mg abiraterone acetate (equivalent to 238mg abiraterone).', artworkText: 'Each tablet contains 250mg abiraterone acetate.', severity: 'major', pageReference: 1, confidenceScore: 0.85, description: 'Equivalent free-base amount omitted' },
    { sectionName: 'STORAGE CONDITIONS', approvedText: 'Store below 30°C. Keep in original package to protect from moisture.', artworkText: 'Store below 30°C in original package.', severity: 'minor', pageReference: 12, confidenceScore: 0.79, description: 'Moisture protection detail omitted' },
  ];
}
