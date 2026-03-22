import { extractDocument } from '../services/extractionRouter.js';
import { getDocumentById } from '../services/documentManager.js';
import { getTemplate } from '../services/marketTemplates.js';
import Anthropic from '@anthropic-ai/sdk';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'; // Cheap + fast for mapping/translation
const SONNET_MODEL = 'claude-sonnet-4-20250514'; // Higher quality for translation

/**
 * Create PIL Draft Workflow
 *
 * Steps:
 * A) Extract sections from Innovator PIL (English source of truth)
 * B) Load target market section template (learned or default)
 * C) Use Claude to SEMANTICALLY map English content to target sections
 * D) Identify gaps (required by market but no source content)
 * E) Identify diagrams to carry over
 * F) Cross-reference verification
 * G) Build structured draft in target market section order
 * H) Generate downloadable Word document (.docx)
 *
 * Output: English content reorganized into local market format.
 * NOT translated. Structure first, translate later.
 */
export async function executeCreateDraftWorkflow(innovatorPilId, regulatorySourceId, marketFormatId, sessionId) {
  const startTime = Date.now();

  try {
    const innovatorDoc = getDocumentById(innovatorPilId);
    if (!innovatorDoc) throw new Error(`Innovator PIL document not found: ${innovatorPilId}`);

    const regulatoryDoc = regulatorySourceId ? getDocumentById(regulatorySourceId) : null;
    const marketFormatDoc = marketFormatId ? getDocumentById(marketFormatId) : null;

    // ── Step A: Extract sections from Innovator PIL ──
    console.log('[CreateDraft] Step A: Extracting Innovator PIL');
    const innovatorExtraction = await extractDocument(innovatorPilId, sessionId);
    const innovatorSections = innovatorExtraction.sections || [];
    const innovatorDiagrams = innovatorExtraction.diagrams || [];

    let regulatorySections = [];
    if (regulatoryDoc) {
      console.log('[CreateDraft] Extracting Regulatory Source');
      const regExtraction = await extractDocument(regulatorySourceId, sessionId);
      regulatorySections = regExtraction.sections || [];
    }

    // ── Step B: Load target market section template ──
    console.log('[CreateDraft] Step B: Loading market template');
    let marketTemplate = null;
    let marketCode = null;

    if (marketFormatDoc) {
      marketCode = detectMarketCode(marketFormatDoc);
      try {
        const { learnTemplateFromDocument } = await import('../services/marketTemplates.js');
        marketTemplate = await learnTemplateFromDocument(marketFormatDoc, marketCode || 'custom_market', marketFormatDoc.name);
        console.log(`[CreateDraft] Learned template: ${marketTemplate.sections.length} sections`);
      } catch (e) {
        console.warn('[CreateDraft] Template learning failed, using extraction:', e.message);
      }
    }

    if (!marketTemplate && marketCode) {
      marketTemplate = getTemplate(marketCode);
    }
    if (!marketTemplate) {
      marketTemplate = getTemplate('taiwan_tfda') || getTemplate('thailand_fda');
    }

    const targetSections = marketTemplate?.sections || [];
    console.log(`[CreateDraft] Using template: ${marketTemplate?.marketCode || 'generic'} (${targetSections.length} sections)`);

    // ── Step C: Semantic section mapping via Claude ──
    console.log('[CreateDraft] Step C: Semantic section mapping via Claude');
    const sectionMapping = await semanticSectionMapping(innovatorSections, targetSections, marketTemplate);

    // ── Step D: Gap analysis ──
    console.log('[CreateDraft] Step D: Gap analysis');
    const gapAnalysis = buildGapAnalysis(sectionMapping, targetSections);

    // ── Step E: Diagram carryover ──
    console.log('[CreateDraft] Step E: Diagram carryover');
    const diagramCarryover = innovatorDiagrams.map(d => ({
      ...d,
      targetSection: findTargetForDiagram(d.relatedSection, sectionMapping),
      action: 'carry_over'
    }));

    // ── Step F: Cross-reference verification ──
    console.log('[CreateDraft] Step F: Cross-reference verification');
    const crossRefReport = verifyCrossReferences(innovatorSections);

    // ── Step G: Build structured draft ──
    console.log('[CreateDraft] Step G: Building structured draft');
    const structuredDraft = buildStructuredDraft(sectionMapping, marketTemplate);

    // ── Step H: Generate English Word document ──
    console.log('[CreateDraft] Step H: Generating English Word document');
    let docxEnBase64 = null;
    try {
      docxEnBase64 = await generateDraftDocx(sectionMapping, gapAnalysis, marketTemplate, innovatorDoc.productName, 'en');
    } catch (e) {
      console.error('[CreateDraft] English docx generation failed:', e.message);
    }

    // ── Step I: Translate mapped sections via Claude ──
    console.log('[CreateDraft] Step I: Translating sections via Claude');
    let translatedMapping = [];
    let docxTranslatedBase64 = null;
    const targetLanguage = detectTargetLanguage(marketTemplate);

    try {
      translatedMapping = await translateMappedSections(sectionMapping, targetLanguage, marketTemplate);
      console.log(`[CreateDraft] Translated ${translatedMapping.filter(t => t.translatedContent).length}/${translatedMapping.length} sections to ${targetLanguage}`);

      // Generate translated Word document
      docxTranslatedBase64 = await generateDraftDocx(translatedMapping, gapAnalysis, marketTemplate, innovatorDoc.productName, targetLanguage);
    } catch (e) {
      console.error('[CreateDraft] Translation/docx failed:', e.message);
    }

    // Translation checklist with status
    const translationChecklist = buildTranslationChecklist(translatedMapping.length > 0 ? translatedMapping : sectionMapping, marketTemplate, targetLanguage);

    const executionTimeMs = Date.now() - startTime;
    console.log('[CreateDraft] Workflow completed', {
      executionTimeMs,
      mappedSections: sectionMapping.filter(m => m.sourceContent).length,
      translatedSections: translatedMapping.filter(t => t.translatedContent).length,
      gaps: gapAnalysis.gaps.length,
      diagrams: diagramCarryover.length,
      hasEnDocx: !!docxEnBase64,
      hasTranslatedDocx: !!docxTranslatedBase64
    });

    return {
      workflowId: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowType: 'create_draft',
      structuredDraft,
      sectionMapping,
      gapAnalysis,
      diagramCarryover,
      crossRefReport,
      translationChecklist,
      docxBase64: docxEnBase64, // backwards compat
      docxEnBase64,
      docxTranslatedBase64,
      targetLanguage,
      marketTemplate: {
        marketCode: marketTemplate?.marketCode,
        marketName: marketTemplate?.marketName,
        language: marketTemplate?.language,
        source: marketTemplate?.source,
        sectionCount: targetSections.length
      },
      extractionResults: [{
        documentId: innovatorPilId,
        documentName: innovatorDoc.name,
        provider: innovatorExtraction.provider,
        sections: innovatorSections,
        diagrams: innovatorDiagrams,
        pageImages: innovatorExtraction.pageImages,
        processingTimeMs: innovatorExtraction.processingTimeMs
      }],
      executionTimeMs,
      executedDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CreateDraft] Workflow failed', { error: error.message });
    throw error;
  }
}

/**
 * Step C: Use Claude to semantically map source sections to target sections.
 * One source section may map to MULTIPLE targets. Some targets may have no match.
 */
async function semanticSectionMapping(sourceSections, targetSections, marketTemplate) {
  if (!CLAUDE_API_KEY || sourceSections.length === 0 || targetSections.length === 0) {
    console.warn('[CreateDraft] Skipping Claude mapping — using fallback');
    return fallbackMapping(sourceSections, targetSections);
  }

  // Send FULL content — Claude needs the complete text to extract subsections correctly
  const sourceList = sourceSections.map((s, i) => `=== SOURCE SECTION ${i + 1}: "${s.sectionName}" (pages ${(s.pageReferences || []).join(',')}) ===\n${s.content}`).join('\n\n');
  const targetList = targetSections.map((t, i) => `${i + 1}. ${t.name}${t.localName ? ' (' + t.localName + ')' : ''}`).join('\n');

  const prompt = `You are a pharmaceutical regulatory expert. Map source SmPC/EPAR sections to target market sections by MEANING.

The source document is an EU SmPC/EPAR. The target is a ${marketTemplate?.marketName || 'local market'} PIL format.

SOURCE SECTIONS (FULL CONTENT from Innovator SmPC):
${sourceList}

TARGET SECTIONS (${marketTemplate?.marketName || 'target market'} template):
${targetList}

CRITICAL RULES:
1. One source section WILL map to MULTIPLE targets. SmPC sections are broad — split them:
   - SmPC "4.4 Special warnings" → multiple targets: Warnings, Precautions, etc.
   - SmPC "4.2 Posology" → Dosage AND Administration AND Special populations
   - SmPC "4.8 Undesirable effects" → Adverse Reactions (NOT Overdosage)
   - SmPC "4.6 Pregnancy/Lactation" → Special Populations subsections
2. For each mapping, "extractedContent" MUST contain the ACTUAL TEXT paragraphs from the source that belong to that specific target section. Extract the relevant paragraphs — do NOT copy the entire source section.
3. If a target section needs content from MULTIPLE source sections, combine them.
4. Targets like "Pharmacology", "Pharmacokinetics", "Clinical Studies" map to SmPC sections 5.1, 5.2, 5.1 respectively — include the full data with numbers.
5. If no source content exists for a target (e.g., specific local requirements), set sourceIndex: null and provide a gapNote.
6. Confidence: 0.9+ = direct match, 0.7-0.9 = partial/subsection match, 0.0 = no match (gap).

Return ONLY a JSON array (no markdown), one entry per target section:
[
  {
    "targetIndex": 0,
    "targetName": "exact target section name",
    "sourceIndex": 1 or null,
    "sourceName": "source section name" or null,
    "confidence": 0.85,
    "extractedContent": "The actual relevant paragraphs extracted from source. Include ALL details — numbers, tables, percentages. This becomes the draft PIL content." or null,
    "gapNote": null or "Not in consumer PIL — requires SmPC or separate source"
  }
]`;

  try {
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    // Use Sonnet for mapping — needs to understand full SmPC content and extract subsections
    const response = await client.messages.create({
      model: SONNET_MODEL,
      max_tokens: 32000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = response.content[0].text.trim();
    if (text.startsWith('```')) text = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
    const mappings = JSON.parse(text);

    console.log(`[CreateDraft] Claude mapped ${mappings.filter(m => m.sourceIndex !== null).length}/${targetSections.length} sections`);

    // Enrich with actual content — use extractedContent (subsection) over full source content
    return mappings.map(m => {
      const source = m.sourceIndex !== null ? sourceSections[m.sourceIndex] : null;
      const target = targetSections[m.targetIndex] || targetSections.find(t => t.name === m.targetName);

      // Prefer Claude's extracted subsection content over full source section
      const content = m.extractedContent || (source ? source.content : null);

      return {
        targetSection: {
          number: target?.number || String(m.targetIndex + 1),
          name: target?.name || m.targetName,
          localName: target?.localName || ''
        },
        sourceSection: source ? {
          sectionName: source.sectionName,
          pageReferences: source.pageReferences,
          confidenceScore: source.confidenceScore
        } : null,
        sourceContent: content,
        mappingConfidence: m.confidence || 0,
        status: content ? 'mapped' : 'gap',
        gapNote: m.gapNote || null
      };
    });

  } catch (error) {
    console.error('[CreateDraft] Claude mapping failed, using fallback:', error.message);
    return fallbackMapping(sourceSections, targetSections);
  }
}

/**
 * Fallback mapping when Claude is unavailable
 */
function fallbackMapping(sourceSections, targetSections) {
  return targetSections.map(target => ({
    targetSection: { number: target.number, name: target.name, localName: target.localName || '' },
    sourceSection: null,
    sourceContent: null,
    extractInstruction: null,
    mappingConfidence: 0,
    status: 'gap',
    gapNote: 'Automatic mapping unavailable — requires manual review'
  }));
}

/**
 * Step D: Build gap analysis from mapping results
 */
function buildGapAnalysis(sectionMapping, targetSections) {
  const gaps = sectionMapping
    .filter(m => m.status === 'gap')
    .map(m => ({
      targetSection: m.targetSection.name,
      targetLocalName: m.targetSection.localName,
      gapType: 'missing_from_source',
      severity: isCriticalSection(m.targetSection.name) ? 'high' : 'medium',
      suggestedAction: m.gapNote || 'Content needs to be sourced from SmPC or other regulatory documents',
    }));

  const mapped = sectionMapping.filter(m => m.status === 'mapped');
  const totalRequired = targetSections.filter(t => t.required !== false).length;

  return {
    gaps,
    totalRequired,
    totalMapped: mapped.length,
    completeness: totalRequired > 0
      ? ((mapped.length / totalRequired) * 100).toFixed(1) + '%'
      : 'N/A'
  };
}

function isCriticalSection(name) {
  const critical = ['dosage', 'contraindication', 'warning', 'precaution', 'active ingredient', 'adverse', 'indications'];
  return critical.some(c => name.toLowerCase().includes(c));
}

/**
 * Step G: Build structured draft
 */
function buildStructuredDraft(sectionMapping, marketTemplate) {
  return {
    marketCode: marketTemplate?.marketCode || 'custom',
    marketName: marketTemplate?.marketName || 'Custom Market',
    language: marketTemplate?.language || 'Unknown',
    note: 'English content reorganized into local market format. Translation is a separate step.',
    sections: sectionMapping.map(m => ({
      number: m.targetSection.number,
      targetName: m.targetSection.name,
      targetLocalName: m.targetSection.localName,
      content: m.sourceContent || null,
      status: m.status,
      confidence: m.mappingConfidence,
      sourceSection: m.sourceSection?.sectionName || null,
      extractInstruction: m.extractInstruction,
      gapNote: m.gapNote
    }))
  };
}

/**
 * Step I: Translate mapped sections via Claude
 */
async function translateMappedSections(sectionMapping, targetLanguage, marketTemplate) {
  if (!CLAUDE_API_KEY) {
    console.warn('[CreateDraft] No API key — skipping translation');
    return sectionMapping.map(m => ({ ...m, translatedContent: null, translationConfidence: 0, translationStatus: 'skipped' }));
  }

  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  const langName = targetLanguage === 'tc' ? 'Traditional Chinese (繁體中文)' : 'Thai (ภาษาไทย)';
  const marketName = targetLanguage === 'tc' ? 'Taiwan TFDA' : 'Thailand Thai FDA';

  const results = [];
  for (const mapping of sectionMapping) {
    if (!mapping.sourceContent || mapping.status !== 'mapped') {
      results.push({ ...mapping, translatedContent: null, translationConfidence: 0, translationStatus: mapping.status === 'gap' ? 'gap' : 'skipped' });
      continue;
    }

    try {
      console.log(`[CreateDraft] Translating: ${mapping.targetSection.name}`);
      const response = await client.messages.create({
        model: HAIKU_MODEL,
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: `Translate this pharmaceutical PIL section to ${langName} for ${marketName} submission.

Section: ${mapping.targetSection.name} (${mapping.targetSection.localName || ''})

English content:
${mapping.sourceContent}

CRITICAL RULES:
- Do NOT translate brand names (e.g., ZYTIGA stays as ZYTIGA)
- Preserve all dosage numbers and units exactly (e.g., 250 mg, 5 mL)
- Preserve chemical formulas exactly (e.g., C₂₄H₃₁NO₂)
- Use standard ${marketName}-approved medical terminology
- Section numbering must match ${marketName} format
- Maintain table structures if present

Return ONLY the translated text. No explanations or notes.`
        }]
      });

      const translated = response.content[0].text.trim();
      results.push({
        ...mapping,
        translatedContent: translated,
        translationConfidence: 0.85,
        translationStatus: 'translated'
      });
    } catch (e) {
      console.error(`[CreateDraft] Translation failed for ${mapping.targetSection.name}:`, e.message);
      results.push({ ...mapping, translatedContent: null, translationConfidence: 0, translationStatus: 'failed' });
    }
  }

  return results;
}

/**
 * Step H: Generate Word document (.docx) matching approved TFDA PIL format
 * mode: 'en' = English draft (for internal review), 'tc'/'th' = Translated draft (for Lotus/TFDA)
 */
async function generateDraftDocx(sectionMapping, gapAnalysis, marketTemplate, productName, mode) {
  const { Document, Paragraph, TextRun, Table, TableRow, TableCell, HeadingLevel, AlignmentType, WidthType, Packer, PageBreak } = await import('docx');

  const isTranslated = mode !== 'en';
  const children = [];

  // ── Document Header (matching approved PIL format) ──
  if (isTranslated) {
    // Bilingual product name header like real approved PIL
    children.push(new Paragraph({
      children: [new TextRun({ text: productName || 'Product Name', bold: true, size: 28 })],
      alignment: AlignmentType.CENTER, spacing: { after: 100 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: '須由醫師處方使用', size: 20 })],
      alignment: AlignmentType.CENTER, spacing: { after: 100 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: 'DRAFT — 供審核用', bold: true, size: 20, color: 'CC0000' })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 }
    }));
  } else {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'INTERNAL REVIEW COPY — English Structure Draft', bold: true, size: 28, color: '1B365D' })],
      alignment: AlignmentType.CENTER, spacing: { after: 100 }
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `Product: ${productName || 'N/A'}`, size: 22 })],
      alignment: AlignmentType.CENTER
    }));
    children.push(new Paragraph({
      children: [new TextRun({ text: `Target Market: ${marketTemplate?.marketName || 'N/A'} | Generated: ${new Date().toISOString().split('T')[0]} | Completeness: ${gapAnalysis.completeness}`, size: 18, color: '999999', italics: true })],
      alignment: AlignmentType.CENTER, spacing: { after: 400 }
    }));
  }

  // ── Sections in TFDA order ──
  for (const m of sectionMapping) {
    const num = m.targetSection.number;
    const name = m.targetSection.name;
    const localName = m.targetSection.localName || '';

    // Section heading — Chinese primary for translated, English primary for EN draft
    if (isTranslated && localName) {
      // Format: "1. 性狀" (Chinese only, matching approved PIL)
      children.push(new Paragraph({
        children: [new TextRun({ text: `${num}. ${localName}`, bold: true, size: 24 })],
        heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 }
      }));
    } else {
      // English draft: "1. Description (性狀)"
      children.push(new Paragraph({
        children: [
          new TextRun({ text: `${num}. ${name}`, bold: true, size: 24 }),
          ...(localName ? [new TextRun({ text: ` (${localName})`, size: 20, color: '666666' })] : []),
        ],
        heading: HeadingLevel.HEADING_2, spacing: { before: 300, after: 100 }
      }));
    }

    if (m.status === 'mapped' && m.sourceContent) {
      if (isTranslated && m.translatedContent) {
        // Translated content ONLY — clean format matching approved PIL
        for (const line of m.translatedContent.split('\n').filter(l => l.trim())) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })], spacing: { after: 60 } }));
        }
      } else {
        if (isTranslated) {
          children.push(new Paragraph({
            children: [new TextRun({ text: '[翻譯待完成 — Translation Pending]', bold: true, size: 18, color: 'FF8800' })],
            spacing: { after: 80 }
          }));
        }
        // English content with source reference (EN draft only)
        if (!isTranslated) {
          children.push(new Paragraph({
            children: [new TextRun({ text: `Source: ${m.sourceSection?.sectionName || 'Innovator'} (${(m.mappingConfidence * 100).toFixed(0)}% match)`, size: 16, color: '008800', italics: true })],
            spacing: { after: 60 }
          }));
        }
        for (const line of m.sourceContent.split('\n').filter(l => l.trim())) {
          children.push(new Paragraph({ children: [new TextRun({ text: line, size: 20 })], spacing: { after: 60 } }));
        }
      }
    } else {
      // Gap
      const gapText = isTranslated
        ? '[內容缺漏 — 原始文件中無此資料]'
        : '[CONTENT GAP — NOT AVAILABLE IN SOURCE DOCUMENT]';
      children.push(new Paragraph({
        children: [new TextRun({ text: gapText, bold: true, size: 20, color: 'CC0000' })],
        spacing: { after: 60 }
      }));
      if (m.gapNote) {
        children.push(new Paragraph({
          children: [new TextRun({ text: m.gapNote, size: 18, color: 'CC0000', italics: true })],
          spacing: { after: 100 }
        }));
      }
    }
  }

  // ── Appendix: Gap Summary (EN draft only) ──
  if (!isTranslated && gapAnalysis.gaps.length > 0) {
    children.push(new Paragraph({
      children: [new TextRun({ text: 'Appendix: Gap Summary', bold: true, size: 28 })],
      heading: HeadingLevel.HEADING_1, spacing: { before: 600, after: 200 }
    }));

    const rows = [
      new TableRow({ children: ['Section', 'Severity', 'Action Required'].map(h => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, size: 18 })] })], width: { size: 33, type: WidthType.PERCENTAGE } })) }),
      ...gapAnalysis.gaps.map(g => new TableRow({ children: [g.targetSection, g.severity, g.suggestedAction].map(v => new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: v || '', size: 18 })] })], width: { size: 33, type: WidthType.PERCENTAGE } })) }))
    ];
    children.push(new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }));
  }

  const doc = new Document({ sections: [{ children }] });
  const buffer = await Packer.toBuffer(doc);
  return buffer.toString('base64');
}

/**
 * Build translation checklist for frontend
 */
function buildTranslationChecklist(sectionMapping, marketTemplate, targetLanguage) {
  const langMap = { tc: 'Traditional Chinese', th: 'Thai' };
  return sectionMapping
    .filter(m => m.sourceContent)
    .map(m => ({
      section: m.targetSection.name,
      localName: m.targetSection.localName || '',
      sourceLanguage: 'English',
      targetLanguage: langMap[targetLanguage] || marketTemplate?.language || 'Traditional Chinese',
      wordCount: m.sourceContent.split(/\s+/).length,
      complexity: estimateComplexity(m.sourceContent),
      status: m.translationStatus === 'translated' ? 'Translated by AI' : m.translationStatus === 'failed' ? 'Needs human translator' : 'Pending translation',
      translationConfidence: m.translationConfidence || 0,
      preservationNotes: getPreservationNotes(m.sourceContent)
    }));
}

function detectTargetLanguage(marketTemplate) {
  const lang = (marketTemplate?.language || '').toLowerCase();
  if (lang.includes('chinese') || lang.includes('中文')) return 'tc';
  if (lang.includes('thai') || lang.includes('ไทย')) return 'th';
  return 'tc'; // default to Traditional Chinese for Lotus
}

function estimateComplexity(content) {
  if (/\d+\s*(mg|mcg|ml|g|iu)\b/i.test(content)) return 'high';
  if (/[A-Z][a-z]?[₀-₉]+|molecular|formula/i.test(content)) return 'high';
  if (content.length > 1000) return 'medium';
  return 'low';
}

function getPreservationNotes(content) {
  const notes = [];
  if (/\d+\s*(mg|mcg|ml|g|iu|%)\b/i.test(content)) notes.push('Dosage values must be preserved exactly');
  if (/[A-Z][a-z]?[₀-₉]+|molecular|formula/i.test(content)) notes.push('Chemical names and formulas must not be translated');
  if ((content.match(/\|/g) || []).length > 4) notes.push('Table structure must be maintained');
  return notes;
}

function verifyCrossReferences(sections) {
  const unresolvedRefs = [];
  let resolvedCount = 0;
  const refPattern = /(?:see|refer to|as described in|listed in|per|according to)\s+(?:section|annex|annexure|appendix|table)\s+[\d.]+/gi;
  for (const section of sections) {
    if (section.flags?.crossRefResolved) resolvedCount++;
    const matches = section.content.match(refPattern);
    if (matches) unresolvedRefs.push({ section: section.sectionName, references: matches, pageReferences: section.pageReferences });
  }
  return { resolvedCount, unresolvedCount: unresolvedRefs.length, unresolvedRefs, isFullyResolved: unresolvedRefs.length === 0 };
}

function findTargetForDiagram(relatedSection, sectionMapping) {
  if (!relatedSection) return null;
  const m = sectionMapping.find(m => m.sourceSection?.sectionName === relatedSection);
  return m?.targetSection?.name || relatedSection;
}

function detectMarketCode(doc) {
  const name = (doc.name + ' ' + (doc.productName || '')).toLowerCase();
  if (name.includes('thailand') || name.includes('thai') || name.includes('อย.')) return 'thailand_fda';
  if (name.includes('taiwan') || name.includes('tfda') || name.includes('衛福部')) return 'taiwan_tfda';
  return null;
}
