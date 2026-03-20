import { extractDocument } from '../services/extractionRouter.js';
import { generateDraftOutline } from '../services/intelligenceEngine.js';
import { alignSections } from '../services/sectionAligner.js';
import { analyzeGaps } from '../services/gapAnalyzer.js';
import { generateTranslationChecklist } from '../services/translationChecker.js';
import { getDocumentById } from '../services/documentManager.js';

/**
 * Create PIL Draft Workflow
 * Generates structured draft outline with section alignment, gap analysis,
 * translation checklist, and special attention flags
 */
export async function executeCreateDraftWorkflow(innovatorPilId, regulatorySourceId, marketFormatId, sessionId) {
  const startTime = Date.now();
  
  try {
    // Validate all required documents exist
    const innovatorDoc = getDocumentById(innovatorPilId);
    const regulatoryDoc = getDocumentById(regulatorySourceId);
    const marketFormatDoc = getDocumentById(marketFormatId);
    
    if (!innovatorDoc || !regulatoryDoc || !marketFormatDoc) {
      throw new Error('One or more required documents not found');
    }
    
    // Stage 1: Extract content from all three documents
    console.log('Starting extraction for Create PIL Draft workflow', {
      innovatorPilId,
      regulatorySourceId,
      marketFormatId,
      sessionId
    });
    
    const [innovatorExtraction, regulatoryExtraction, marketFormatExtraction] = await Promise.all([
      extractDocument(innovatorPilId, sessionId),
      extractDocument(regulatorySourceId, sessionId),
      extractDocument(marketFormatId, sessionId)
    ]);
    
    // Validate extraction confidence for critical sections
    validateExtractionConfidence(innovatorExtraction, 'Innovator PIL');
    validateExtractionConfidence(regulatoryExtraction, 'Regulatory Source');
    validateExtractionConfidence(marketFormatExtraction, 'Local Market PIL Format');
    
    // Stage 2: Semantic intelligence analysis
    console.log('Starting semantic analysis for draft outline generation');
    
    // Parallel execution of analysis tasks
    const [sectionAlignment, gapAnalysis, translationChecklist] = await Promise.all([
      alignSections(
        innovatorExtraction.sections,
        marketFormatExtraction.sections,
        regulatoryExtraction.sections
      ),
      analyzeGaps(
        innovatorExtraction.sections,
        marketFormatExtraction.sections,
        regulatoryExtraction.sections
      ),
      generateTranslationChecklist(
        innovatorExtraction.sections,
        marketFormatExtraction.sections
      )
    ]);
    
    // Identify special attention items (dosage tables, chemical formulas)
    const specialAttentionFlags = identifySpecialAttentionItems(
      innovatorExtraction.sections,
      innovatorExtraction.pageImages
    );
    
    const executionTimeMs = Date.now() - startTime;
    
    console.log('Create PIL Draft workflow completed', {
      executionTimeMs,
      sectionAlignmentCount: sectionAlignment.length,
      gapAnalysisItems: gapAnalysis.missingSections.length + gapAnalysis.translationRequired.length,
      translationChecklistItems: translationChecklist.length,
      specialAttentionFlags: specialAttentionFlags.length
    });
    
    return {
      workflowId: `draft-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sectionAlignment,
      gapAnalysis,
      translationChecklist,
      specialAttentionFlags,
      extractionResults: [
        {
          documentId: innovatorPilId,
          documentName: innovatorDoc.name,
          provider: innovatorExtraction.provider,
          sections: innovatorExtraction.sections,
          pageImages: innovatorExtraction.pageImages,
          processingTimeMs: innovatorExtraction.processingTimeMs
        },
        {
          documentId: regulatorySourceId,
          documentName: regulatoryDoc.name,
          provider: regulatoryExtraction.provider,
          sections: regulatoryExtraction.sections,
          pageImages: regulatoryExtraction.pageImages,
          processingTimeMs: regulatoryExtraction.processingTimeMs
        },
        {
          documentId: marketFormatId,
          documentName: marketFormatDoc.name,
          provider: marketFormatExtraction.provider,
          sections: marketFormatExtraction.sections,
          pageImages: marketFormatExtraction.pageImages,
          processingTimeMs: marketFormatExtraction.processingTimeMs
        }
      ],
      executionTimeMs,
      executedDate: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Create PIL Draft workflow failed', {
      error: error.message,
      stack: error.stack,
      innovatorPilId,
      regulatorySourceId,
      marketFormatId
    });
    throw error;
  }
}

/**
 * Validate extraction confidence meets thresholds
 */
function validateExtractionConfidence(extractionResult, documentType) {
  const CRITICAL_SECTIONS = [
    'DOSAGE AND ADMINISTRATION',
    'CONTRAINDICATIONS',
    'WARNINGS AND PRECAUTIONS',
    'ACTIVE INGREDIENTS',
    'INDICATIONS'
  ];
  
  const CRITICAL_THRESHOLD = 0.85;
  
  const lowConfidenceSections = extractionResult.sections.filter(section => {
    const isCritical = CRITICAL_SECTIONS.some(critical => 
      section.sectionName.toUpperCase().includes(critical)
    );
    return isCritical && section.confidenceScore < CRITICAL_THRESHOLD;
  });
  
  if (lowConfidenceSections.length > 0) {
    console.warn(`Low confidence extraction detected in ${documentType}`, {
      sections: lowConfidenceSections.map(s => ({
        name: s.sectionName,
        confidence: s.confidenceScore
      }))
    });
  }
}

/**
 * Identify special attention items (dosage tables, chemical formulas)
 */
function identifySpecialAttentionItems(sections, pageImages) {
  const specialAttentionFlags = [];
  
  // Keywords that indicate dosage tables
  const dosageKeywords = [
    'dosage', 'dose', 'mg/kg', 'mg/m²', 'administration schedule',
    'recommended dose', 'initial dose', 'maintenance dose', 'tablet',
    'capsule', 'injection', 'infusion', 'once daily', 'twice daily'
  ];
  
  // Keywords that indicate chemical formulas
  const chemicalKeywords = [
    'chemical formula', 'molecular formula', 'structural formula',
    'C₁', 'H₁', 'N₁', 'O₁', 'molecular weight', 'CAS number',
    'chemical name', 'IUPAC', 'empirical formula'
  ];
  
  sections.forEach(section => {
    const contentLower = section.content.toLowerCase();
    
    // Check for dosage tables
    const hasDosageTable = dosageKeywords.some(keyword => 
      contentLower.includes(keyword.toLowerCase())
    );
    
    if (hasDosageTable) {
      specialAttentionFlags.push({
        section: section.sectionName,
        reason: 'dosage_table',
        description: 'Contains dosage information requiring precise translation and formatting',
        pageReferences: section.pageReferences,
        confidenceScore: section.confidenceScore
      });
    }
    
    // Check for chemical formulas
    const hasChemicalFormula = chemicalKeywords.some(keyword => 
      contentLower.includes(keyword.toLowerCase())
    ) || /[A-Z][a-z]?[₀-₉]+/.test(section.content); // Detect subscript numbers
    
    if (hasChemicalFormula) {
      specialAttentionFlags.push({
        section: section.sectionName,
        reason: 'chemical_formula',
        description: 'Contains chemical formulas requiring expert verification',
        pageReferences: section.pageReferences,
        confidenceScore: section.confidenceScore
      });
    }
    
    // Check for tables (multiple tab characters or aligned columns)
    const hasTable = (section.content.match(/\t/g) || []).length > 5 ||
                     (section.content.match(/\n.*\|.*\|/g) || []).length > 2;
    
    if (hasTable && !hasDosageTable) {
      specialAttentionFlags.push({
        section: section.sectionName,
        reason: 'complex_table',
        description: 'Contains tabular data requiring careful formatting',
        pageReferences: section.pageReferences,
        confidenceScore: section.confidenceScore
      });
    }
  });
  
  return specialAttentionFlags;
}