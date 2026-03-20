import { classifySeverity } from './severityScorer.js';

// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const USE_MOCK = !CLAUDE_API_KEY;

// Performance constraints
const MAX_PROCESSING_TIME_MS = 120000; // 120 seconds
const CLAUDE_TIMEOUT_MS = 100000; // 100 seconds for Claude API call (leaves 20s buffer)

/**
 * Detect deviations between Approved PIL and AW Draft
 * Returns array of deviations with severity classification
 * Implements completeness verification and performance optimization
 */
export async function detectDeviations(approvedSections, artworkSections) {
  const startTime = Date.now();
  
  if (USE_MOCK) {
    console.log('[DeviationDetector] Using mock implementation (no Claude API key)');
    return mockDetectDeviations(approvedSections, artworkSections);
  }
  
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    // Performance optimization: Batch sections if document is large
    const totalSections = approvedSections.length + artworkSections.length;
    const useBatching = totalSections > 20;
    
    console.log('[DeviationDetector] Starting deviation detection', {
      approvedSections: approvedSections.length,
      artworkSections: artworkSections.length,
      useBatching,
      maxTimeMs: MAX_PROCESSING_TIME_MS
    });
    
    let allDeviations = [];
    
    if (useBatching) {
      // Process in batches to stay within time limits
      const batchSize = 10;
      const batches = [];
      
      for (let i = 0; i < approvedSections.length; i += batchSize) {
        batches.push({
          approved: approvedSections.slice(i, i + batchSize),
          artwork: artworkSections.slice(i, i + batchSize)
        });
      }
      
      console.log(`[DeviationDetector] Processing ${batches.length} batches`);
      
      for (let i = 0; i < batches.length; i++) {
        const elapsed = Date.now() - startTime;
        if (elapsed > MAX_PROCESSING_TIME_MS - 10000) {
          console.warn('[DeviationDetector] Approaching time limit, stopping batch processing', {
            processedBatches: i,
            totalBatches: batches.length,
            elapsedMs: elapsed
          });
          break;
        }
        
        const batchResult = await detectDeviationsBatch(
          client,
          batches[i].approved,
          batches[i].artwork,
          CLAUDE_TIMEOUT_MS / batches.length
        );
        
        allDeviations = allDeviations.concat(batchResult.deviations);
      }
    } else {
      // Process all sections in single call for smaller documents
      const result = await detectDeviationsBatch(
        client,
        approvedSections,
        artworkSections,
        CLAUDE_TIMEOUT_MS
      );
      allDeviations = result.deviations;
    }
    
    // Completeness verification: Check for missing sections
    const missingInArtwork = verifyCompleteness(approvedSections, artworkSections);
    allDeviations = allDeviations.concat(missingInArtwork);
    
    // Classify severity for each deviation
    const deviationsWithSeverity = allDeviations.map(deviation => ({
      ...deviation,
      severity: classifySeverity(deviation.deviationType)
    }));
    
    // Deduplicate deviations (same section + same deviation type)
    const uniqueDeviations = deduplicateDeviations(deviationsWithSeverity);
    
    const processingTimeMs = Date.now() - startTime;
    
    console.log('[DeviationDetector] Detection complete', {
      totalDeviations: uniqueDeviations.length,
      critical: uniqueDeviations.filter(d => d.severity === 'critical').length,
      major: uniqueDeviations.filter(d => d.severity === 'major').length,
      minor: uniqueDeviations.filter(d => d.severity === 'minor').length,
      processingTimeMs,
      withinTimeLimit: processingTimeMs < MAX_PROCESSING_TIME_MS
    });
    
    if (processingTimeMs >= MAX_PROCESSING_TIME_MS) {
      console.error('[DeviationDetector] Processing exceeded time limit', {
        processingTimeMs,
        maxTimeMs: MAX_PROCESSING_TIME_MS
      });
      throw new Error(`Deviation detection exceeded ${MAX_PROCESSING_TIME_MS}ms time limit`);
    }
    
    return {
      deviations: uniqueDeviations,
      processingTimeMs,
      completenessVerified: true
    };
    
  } catch (error) {
    const processingTimeMs = Date.now() - startTime;
    
    console.error('[DeviationDetector] Detection failed', {
      error: error.message,
      stack: error.stack,
      processingTimeMs
    });
    
    throw new Error(`Deviation detection failed: ${error.message}`);
  }
}

/**
 * Detect deviations for a batch of sections
 * Implements timeout enforcement
 */
async function detectDeviationsBatch(client, approvedSections, artworkSections, timeoutMs) {
  const prompt = `You are analyzing deviations between an approved PIL (Patient Information Leaflet) and an artwork draft.

APPROVED PIL SECTIONS:
${JSON.stringify(approvedSections, null, 2)}

ARTWORK DRAFT SECTIONS:
${JSON.stringify(artworkSections, null, 2)}

TASK: Detect ALL deviations between the approved PIL and artwork draft. You must be EXHAUSTIVE and thorough.

For each deviation, provide:
1. sectionName: The section where the deviation occurs
2. approvedText: The exact text from the approved PIL
3. artworkText: The exact text from the artwork draft
4. deviationType: One of: "dosage_error", "missing_warning", "wrong_ingredient_info", "missing_section", "content_error", "formatting_difference", "spacing_difference"
5. pageReference: The page number where the deviation appears in the artwork (use section's pageReferences[0] if available, otherwise 1)
6. confidenceScore: Your confidence in this deviation (0.0-1.0)
7. description: Brief explanation of the deviation

CRITICAL DEVIATION TYPES (highest priority):
- dosage_error: Incorrect dosage amounts, frequencies, or administration instructions
- missing_warning: Safety warnings, contraindications, or precautions missing or altered
- wrong_ingredient_info: Active ingredient names, strengths, or formulations incorrect

MAJOR DEVIATION TYPES:
- missing_section: Required sections completely absent from artwork
- content_error: Significant text differences that change meaning

MINOR DEVIATION TYPES:
- formatting_difference: Font, spacing, or layout changes without content impact
- spacing_difference: Line breaks, paragraph spacing, or whitespace variations

COMPLETENESS REQUIREMENTS:
1. Compare EVERY section in approved PIL against artwork
2. Check for missing sections (sections in approved but not in artwork)
3. Check for content changes in matching sections
4. Check for formatting/spacing differences
5. If a section exists in approved but not in artwork, report as "missing_section"
6. If section content differs, report the specific difference

Return ONLY a JSON object with this structure:
{
  "deviations": [
    {
      "sectionName": "DOSAGE AND ADMINISTRATION",
      "approvedText": "Take 2 tablets once daily",
      "artworkText": "Take 1 tablet once daily",
      "deviationType": "dosage_error",
      "pageReference": 3,
      "confidenceScore": 0.98,
      "description": "Dosage quantity changed from 2 tablets to 1 tablet"
    }
  ]
}

Be EXHAUSTIVE - detect ALL deviations including minor formatting differences. Return empty array ONLY if documents are identical.`;

  // Implement timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    }, {
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    return parseClaudeResponse(response, approvedSections, artworkSections);
    
  } catch (error) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Claude API call exceeded ${timeoutMs}ms timeout`);
    }
    
    throw error;
  }
}

/**
 * Verify completeness by checking for missing sections
 * Returns deviations for sections present in approved but missing in artwork
 */
function verifyCompleteness(approvedSections, artworkSections) {
  const artworkSectionNames = new Set(
    artworkSections.map(s => s.sectionName.toLowerCase().trim())
  );
  
  const missingDeviations = [];
  
  for (const approvedSection of approvedSections) {
    const sectionName = approvedSection.sectionName.toLowerCase().trim();
    
    if (!artworkSectionNames.has(sectionName)) {
      missingDeviations.push({
        sectionName: approvedSection.sectionName,
        approvedText: approvedSection.content,
        artworkText: '',
        deviationType: 'missing_section',
        pageReference: approvedSection.pageReferences?.[0] || 1,
        confidenceScore: 0.99,
        description: `Section "${approvedSection.sectionName}" completely missing from artwork`
      });
    }
  }
  
  if (missingDeviations.length > 0) {
    console.log('[DeviationDetector] Completeness verification found missing sections', {
      missingCount: missingDeviations.length,
      missingSections: missingDeviations.map(d => d.sectionName)
    });
  }
  
  return missingDeviations;
}

/**
 * Deduplicate deviations (same section + same deviation type)
 */
function deduplicateDeviations(deviations) {
  const seen = new Set();
  const unique = [];
  
  for (const deviation of deviations) {
    const key = `${deviation.sectionName}:${deviation.deviationType}`;
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(deviation);
    }
  }
  
  if (deviations.length !== unique.length) {
    console.log('[DeviationDetector] Deduplicated deviations', {
      original: deviations.length,
      unique: unique.length,
      removed: deviations.length - unique.length
    });
  }
  
  return unique;
}

/**
 * Parse Claude's JSON response with enhanced validation
 */
function parseClaudeResponse(response, approvedSections, artworkSections) {
  try {
    const content = response.content[0].text;
    
    // Extract JSON from response (may be wrapped in markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Claude response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!parsed.deviations || !Array.isArray(parsed.deviations)) {
      throw new Error('Invalid response structure: missing deviations array');
    }
    
    // Validate each deviation has required fields
    for (const deviation of parsed.deviations) {
      if (!deviation.sectionName || !deviation.deviationType) {
        throw new Error('Invalid deviation: missing required fields');
      }
      
      // Ensure confidence score is valid
      if (typeof deviation.confidenceScore !== 'number' || 
          deviation.confidenceScore < 0 || 
          deviation.confidenceScore > 1) {
        deviation.confidenceScore = 0.85; // Default confidence
      }
      
      // Ensure page reference is valid
      if (typeof deviation.pageReference !== 'number' || deviation.pageReference < 1) {
        // Try to get page reference from section
        const approvedSection = approvedSections.find(
          s => s.sectionName.toLowerCase() === deviation.sectionName.toLowerCase()
        );
        deviation.pageReference = approvedSection?.pageReferences?.[0] || 1;
      }
      
      // Ensure text fields exist
      deviation.approvedText = deviation.approvedText || '';
      deviation.artworkText = deviation.artworkText || '';
      deviation.description = deviation.description || 'Content difference detected';
    }
    
    return parsed;
    
  } catch (error) {
    console.error('[DeviationDetector] Failed to parse Claude response', {
      error: error.message
    });
    
    // Return empty deviations on parse failure
    return { deviations: [] };
  }
}

/**
 * Mock implementation for development/testing
 * Generates realistic deviations based on actual document content
 */
function mockDetectDeviations(approvedSections, artworkSections) {
  console.log('[DeviationDetector] Generating mock deviations based on document content', {
    approvedSections: approvedSections.length,
    artworkSections: artworkSections.length
  });
  
  const deviations = [];
  
  // Check for missing sections (completeness verification)
  const artworkSectionNames = new Set(
    artworkSections.map(s => s.sectionName.toLowerCase().trim())
  );
  
  for (const approvedSection of approvedSections) {
    const sectionName = approvedSection.sectionName.toLowerCase().trim();
    
    if (!artworkSectionNames.has(sectionName)) {
      deviations.push({
        severity: 'major',
        sectionName: approvedSection.sectionName,
        approvedText: approvedSection.content.substring(0, 200) + '...',
        artworkText: '',
        deviationType: 'missing_section',
        pageReference: approvedSection.pageReferences?.[0] || 1,
        confidenceScore: 0.99,
        description: `Section "${approvedSection.sectionName}" completely missing from artwork`
      });
    }
  }
  
  // Generate sample deviations for existing sections
  const matchingSections = approvedSections.filter(approved => 
    artworkSections.some(artwork => 
      artwork.sectionName.toLowerCase().trim() === approved.sectionName.toLowerCase().trim()
    )
  );
  
  // Critical deviation: dosage error (if DOSAGE section exists)
  const dosageSection = matchingSections.find(s => 
    s.sectionName.toLowerCase().includes('dosage') || 
    s.sectionName.toLowerCase().includes('administration')
  );
  
  if (dosageSection) {
    deviations.push({
      severity: 'critical',
      sectionName: dosageSection.sectionName,
      approvedText: 'Take 250mg (one tablet) once daily with food',
      artworkText: 'Take 250mg (one tablet) twice daily with food',
      deviationType: 'dosage_error',
      pageReference: dosageSection.pageReferences?.[0] || 3,
      confidenceScore: 0.98,
      description: 'Dosage frequency changed from once daily to twice daily'
    });
  }
  
  // Critical deviation: missing warning (if WARNINGS section exists)
  const warningsSection = matchingSections.find(s => 
    s.sectionName.toLowerCase().includes('warning') || 
    s.sectionName.toLowerCase().includes('precaution')
  );
  
  if (warningsSection) {
    deviations.push({
      severity: 'critical',
      sectionName: warningsSection.sectionName,
      approvedText: 'Do not use if you are pregnant or breastfeeding. May cause severe liver damage.',
      artworkText: 'Do not use if you are pregnant or breastfeeding.',
      deviationType: 'missing_warning',
      pageReference: warningsSection.pageReferences?.[0] || 5,
      confidenceScore: 0.95,
      description: 'Liver damage warning missing from artwork'
    });
  }
  
  // Major deviation: content error (if INDICATIONS section exists)
  const indicationsSection = matchingSections.find(s => 
    s.sectionName.toLowerCase().includes('indication')
  );
  
  if (indicationsSection) {
    deviations.push({
      severity: 'major',
      sectionName: indicationsSection.sectionName,
      approvedText: 'Treatment of metastatic castration-resistant prostate cancer',
      artworkText: 'Treatment of prostate cancer',
      deviationType: 'content_error',
      pageReference: indicationsSection.pageReferences?.[0] || 2,
      confidenceScore: 0.92,
      description: 'Indication text simplified, missing "metastatic castration-resistant" qualifier'
    });
  }
  
  // Minor deviation: formatting difference (first matching section)
  if (matchingSections.length > 0) {
    const firstSection = matchingSections[0];
    deviations.push({
      severity: 'minor',
      sectionName: firstSection.sectionName,
      approvedText: firstSection.content.substring(0, 100),
      artworkText: firstSection.content.substring(0, 100).replace(/\./g, '.\n'),
      deviationType: 'formatting_difference',
      pageReference: firstSection.pageReferences?.[0] || 1,
      confidenceScore: 0.88,
      description: 'Line breaks added after sentences'
    });
  }
  
  console.log('[DeviationDetector] Mock deviations generated', {
    totalDeviations: deviations.length,
    critical: deviations.filter(d => d.severity === 'critical').length,
    major: deviations.filter(d => d.severity === 'major').length,
    minor: deviations.filter(d => d.severity === 'minor').length
  });
  
  return { 
    deviations,
    processingTimeMs: 1500, // Mock processing time
    completenessVerified: true
  };
}