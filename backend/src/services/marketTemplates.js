import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULTS_DIR = path.join(__dirname, '../config/market-defaults');
const LEARNED_DIR = path.join(__dirname, '../config/market-learned');

// In-memory template store
const templates = new Map();

/**
 * Initialize: load defaults, then overlay any learned templates
 */
export function initializeMarketTemplates() {
  // Load defaults
  try {
    const defaultFiles = fs.readdirSync(DEFAULTS_DIR).filter(f => f.endsWith('.json'));
    for (const file of defaultFiles) {
      const data = JSON.parse(fs.readFileSync(path.join(DEFAULTS_DIR, file), 'utf-8'));
      templates.set(data.marketCode, data);
      console.log(`[MarketTemplates] Loaded default: ${data.marketCode}`);
    }
  } catch (e) {
    console.warn('[MarketTemplates] Could not load defaults:', e.message);
  }

  // Overlay learned templates (overwrite defaults if they exist)
  try {
    if (fs.existsSync(LEARNED_DIR)) {
      const learnedFiles = fs.readdirSync(LEARNED_DIR).filter(f => f.endsWith('.json'));
      for (const file of learnedFiles) {
        const data = JSON.parse(fs.readFileSync(path.join(LEARNED_DIR, file), 'utf-8'));
        templates.set(data.marketCode, { ...data, isDefault: false });
        console.log(`[MarketTemplates] Loaded learned: ${data.marketCode}`);
      }
    }
  } catch (e) {
    console.warn('[MarketTemplates] Could not load learned templates:', e.message);
  }

  console.log(`[MarketTemplates] ${templates.size} templates loaded`);
}

/**
 * Get all templates
 */
export function getAllTemplates() {
  return Array.from(templates.values());
}

/**
 * Get template by market code
 */
export function getTemplate(marketCode) {
  return templates.get(marketCode) || null;
}

/**
 * Update a template (manual editing)
 */
export function updateTemplate(marketCode, updates) {
  const existing = templates.get(marketCode);
  if (!existing) {
    throw new Error(`Template not found: ${marketCode}`);
  }

  const updated = {
    ...existing,
    ...updates,
    marketCode, // prevent overwrite
    lastUpdated: new Date().toISOString(),
    source: 'manual_edit'
  };

  templates.set(marketCode, updated);
  persistLearnedTemplate(marketCode, updated);
  return updated;
}

/**
 * Learn template structure from a document using Claude
 */
export async function learnTemplateFromDocument(document, marketCode, marketName) {
  const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;

  if (!CLAUDE_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY required for template learning');
  }

  // Extract text from document (mammoth for docx, or use extraction service)
  let documentText = '';
  if (document.mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const mammoth = await import('mammoth');
    const result = await mammoth.default.extractRawText({ buffer: document.buffer });
    documentText = result.value;
  } else {
    // For PDFs, convert to text via extraction
    documentText = document.buffer.toString('utf-8', 0, Math.min(document.buffer.length, 50000));
  }

  const { Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `Analyze this pharmaceutical market format document. Extract the complete section structure including:
- Section numbers and names (in both English and local language if present)
- Required subsections with their numbers
- Any mandatory footer/header elements (manufacturer info, revision date)
- Section ordering rules

Document content:
${documentText.substring(0, 30000)}

Return ONLY a JSON object with this structure (no markdown code blocks):
{
  "sections": [
    {
      "number": "1",
      "name": "English section name",
      "localName": "Local language section name or same as name if not available",
      "required": true/false,
      "subsections": [
        { "number": "1.1", "name": "Subsection name", "localName": "Local name" }
      ]
    }
  ],
  "mandatoryFooter": {
    "manufacturer": { "name": "Manufacturer/Importer", "localName": "local", "required": true },
    "revisionDate": { "name": "Date of last revision", "localName": "local", "required": true }
  },
  "detectedLanguage": "Thai" or "Traditional Chinese" or other
}`
    }]
  });

  let parsed;
  try {
    let text = response.content[0].text.trim();
    if (text.startsWith('```')) {
      text = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
    }
    parsed = JSON.parse(text);
  } catch (e) {
    throw new Error(`Failed to parse Claude response for template learning: ${e.message}`);
  }

  const template = {
    marketCode,
    marketName: marketName || marketCode,
    language: parsed.detectedLanguage || 'Unknown',
    isDefault: false,
    lastUpdated: new Date().toISOString(),
    source: 'learned',
    sourceDocument: document.name,
    sections: parsed.sections || [],
    mandatoryFooter: parsed.mandatoryFooter || {}
  };

  templates.set(marketCode, template);
  persistLearnedTemplate(marketCode, template);

  console.log(`[MarketTemplates] Learned template: ${marketCode} (${template.sections.length} sections from ${document.name})`);
  return template;
}

/**
 * Persist a learned template to disk
 */
function persistLearnedTemplate(marketCode, template) {
  try {
    if (!fs.existsSync(LEARNED_DIR)) {
      fs.mkdirSync(LEARNED_DIR, { recursive: true });
    }
    fs.writeFileSync(
      path.join(LEARNED_DIR, `${marketCode}.json`),
      JSON.stringify(template, null, 2),
      'utf-8'
    );
  } catch (e) {
    console.warn(`[MarketTemplates] Could not persist template ${marketCode}:`, e.message);
  }
}

// Initialize on module load
initializeMarketTemplates();
