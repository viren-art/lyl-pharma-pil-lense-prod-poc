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
 * Step C: Use Claude to semantically map source SmPC sections to TFDA target sections.
 *
 * Key insight: SmPC sections are structured differently than TFDA PIL sections.
 * One SmPC section maps to multiple TFDA sections, and Claude must extract the
 * SPECIFIC paragraphs for each target — not copy the entire source.
 *
 * Known mappings (SmPC → TFDA):
 *   SmPC 2 (Composition) → TFDA 1 (性狀: 1.1-1.4)
 *   SmPC 3 (Form) → TFDA 1.3, 1.4
 *   SmPC 4.1 (Indications) → TFDA 2 (適應症)
 *   SmPC 4.2 (Posology) → TFDA 3 (用法及用量: 3.1, 3.3)
 *   SmPC 4.3 (Contraindications) → TFDA 4 (禁忌)
 *   SmPC 4.4 (Warnings) → TFDA 5 (警語及注意事項: 5.1.1-5.1.6)
 *   SmPC 4.5 (Interactions) → TFDA 7 (交互作用: 7.1, 7.2)
 *   SmPC 4.6 (Pregnancy) → TFDA 6 (特殊族群: 6.1-6.3)
 *   SmPC 4.2 (Special pops) → TFDA 6 (特殊族群: 6.4-6.7)
 *   SmPC 4.8 (Adverse effects) → TFDA 8 (副作用: 8.1-8.3)
 *   SmPC 4.9 (Overdose) → TFDA 9 (過量)
 *   SmPC 5.1 (Pharmacodynamics) → TFDA 10 (藥理特性: 10.1-10.3)
 *   SmPC 5.2 (Pharmacokinetics) → TFDA 11 (藥物動力學特性)
 *   SmPC 5.1 (Clinical trials in PD section) → TFDA 12 (臨床試驗資料)
 *   SmPC 6 (Pharmaceutical) → TFDA 13 (包裝及儲存: 13.1-13.4)
 *   Consumer PIL at end → TFDA 14 (病人使用須知)
 */
async function semanticSectionMapping(sourceSections, targetSections, marketTemplate) {
  if (!CLAUDE_API_KEY || sourceSections.length === 0 || targetSections.length === 0) {
    console.warn('[CreateDraft] Skipping Claude mapping — using fallback');
    return fallbackMapping(sourceSections, targetSections);
  }

  // Flatten target sections to include subsections for granular mapping
  const flatTargets = [];
  for (const section of targetSections) {
    flatTargets.push({ number: section.number, name: section.name, localName: section.localName, isParent: true });
    if (section.subsections) {
      for (const sub of section.subsections) {
        flatTargets.push({ number: sub.number, name: sub.name, localName: sub.localName, isParent: false });
      }
    }
  }

  // Build source index with section names and content lengths for the prompt
  const sourceIndex = sourceSections.map((s, i) => `[${i}] "${s.sectionName}" (${s.content.length} chars, pages ${(s.pageReferences || []).join(',')})`).join('\n');

  // Send full content
  const sourceContent = sourceSections.map((s, i) => `\n======== SOURCE [${i}]: "${s.sectionName}" ========\n${s.content}`).join('\n');

  // Build target list with subsections
  const targetList = flatTargets.map(t => `${t.number}. ${t.name} (${t.localName})`).join('\n');

  const prompt = `You are a pharmaceutical regulatory expert creating a Taiwan TFDA PIL from an EU SmPC/EPAR.

Your job: For EACH target section below, extract the COMPLETE relevant content from the source SmPC. The output will become the English draft of a TFDA PIL, so completeness is critical — every paragraph, every number, every table must be preserved.

SOURCE DOCUMENT SECTIONS:
${sourceIndex}

FULL SOURCE CONTENT:
${sourceContent}

TARGET TFDA PIL SECTIONS (you must produce content for EACH):
${targetList}

MAPPING GUIDE — use these known correspondences:
- TFDA 1.1 (有效成分及含量) ← SmPC "Composition" section: active substance name, molecular formula, molecular weight, chemical description, strength per tablet
- TFDA 1.2 (賦形劑) ← SmPC "Composition" section: excipients list for EACH strength
- TFDA 1.3 (劑型) ← SmPC "Pharmaceutical form"
- TFDA 1.4 (藥品外觀) ← SmPC "Pharmaceutical form": tablet description, dimensions, debossing
- TFDA 2 (適應症) ← SmPC 4.1 "Therapeutic indications": ALL approved indications
- TFDA 3.1 (用法用量) ← SmPC 4.2 "Posology": dose regimens for each indication, dosage of prednisone, medical castration note, method of administration
- TFDA 3.3 (特殊族群用法用量) ← SmPC 4.2: hepatic impairment dosing, hepatotoxicity dose adjustments with specific ALT/AST thresholds, CYP3A4 inducer dose adjustments
- TFDA 4 (禁忌) ← SmPC 4.3 "Contraindications": ALL listed
- TFDA 5.1 (警語/注意事項) ← SmPC 4.4 "Special warnings": ALL subsections (mineralocorticoid excess, adrenal insufficiency, hepatotoxicity, Ra-223, embryo-fetal, hypoglycaemia, bone density, ketoconazole, excipients, etc.)
- TFDA 6.1-6.7 (特殊族群) ← SmPC 4.6 (pregnancy, lactation, fertility) + SmPC 4.2 (pediatric, geriatric, hepatic, renal impairment)
- TFDA 7.1-7.2 (交互作用) ← SmPC 4.5 "Interactions": BOTH directions (effect on abiraterone AND effect of abiraterone on others)
- TFDA 8.1-8.3 (副作用) ← SmPC 4.8 "Undesirable effects": clinical trial data tables with percentages, post-marketing
- TFDA 9 (過量) ← SmPC 4.9 "Overdose"
- TFDA 10.1-10.3 (藥理特性) ← SmPC 5.1 "Pharmacodynamic": mechanism of CYP17 inhibition, preclinical data
- TFDA 11 (藥物動力學) ← SmPC 5.2 "Pharmacokinetic": absorption, food effect, distribution, metabolism, elimination, special populations PK
- TFDA 12 (臨床試驗) ← SmPC 5.1 clinical trial subsections: COU-AA-301, COU-AA-302, LATITUDE with HR/CI/p-values
- TFDA 13.1-13.4 (包裝及儲存) ← SmPC 6.x: packaging, shelf life, storage
- TFDA 14 (病人使用須知) ← Consumer PIL at end of document (simplified patient version)

CRITICAL RULES:
1. Extract COMPLETE text for each target — every paragraph, number, percentage, p-value, confidence interval, table row
2. Include BOTH strengths (250mg AND 500mg) wherever applicable
3. For tables with clinical trial data, preserve ALL rows and columns
4. When a source section maps to multiple targets, split content precisely — zero overlap
5. TFDA 5.1 should contain ALL warning subsections from SmPC 4.4, each as a separate paragraph
6. If content genuinely doesn't exist in source, set extractedContent to null

Return ONLY a JSON array (no markdown code blocks):
[
  {
    "targetNumber": "1.1",
    "targetName": "Active ingredients and content",
    "targetLocalName": "有效成分及含量",
    "sourceIndices": [0, 1],
    "confidence": 0.95,
    "extractedContent": "FULL extracted text here — every word from source that belongs in this target section"
  }
]

One entry per target section/subsection in the list above. Include ALL ${flatTargets.length} targets.`;

  try {
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    const stream = client.messages.stream({
      model: SONNET_MODEL,
      max_tokens: 64000,
      messages: [{ role: 'user', content: prompt }]
    });
    const response = await stream.finalMessage();

    let text = response.content[0].text.trim();
    if (text.startsWith('```')) text = text.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
    const mappings = JSON.parse(text);

    console.log(`[CreateDraft] Claude mapped ${mappings.filter(m => m.extractedContent).length}/${flatTargets.length} sections`);

    // Build result using targetSections (parent-level) — merge subsection content under parents
    return targetSections.map(target => {
      // Find all mappings for this section number and its subsections
      const parentMapping = mappings.find(m => m.targetNumber === target.number);
      const subMappings = mappings.filter(m => m.targetNumber?.startsWith(target.number + '.'));

      // Build combined content: parent first, then subsections with their headings
      let combinedContent = '';
      if (parentMapping?.extractedContent) {
        combinedContent = parentMapping.extractedContent;
      }

      // Add subsection content with proper numbering
      if (subMappings.length > 0) {
        for (const sub of subMappings) {
          if (sub.extractedContent) {
            const subHeading = `${sub.targetNumber} ${sub.targetLocalName || sub.targetName}`;
            if (combinedContent) combinedContent += '\n\n';
            combinedContent += `${subHeading}\n${sub.extractedContent}`;
          }
        }
      }

      // If no content found at all, mark as gap
      const hasContent = combinedContent.trim().length > 0;
      const avgConfidence = hasContent
        ? (subMappings.filter(m => m.extractedContent).reduce((sum, m) => sum + (m.confidence || 0), parentMapping?.confidence || 0) /
           (subMappings.filter(m => m.extractedContent).length + (parentMapping?.extractedContent ? 1 : 0)) || 0.5)
        : 0;

      const sourceNames = [
        ...(parentMapping?.sourceIndices || []),
        ...subMappings.flatMap(m => m.sourceIndices || [])
      ].filter((v, i, a) => a.indexOf(v) === i)
        .map(i => sourceSections[i]?.sectionName)
        .filter(Boolean);

      return {
        targetSection: {
          number: target.number,
          name: target.name,
          localName: target.localName || '',
          subsections: target.subsections || []
        },
        sourceSection: sourceNames.length > 0 ? {
          sectionName: sourceNames.join(' + '),
          pageReferences: [],
          confidenceScore: avgConfidence
        } : null,
        sourceContent: hasContent ? combinedContent : null,
        mappingConfidence: avgConfidence,
        status: hasContent ? 'mapped' : 'gap',
        gapNote: hasContent ? null : (parentMapping?.gapNote || 'Content not found in source document')
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
      // Use streaming for long sections, Sonnet for quality
      const stream = client.messages.stream({
        model: SONNET_MODEL,
        max_tokens: 16000,
        messages: [{
          role: 'user',
          content: `Translate this pharmaceutical PIL section to ${langName} for ${marketName} submission.

Section: ${mapping.targetSection.number}. ${mapping.targetSection.localName || mapping.targetSection.name}

English content to translate:
${mapping.sourceContent}

CRITICAL RULES:
- The output should read like a professional TFDA-approved PIL — not a literal translation
- Do NOT translate brand names (e.g., ZYTIGA, Abiraterone acetate stay as-is)
- Preserve ALL dosage numbers and units exactly (e.g., 250毫克, 1000毫克)
- Preserve chemical formulas exactly (e.g., C₂₆H₃₃NO₂)
- Preserve ALL clinical trial statistics exactly (p-values, HR, CI, percentages)
- Use standard ${marketName}-approved medical terminology (e.g., 副作用 not 側效應)
- Preserve subsection numbering (e.g., 5.1.1, 5.1.2, etc.)
- Maintain table structures — use | separators for table columns
- Translate section headings to match TFDA format (e.g., "Hepatotoxicity" → "肝毒性")
- For parenthetical English terms, keep them: e.g., 腎上腺皮質功能不全(adrenal insufficiency)

Return ONLY the translated text. No explanations, no English original below.`
        }]
      });
      const response = await stream.finalMessage();

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
