// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Classify PIL variation as complicated or general using Claude API
 * Complicated: Requires new Draft PIL (significant content changes, new indications, dosage changes)
 * General: Proceeds direct to AW (minor updates, formatting, contact info)
 */

/**
 * Classify variation between approved and updated PIL sections
 * @param {Array} approvedSections - Sections from approved PIL
 * @param {Array} updatedSections - Sections from change trigger document
 * @returns {Promise<Object>} Classification result with justification
 */
export async function classifyVariation(approvedSections, updatedSections) {
  if (USE_MOCK) {
    console.log('[Variation Classifier] Using mock classification (no Claude API key)');
    return mockClassifyVariation(approvedSections, updatedSections);
  }
  
  try {
    const AnthropicModule = await import('@anthropic-ai/sdk'); const Anthropic = AnthropicModule.default || AnthropicModule.Anthropic;
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    // Prepare section comparison data
    const sectionComparison = prepareSectionComparison(approvedSections, updatedSections);
    
    const prompt = `You are a pharmaceutical regulatory expert classifying PIL (Patient Information Leaflet) variations.

Classify this variation as either COMPLICATED or GENERAL based on the following criteria:

COMPLICATED variations require a new Draft PIL and include:
- Changes to active ingredients, dosage, or administration instructions
- New or modified indications/therapeutic uses
- New contraindications or warnings
- Significant safety information updates
- Changes to drug interactions or adverse reactions
- Modifications to storage conditions or shelf life
- Addition or removal of major sections

GENERAL variations proceed directly to artwork and include:
- Minor wording improvements or clarifications
- Contact information updates (phone, address, website)
- Formatting or layout changes
- Spelling/grammar corrections
- Updates to non-critical regulatory text
- Minor additions to existing sections without changing meaning

APPROVED PIL SECTIONS:
${JSON.stringify(approvedSections.map(s => ({ name: s.sectionName, content: s.content.substring(0, 500) })), null, 2)}

UPDATED PIL SECTIONS:
${JSON.stringify(updatedSections.map(s => ({ name: s.sectionName, content: s.content.substring(0, 500) })), null, 2)}

SECTION COMPARISON:
${JSON.stringify(sectionComparison, null, 2)}

Respond with ONLY a JSON object in this exact format:
{
  "classification": "COMPLICATED" or "GENERAL",
  "confidenceScore": 0.0-1.0,
  "justification": "Detailed explanation of classification decision",
  "keyChanges": ["List of 3-5 most significant changes detected"],
  "criticalSections": ["List of section names with critical changes"],
  "triggeringSections": ["sections that drove the classification"],
  "recommendedAction": "create-new-draft-pil" or "proceed-to-artwork"
}`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 2000,
      temperature: 0.3, // Lower temperature for more consistent classification
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const result = parseClaudeResponse(response);
    
    console.log('[Variation Classifier] Classification complete', {
      classification: result.classification,
      confidenceScore: result.confidenceScore,
      keyChangesCount: result.keyChanges.length,
      timestamp: new Date().toISOString()
    });
    
    return result;
    
  } catch (error) {
    console.error('[Variation Classifier] Classification failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Fallback to mock on API failure
    console.log('[Variation Classifier] Falling back to mock classification');
    return mockClassifyVariation(approvedSections, updatedSections);
  }
}

/**
 * Prepare section comparison data for Claude
 */
function prepareSectionComparison(approvedSections, updatedSections) {
  const comparison = [];
  
  // Create map of approved sections by name
  const approvedMap = new Map();
  approvedSections.forEach(section => {
    approvedMap.set(section.sectionName.toLowerCase(), section);
  });
  
  // Create map of updated sections by name
  const updatedMap = new Map();
  updatedSections.forEach(section => {
    updatedMap.set(section.sectionName.toLowerCase(), section);
  });
  
  // Find all unique section names
  const allSectionNames = new Set([
    ...approvedSections.map(s => s.sectionName.toLowerCase()),
    ...updatedSections.map(s => s.sectionName.toLowerCase())
  ]);
  
  allSectionNames.forEach(sectionName => {
    const approved = approvedMap.get(sectionName);
    const updated = updatedMap.get(sectionName);
    
    if (approved && updated) {
      // Section exists in both - compare content
      const contentChanged = approved.content !== updated.content;
      comparison.push({
        sectionName: approved.sectionName,
        status: contentChanged ? 'modified' : 'unchanged',
        approvedLength: approved.content.length,
        updatedLength: updated.content.length,
        lengthDelta: updated.content.length - approved.content.length
      });
    } else if (approved && !updated) {
      // Section removed
      comparison.push({
        sectionName: approved.sectionName,
        status: 'removed',
        approvedLength: approved.content.length,
        updatedLength: 0,
        lengthDelta: -approved.content.length
      });
    } else if (!approved && updated) {
      // Section added
      comparison.push({
        sectionName: updated.sectionName,
        status: 'added',
        approvedLength: 0,
        updatedLength: updated.content.length,
        lengthDelta: updated.content.length
      });
    }
  });
  
  return comparison;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(response) {
  try {
    const content = response.content[0].text;
    
    // Extract JSON from response (may be wrapped in markdown code blocks)
    let jsonText = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      // Try to find JSON object directly
      const objectMatch = content.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate required fields
    if (!parsed.classification || !['COMPLICATED', 'GENERAL'].includes(parsed.classification)) {
      throw new Error('Invalid classification value');
    }
    
    return {
      classification: parsed.classification.toLowerCase(), // Convert to lowercase for consistency
      confidenceScore: parsed.confidenceScore || 0.8,
      justification: parsed.justification || 'Classification based on content analysis',
      keyChanges: parsed.keyChanges || [],
      criticalSections: parsed.criticalSections || []
    };
    
  } catch (error) {
    console.error('[Variation Classifier] Failed to parse Claude response', {
      error: error.message,
      response: response.content[0].text.substring(0, 500)
    });
    
    // Return default complicated classification on parse failure (safer default)
    return {
      classification: 'complicated',
      confidenceScore: 0.5,
      justification: 'Unable to parse classification response. Defaulting to COMPLICATED for safety.',
      keyChanges: ['Parse error - manual review required'],
      criticalSections: []
    };
  }
}

/**
 * Mock classification for development/testing
 */
function mockClassifyVariation(approvedSections, updatedSections) {
  // Simple heuristic: classify as complicated if >30% of sections changed or any critical sections modified
  const comparison = prepareSectionComparison(approvedSections, updatedSections);
  
  const changedSections = comparison.filter(c => c.status !== 'unchanged');
  const changePercentage = (changedSections.length / comparison.length) * 100;
  
  const criticalSectionNames = [
    'dosage and administration',
    'contraindications',
    'warnings and precautions',
    'active ingredients',
    'indications',
    'drug interactions'
  ];
  
  const criticalChanges = changedSections.filter(c => 
    criticalSectionNames.some(critical => 
      c.sectionName.toLowerCase().includes(critical)
    )
  );
  
  const isComplicated = changePercentage > 30 || criticalChanges.length > 0;
  
  return {
    classification: isComplicated ? 'complicated' : 'general',
    confidenceScore: 0.75,
    justification: isComplicated 
      ? `Classified as COMPLICATED: ${changePercentage.toFixed(1)}% of sections changed (${changedSections.length}/${comparison.length}), including ${criticalChanges.length} critical section(s).`
      : `Classified as GENERAL: Only ${changePercentage.toFixed(1)}% of sections changed (${changedSections.length}/${comparison.length}) with no critical section modifications.`,
    keyChanges: changedSections.slice(0, 5).map(c => 
      `${c.sectionName}: ${c.status} (${c.lengthDelta > 0 ? '+' : ''}${c.lengthDelta} chars)`
    ),
    criticalSections: criticalChanges.map(c => c.sectionName)
  };
}