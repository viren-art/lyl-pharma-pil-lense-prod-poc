import { classifySeverity } from './severityScorer.js';

// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !ANTHROPIC_API_KEY;

/**
 * Detect deviations between Approved PIL and AW Draft
 * Returns array of deviations with severity classification
 */
export async function detectDeviations(approvedSections, artworkSections) {
  if (USE_MOCK) {
    console.log('[DeviationDetector] Using mock implementation (no Claude API key)');
    return mockDetectDeviations(approvedSections, artworkSections);
  }
  
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });
    
    const prompt = `You are analyzing deviations between an approved PIL (Patient Information Leaflet) and an artwork draft.

APPROVED PIL SECTIONS:
${JSON.stringify(approvedSections, null, 2)}

ARTWORK DRAFT SECTIONS:
${JSON.stringify(artworkSections, null, 2)}

TASK: Detect ALL deviations between the approved PIL and artwork draft. For each deviation, provide:
1. sectionName: The section where the deviation occurs
2. approvedText: The exact text from the approved PIL
3. artworkText: The exact text from the artwork draft
4. deviationType: One of: "dosage_error", "missing_warning", "wrong_ingredient_info", "missing_section", "content_error", "formatting_difference", "spacing_difference"
5. pageReference: The page number where the deviation appears in the artwork
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

Be thorough - detect even minor formatting differences. Return empty array if no deviations found.`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const result = parseClaudeResponse(response);
    
    // Classify severity for each deviation
    const deviationsWithSeverity = result.deviations.map(deviation => ({
      ...deviation,
      severity: classifySeverity(deviation.deviationType)
    }));
    
    console.log('[DeviationDetector] Detection complete', {
      totalDeviations: deviationsWithSeverity.length,
      critical: deviationsWithSeverity.filter(d => d.severity === 'critical').length,
      major: deviationsWithSeverity.filter(d => d.severity === 'major').length,
      minor: deviationsWithSeverity.filter(d => d.severity === 'minor').length
    });
    
    return {
      deviations: deviationsWithSeverity
    };
    
  } catch (error) {
    console.error('[DeviationDetector] Detection failed', {
      error: error.message,
      stack: error.stack
    });
    
    throw new Error(`Deviation detection failed: ${error.message}`);
  }
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(response) {
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
        deviation.pageReference = 1; // Default to page 1
      }
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
 */
function mockDetectDeviations(approvedSections, artworkSections) {
  console.log('[DeviationDetector] Generating mock deviations');
  
  const deviations = [];
  
  // Critical deviation: dosage error
  if (approvedSections.length > 0 && artworkSections.length > 0) {
    deviations.push({
      severity: 'critical',
      sectionName: 'DOSAGE AND ADMINISTRATION',
      approvedText: 'Take 250mg (one tablet) once daily with food',
      artworkText: 'Take 250mg (one tablet) twice daily with food',
      deviationType: 'dosage_error',
      pageReference: 3,
      confidenceScore: 0.98,
      description: 'Dosage frequency changed from once daily to twice daily'
    });
  }
  
  // Critical deviation: missing warning
  if (approvedSections.length > 1) {
    deviations.push({
      severity: 'critical',
      sectionName: 'WARNINGS AND PRECAUTIONS',
      approvedText: 'Do not use if you are pregnant or breastfeeding. May cause severe liver damage.',
      artworkText: 'Do not use if you are pregnant or breastfeeding.',
      deviationType: 'missing_warning',
      pageReference: 5,
      confidenceScore: 0.95,
      description: 'Liver damage warning missing from artwork'
    });
  }
  
  // Major deviation: content error
  if (approvedSections.length > 2) {
    deviations.push({
      severity: 'major',
      sectionName: 'INDICATIONS',
      approvedText: 'Treatment of metastatic castration-resistant prostate cancer',
      artworkText: 'Treatment of prostate cancer',
      deviationType: 'content_error',
      pageReference: 2,
      confidenceScore: 0.92,
      description: 'Indication text simplified, missing "metastatic castration-resistant" qualifier'
    });
  }
  
  // Major deviation: missing section
  if (approvedSections.length > 3) {
    deviations.push({
      severity: 'major',
      sectionName: 'ADVERSE REACTIONS',
      approvedText: 'Common side effects include fatigue, nausea, diarrhea, and hypertension. Serious reactions may include hepatotoxicity and cardiovascular events.',
      artworkText: '',
      deviationType: 'missing_section',
      pageReference: 6,
      confidenceScore: 0.99,
      description: 'ADVERSE REACTIONS section completely missing from artwork'
    });
  }
  
  // Minor deviation: formatting difference
  if (approvedSections.length > 4) {
    deviations.push({
      severity: 'minor',
      sectionName: 'STORAGE',
      approvedText: 'Store at room temperature (15-30°C). Keep away from moisture.',
      artworkText: 'Store at room temperature (15-30°C).\nKeep away from moisture.',
      deviationType: 'formatting_difference',
      pageReference: 8,
      confidenceScore: 0.88,
      description: 'Line break added between storage instructions'
    });
  }
  
  // Minor deviation: spacing difference
  if (approvedSections.length > 5) {
    deviations.push({
      severity: 'minor',
      sectionName: 'PRODUCT NAME',
      approvedText: 'Zenora (Abiraterone Acetate) 250mg',
      artworkText: 'Zenora  (Abiraterone Acetate)  250mg',
      deviationType: 'spacing_difference',
      pageReference: 1,
      confidenceScore: 0.75,
      description: 'Extra spacing added around parentheses'
    });
  }
  
  return { deviations };
}