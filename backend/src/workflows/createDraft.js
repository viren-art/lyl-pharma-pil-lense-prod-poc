import { extractDocument } from '../services/extractionRouter.js';
import { getDocumentById } from '../services/documentManager.js';
import { getTemplate } from '../services/marketTemplates.js';

/**
 * Create PIL Draft Workflow
 *
 * Sequence (per spec):
 * a) Extract sections from Innovator PIL (English source of truth)
 * b) Load target market section template (learned or default)
 * c) Map extracted English sections to target market format
 * d) Identify gaps (sections required by market but missing from source)
 * e) Identify diagrams that need to be carried over
 * f) Generate cross-reference resolved content
 * g) Return structured draft in TARGET MARKET SECTION ORDER, still in English
 *
 * Output: English content reorganized into local market format, with gap analysis,
 * diagram references, cross-references resolved, and translation checklist.
 * NOT a translated document. Structure first, translate later.
 */
export async function executeCreateDraftWorkflow(innovatorPilId, regulatorySourceId, marketFormatId, sessionId) {
  const startTime = Date.now();

  try {
    // Validate required documents
    const innovatorDoc = getDocumentById(innovatorPilId);
    if (!innovatorDoc) throw new Error(`Innovator PIL document not found: ${innovatorPilId}`);

    const regulatoryDoc = regulatorySourceId ? getDocumentById(regulatorySourceId) : null;
    const marketFormatDoc = marketFormatId ? getDocumentById(marketFormatId) : null;

    // ── Step A: Extract sections from Innovator PIL ──
    console.log('[CreateDraft] Step A: Extracting Innovator PIL');
    const innovatorExtraction = await extractDocument(innovatorPilId, sessionId);

    const innovatorSections = innovatorExtraction.sections || [];
    const innovatorDiagrams = innovatorExtraction.diagrams || [];

    // Extract regulatory source if provided
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

    // If a market format document was uploaded, try to learn from it
    if (marketFormatDoc) {
      // Check if it's a known market type based on product name or document name
      marketCode = detectMarketCode(marketFormatDoc);

      // Try to learn template from document if Claude API is available
      try {
        const { learnTemplateFromDocument } = await import('../services/marketTemplates.js');
        marketTemplate = await learnTemplateFromDocument(
          marketFormatDoc,
          marketCode || 'custom_market',
          marketFormatDoc.name
        );
        console.log(`[CreateDraft] Learned template from ${marketFormatDoc.name}: ${marketTemplate.sections.length} sections`);
      } catch (e) {
        console.warn('[CreateDraft] Could not learn template, falling back to extraction:', e.message);
        // Fall back to extracting the document
        const mfExtraction = await extractDocument(marketFormatId, sessionId);
        marketTemplate = buildTemplateFromExtraction(mfExtraction.sections, marketCode || 'custom_market');
      }
    }

    // If no template from document, try loading existing template by market code
    if (!marketTemplate && marketCode) {
      marketTemplate = getTemplate(marketCode);
    }

    // Fall back to generic template if nothing found
    if (!marketTemplate) {
      // Default to Thailand FDA as most common for Lotus
      marketTemplate = getTemplate('thailand_fda') || getTemplate('taiwan_tfda');
    }

    const targetSections = marketTemplate?.sections || [];
    console.log(`[CreateDraft] Using template: ${marketTemplate?.marketCode || 'generic'} (${targetSections.length} sections)`);

    // ── Step C: Map extracted English sections to target market format ──
    console.log('[CreateDraft] Step C: Mapping sections to target market format');
    const sectionMapping = mapSectionsToMarketFormat(innovatorSections, targetSections);

    // ── Step D: Gap analysis ──
    console.log('[CreateDraft] Step D: Gap analysis');
    const gapAnalysis = analyzeGapsAgainstTemplate(innovatorSections, targetSections, regulatorySections);

    // ── Step E: Identify diagrams to carry over ──
    console.log('[CreateDraft] Step E: Diagram carryover analysis');
    const diagramCarryover = innovatorDiagrams.map(diagram => ({
      ...diagram,
      targetSection: findTargetSection(diagram.relatedSection, sectionMapping),
      action: 'carry_over',
      note: 'Diagram must be included in target market document'
    }));

    // ── Step F: Cross-reference resolution verification ──
    console.log('[CreateDraft] Step F: Cross-reference verification');
    const crossRefReport = verifyCrossReferences(innovatorSections);

    // ── Step G: Build structured draft in TARGET MARKET SECTION ORDER ──
    console.log('[CreateDraft] Step G: Building structured draft');
    const structuredDraft = buildStructuredDraft(sectionMapping, targetSections, marketTemplate);

    // Generate translation checklist
    const translationChecklist = generateTranslationChecklist(
      sectionMapping,
      targetSections,
      marketTemplate?.language || 'Unknown'
    );

    // Identify special attention items
    const specialAttentionFlags = identifySpecialAttentionItems(innovatorSections);

    const executionTimeMs = Date.now() - startTime;

    console.log('[CreateDraft] Workflow completed', {
      executionTimeMs,
      mappedSections: sectionMapping.length,
      gaps: gapAnalysis.gaps.length,
      diagrams: diagramCarryover.length,
      crossRefsResolved: crossRefReport.resolvedCount
    });

    return {
      workflowId: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      workflowType: 'create_draft',

      // Core output: English content in target market order
      structuredDraft,

      // Analysis results
      sectionMapping,
      gapAnalysis,
      diagramCarryover,
      crossRefReport,
      translationChecklist,
      specialAttentionFlags,

      // Template used
      marketTemplate: {
        marketCode: marketTemplate?.marketCode,
        marketName: marketTemplate?.marketName,
        language: marketTemplate?.language,
        source: marketTemplate?.source,
        sectionCount: targetSections.length
      },

      // Extraction details
      extractionResults: [
        {
          documentId: innovatorPilId,
          documentName: innovatorDoc.name,
          provider: innovatorExtraction.provider,
          sections: innovatorSections,
          diagrams: innovatorDiagrams,
          pageImages: innovatorExtraction.pageImages,
          processingTimeMs: innovatorExtraction.processingTimeMs
        },
        ...(regulatoryDoc ? [{
          documentId: regulatorySourceId,
          documentName: regulatoryDoc.name,
          sections: regulatorySections,
          pageImages: []
        }] : [])
      ],

      executionTimeMs,
      executedDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('[CreateDraft] Workflow failed', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
}

/**
 * Detect market code from document metadata
 */
function detectMarketCode(doc) {
  const name = (doc.name + ' ' + (doc.productName || '')).toLowerCase();
  if (name.includes('thailand') || name.includes('thai') || name.includes('อย.')) return 'thailand_fda';
  if (name.includes('taiwan') || name.includes('tfda') || name.includes('衛福部')) return 'taiwan_tfda';
  return null;
}

/**
 * Build a template from extracted sections (fallback when Claude learning unavailable)
 */
function buildTemplateFromExtraction(sections, marketCode) {
  return {
    marketCode,
    marketName: marketCode,
    language: 'Unknown',
    isDefault: false,
    source: 'extracted',
    lastUpdated: new Date().toISOString(),
    sections: sections.map((s, i) => ({
      number: String(i + 1),
      name: s.sectionName,
      localName: s.sectionName,
      required: true,
      subsections: []
    }))
  };
}

/**
 * Map innovator PIL sections to target market format
 */
function mapSectionsToMarketFormat(innovatorSections, targetSections) {
  const mapping = [];

  for (const target of targetSections) {
    // Find best matching innovator section by name similarity
    const match = findBestMatch(target, innovatorSections);

    mapping.push({
      targetSection: {
        number: target.number,
        name: target.name,
        localName: target.localName
      },
      sourceSection: match ? {
        sectionName: match.section.sectionName,
        content: match.section.content,
        pageReferences: match.section.pageReferences,
        confidenceScore: match.section.confidenceScore,
        flags: match.section.flags
      } : null,
      mappingConfidence: match ? match.confidence : 0,
      status: match ? (match.confidence >= 0.7 ? 'mapped' : 'needs_review') : 'missing',
      subsectionMapping: target.subsections?.map(sub => {
        const subMatch = findBestMatchForSubsection(sub, match?.section);
        return {
          targetSubsection: { number: sub.number, name: sub.name, localName: sub.localName },
          sourceContent: subMatch || null,
          status: subMatch ? 'mapped' : 'missing'
        };
      }) || []
    });
  }

  return mapping;
}

/**
 * Find best matching section by name
 */
function findBestMatch(target, sections) {
  const targetTerms = normalizeForMatching(target.name);

  let bestMatch = null;
  let bestConfidence = 0;

  for (const section of sections) {
    const sectionTerms = normalizeForMatching(section.sectionName);
    const confidence = calculateMatchConfidence(targetTerms, sectionTerms);

    if (confidence > bestConfidence && confidence > 0.3) {
      bestMatch = section;
      bestConfidence = confidence;
    }
  }

  return bestMatch ? { section: bestMatch, confidence: bestConfidence } : null;
}

/**
 * Find content within a section that matches a subsection
 */
function findBestMatchForSubsection(subsection, parentSection) {
  if (!parentSection) return null;

  const terms = normalizeForMatching(subsection.name);
  const content = parentSection.content.toLowerCase();

  // Check if any key terms appear in the content
  const matchCount = terms.filter(t => content.includes(t)).length;
  if (matchCount > 0 && matchCount >= terms.length * 0.3) {
    return parentSection.content;
  }
  return null;
}

/**
 * Normalize section name for matching
 */
function normalizeForMatching(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(t => t.length > 2 && !['and', 'the', 'for', 'this', 'that', 'with'].includes(t));
}

/**
 * Calculate match confidence between two term lists
 */
function calculateMatchConfidence(terms1, terms2) {
  if (terms1.length === 0 || terms2.length === 0) return 0;

  let matches = 0;
  for (const t1 of terms1) {
    if (terms2.some(t2 => t1.includes(t2) || t2.includes(t1))) {
      matches++;
    }
  }

  return matches / Math.max(terms1.length, terms2.length);
}

/**
 * Analyze gaps between innovator content and target market requirements
 */
function analyzeGapsAgainstTemplate(innovatorSections, targetSections, regulatorySections) {
  const gaps = [];

  for (const target of targetSections) {
    if (!target.required) continue;

    const match = findBestMatch(target, innovatorSections);

    if (!match) {
      // Check if regulatory source has it
      const regMatch = findBestMatch(target, regulatorySections);

      gaps.push({
        targetSection: target.name,
        targetLocalName: target.localName,
        gapType: 'missing_from_innovator',
        severity: isCriticalSection(target.name) ? 'high' : 'medium',
        suggestedAction: regMatch
          ? 'Content may be available in regulatory source document — review and adapt'
          : 'Section must be authored from scratch — requires regulatory team input',
        hasRegulatorySource: !!regMatch
      });
    } else if (match.confidence < 0.7) {
      gaps.push({
        targetSection: target.name,
        targetLocalName: target.localName,
        gapType: 'low_confidence_mapping',
        severity: 'medium',
        mappingConfidence: match.confidence,
        suggestedAction: 'Review mapping — content may not align well with target section requirements'
      });
    }
  }

  // Check for innovator sections with no target equivalent
  const unmappedSources = [];
  for (const section of innovatorSections) {
    const hasTarget = targetSections.some(target => {
      const match = findBestMatch(target, [section]);
      return match && match.confidence > 0.3;
    });
    if (!hasTarget) {
      unmappedSources.push({
        sectionName: section.sectionName,
        gapType: 'no_target_equivalent',
        suggestedAction: 'Content may need to be restructured into existing target sections'
      });
    }
  }

  return {
    gaps,
    unmappedSources,
    totalRequired: targetSections.filter(t => t.required).length,
    totalMapped: targetSections.filter(t => t.required).length - gaps.filter(g => g.gapType === 'missing_from_innovator').length,
    completeness: targetSections.filter(t => t.required).length > 0
      ? ((targetSections.filter(t => t.required).length - gaps.filter(g => g.gapType === 'missing_from_innovator').length) / targetSections.filter(t => t.required).length * 100).toFixed(1) + '%'
      : 'N/A'
  };
}

/**
 * Check if a section name is safety-critical
 */
function isCriticalSection(name) {
  const critical = ['dosage', 'contraindication', 'warning', 'precaution', 'active ingredient', 'adverse'];
  return critical.some(c => name.toLowerCase().includes(c));
}

/**
 * Find which target section a diagram should map to
 */
function findTargetSection(relatedSection, sectionMapping) {
  if (!relatedSection) return null;
  const mapping = sectionMapping.find(m =>
    m.sourceSection?.sectionName === relatedSection
  );
  return mapping?.targetSection?.name || relatedSection;
}

/**
 * Verify cross-references have been resolved in extracted content
 */
function verifyCrossReferences(sections) {
  const unresolvedRefs = [];
  let resolvedCount = 0;

  const refPattern = /(?:see|refer to|as described in|listed in|per|according to)\s+(?:section|annex|annexure|appendix|table)\s+[\d.]+/gi;

  for (const section of sections) {
    if (section.flags?.crossRefResolved) {
      resolvedCount++;
    }

    const matches = section.content.match(refPattern);
    if (matches) {
      unresolvedRefs.push({
        section: section.sectionName,
        references: matches,
        pageReferences: section.pageReferences
      });
    }
  }

  return {
    resolvedCount,
    unresolvedCount: unresolvedRefs.length,
    unresolvedRefs,
    isFullyResolved: unresolvedRefs.length === 0
  };
}

/**
 * Build structured draft in target market section order
 */
function buildStructuredDraft(sectionMapping, targetSections, marketTemplate) {
  return {
    marketCode: marketTemplate?.marketCode || 'custom',
    marketName: marketTemplate?.marketName || 'Custom Market',
    language: marketTemplate?.language || 'Unknown',
    note: 'English content reorganized into local market format. Translation is a separate step.',
    sections: sectionMapping.map(m => ({
      number: m.targetSection.number,
      targetName: m.targetSection.name,
      targetLocalName: m.targetSection.localName,
      content: m.sourceSection?.content || '[MISSING — Requires authoring]',
      status: m.status,
      confidenceScore: m.sourceSection?.confidenceScore || 0,
      sourceSection: m.sourceSection?.sectionName || null,
      subsections: m.subsectionMapping?.map(sub => ({
        number: sub.targetSubsection.number,
        targetName: sub.targetSubsection.name,
        targetLocalName: sub.targetSubsection.localName,
        content: sub.sourceContent || '[MISSING]',
        status: sub.status
      })) || []
    })),
    mandatoryFooter: marketTemplate?.mandatoryFooter || {}
  };
}

/**
 * Generate translation checklist
 */
function generateTranslationChecklist(sectionMapping, targetSections, targetLanguage) {
  return sectionMapping
    .filter(m => m.sourceSection)
    .map(m => {
      const content = m.sourceSection.content || '';
      const hasDosageData = /\d+\s*mg|\d+\s*ml|\d+\s*%/i.test(content);
      const hasChemicalTerms = /[A-Z][a-z]?[₀-₉]+|molecular|formula/i.test(content);
      const hasTable = content.includes('|') && (content.match(/\|/g) || []).length > 4;

      let complexity = 'low';
      if (hasDosageData || hasChemicalTerms) complexity = 'high';
      else if (content.length > 500 || hasTable) complexity = 'medium';

      return {
        section: m.targetSection.name,
        localName: m.targetSection.localName,
        sourceLanguage: 'English',
        targetLanguage,
        complexity,
        specialTerms: extractSpecialTerms(content),
        preservationNotes: [
          hasDosageData && 'Dosage values must be preserved exactly',
          hasChemicalTerms && 'Chemical names and formulas must not be translated',
          hasTable && 'Table structure must be maintained'
        ].filter(Boolean),
        wordCount: content.split(/\s+/).length
      };
    });
}

/**
 * Extract pharmaceutical special terms from content
 */
function extractSpecialTerms(content) {
  const terms = [];
  // Match chemical-looking terms (capitalized words with numbers/special chars)
  const chemPattern = /\b[A-Z][a-z]*(?:one|ine|ate|ide|ase|ol|il|um)\b/g;
  const matches = content.match(chemPattern);
  if (matches) {
    terms.push(...[...new Set(matches)].slice(0, 10));
  }
  return terms;
}

/**
 * Identify special attention items
 */
function identifySpecialAttentionItems(sections) {
  const flags = [];
  const dosageKeywords = ['dosage', 'dose', 'mg/kg', 'mg/m²', 'administration schedule', 'once daily', 'twice daily'];
  const chemicalKeywords = ['chemical formula', 'molecular formula', 'structural formula', 'molecular weight', 'CAS number'];

  for (const section of sections) {
    const contentLower = section.content.toLowerCase();

    if (dosageKeywords.some(k => contentLower.includes(k))) {
      flags.push({
        section: section.sectionName,
        reason: 'dosage_table',
        description: 'Contains dosage information requiring precise translation and formatting',
        pageReferences: section.pageReferences
      });
    }

    if (chemicalKeywords.some(k => contentLower.includes(k)) || /[A-Z][a-z]?[₀-₉]+/.test(section.content)) {
      flags.push({
        section: section.sectionName,
        reason: 'chemical_formula',
        description: 'Contains chemical formulas requiring expert verification',
        pageReferences: section.pageReferences
      });
    }
  }

  return flags;
}
