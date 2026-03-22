// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Generate section-by-section diff with significance scoring
 * Significance score (0-100): indicates magnitude of change impact
 */

/**
 * Generate detailed section diff between approved and updated PIL
 * @param {Array} approvedSections - Sections from approved PIL
 * @param {Array} updatedSections - Sections from updated PIL
 * @returns {Promise<Array>} Section diffs with significance scores
 */
export async function generateSectionDiff(approvedSections, updatedSections) {
  if (USE_MOCK) {
    console.log('[Diff Generator] Using mock diff generation (no Claude API key)');
    return mockGenerateSectionDiff(approvedSections, updatedSections);
  }
  
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    // Process sections in batches to avoid token limits
    const batchSize = 10;
    const allDiffs = [];
    
    // Create section pairs for comparison
    const sectionPairs = createSectionPairs(approvedSections, updatedSections);
    
    for (let i = 0; i < sectionPairs.length; i += batchSize) {
      const batch = sectionPairs.slice(i, i + batchSize);
      
      const prompt = `You are analyzing changes between approved and updated PIL sections.

For each section pair, determine:
1. Change type: added, removed, modified, or unchanged
2. Significance score (0-100):
   - 90-100: Critical changes (dosage, contraindications, active ingredients)
   - 70-89: Major changes (new warnings, indication changes, safety updates)
   - 40-69: Moderate changes (expanded explanations, additional details)
   - 20-39: Minor changes (wording improvements, clarifications)
   - 0-19: Trivial changes (formatting, punctuation, spelling)
3. Brief change summary

SECTION PAIRS TO ANALYZE:
${JSON.stringify(batch, null, 2)}

Respond with ONLY a JSON array in this exact format:
[
  {
    "sectionName": "Section name",
    "changeType": "added|removed|modified|unchanged",
    "significanceScore": 0-100,
    "changeSummary": "Brief description of what changed",
    "approvedText": "First 200 chars of approved text or empty string",
    "updatedText": "First 200 chars of updated text or empty string",
    "impactArea": "safety|efficacy|administrative|formatting"
  }
]`;

      const response = await client.messages.create({
        model: CLAUDE_MODEL,
        max_tokens: 4000,
        temperature: 0.2, // Low temperature for consistent scoring
        messages: [{
          role: 'user',
          content: prompt
        }]
      });
      
      const batchDiffs = parseDiffResponse(response, batch);
      allDiffs.push(...batchDiffs);
    }
    
    console.log('[Diff Generator] Diff generation complete', {
      totalSections: allDiffs.length,
      sectionsChanged: allDiffs.filter(d => d.changeType !== 'unchanged').length,
      timestamp: new Date().toISOString()
    });
    
    return allDiffs;
    
  } catch (error) {
    console.error('[Diff Generator] Diff generation failed', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    // Fallback to mock on API failure
    console.log('[Diff Generator] Falling back to mock diff generation');
    return mockGenerateSectionDiff(approvedSections, updatedSections);
  }
}

/**
 * Create section pairs for comparison
 */
function createSectionPairs(approvedSections, updatedSections) {
  const pairs = [];
  
  // Create maps for quick lookup
  const approvedMap = new Map();
  approvedSections.forEach(section => {
    approvedMap.set(section.sectionName.toLowerCase(), section);
  });
  
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
    
    pairs.push({
      sectionName: approved?.sectionName || updated?.sectionName || sectionName,
      approvedText: approved?.content || '',
      updatedText: updated?.content || '',
      approvedExists: !!approved,
      updatedExists: !!updated
    });
  });
  
  return pairs;
}

/**
 * Parse Claude's diff response
 */
function parseDiffResponse(response, sectionPairs) {
  try {
    const content = response.content[0].text;
    
    // Extract JSON from response
    let jsonText = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonText = arrayMatch[0];
      }
    }
    
    const parsed = JSON.parse(jsonText);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    
    // Validate and normalize each diff entry
    return parsed.map((diff, index) => {
      const pair = sectionPairs[index] || {};
      
      return {
        sectionName: diff.sectionName || pair.sectionName || 'Unknown Section',
        changeType: validateChangeType(diff.changeType),
        significanceScore: clampScore(diff.significanceScore),
        changeSummary: diff.changeSummary || 'No summary provided',
        approvedText: (diff.approvedText || pair.approvedText || '').substring(0, 200),
        updatedText: (diff.updatedText || pair.updatedText || '').substring(0, 200)
      };
    });
    
  } catch (error) {
    console.error('[Diff Generator] Failed to parse diff response', {
      error: error.message,
      response: response.content[0].text.substring(0, 500)
    });
    
    // Return basic diffs based on section pairs
    return sectionPairs.map(pair => ({
      sectionName: pair.sectionName,
      changeType: determineChangeType(pair),
      significanceScore: 50, // Default moderate significance
      changeSummary: 'Unable to analyze - manual review required',
      approvedText: pair.approvedText.substring(0, 200),
      updatedText: pair.updatedText.substring(0, 200)
    }));
  }
}

/**
 * Validate change type
 */
function validateChangeType(changeType) {
  const validTypes = ['added', 'removed', 'modified', 'unchanged'];
  return validTypes.includes(changeType) ? changeType : 'modified';
}

/**
 * Clamp significance score to 0-100 range
 */
function clampScore(score) {
  const numScore = Number(score);
  if (isNaN(numScore)) return 50;
  return Math.max(0, Math.min(100, Math.round(numScore)));
}

/**
 * Determine change type from section pair
 */
function determineChangeType(pair) {
  if (!pair.approvedExists && pair.updatedExists) return 'added';
  if (pair.approvedExists && !pair.updatedExists) return 'removed';
  if (pair.approvedText === pair.updatedText) return 'unchanged';
  return 'modified';
}

/**
 * Mock diff generation for development/testing
 */
function mockGenerateSectionDiff(approvedSections, updatedSections) {
  const pairs = createSectionPairs(approvedSections, updatedSections);
  
  return pairs.map(pair => {
    const changeType = determineChangeType(pair);
    
    // Calculate significance based on change type and content length delta
    let significanceScore = 0;
    
    if (changeType === 'unchanged') {
      significanceScore = 0;
    } else if (changeType === 'added' || changeType === 'removed') {
      // New or removed sections are significant
      significanceScore = 70;
      
      // Critical sections get higher scores
      const criticalKeywords = ['dosage', 'contraindication', 'warning', 'active ingredient', 'indication'];
      if (criticalKeywords.some(keyword => pair.sectionName.toLowerCase().includes(keyword))) {
        significanceScore = 95;
      }
    } else {
      // Modified sections - score based on content delta
      const lengthDelta = Math.abs(pair.updatedText.length - pair.approvedText.length);
      const avgLength = (pair.updatedText.length + pair.approvedText.length) / 2;
      const changePercentage = avgLength > 0 ? (lengthDelta / avgLength) * 100 : 0;
      
      if (changePercentage > 50) {
        significanceScore = 80; // Major rewrite
      } else if (changePercentage > 20) {
        significanceScore = 60; // Moderate changes
      } else if (changePercentage > 5) {
        significanceScore = 30; // Minor changes
      } else {
        significanceScore = 10; // Trivial changes
      }
      
      // Boost score for critical sections
      const criticalKeywords = ['dosage', 'contraindication', 'warning', 'active ingredient'];
      if (criticalKeywords.some(keyword => pair.sectionName.toLowerCase().includes(keyword))) {
        significanceScore = Math.min(100, significanceScore + 20);
      }
    }
    
    return {
      sectionName: pair.sectionName,
      changeType,
      significanceScore,
      changeSummary: generateChangeSummary(changeType, pair),
      approvedText: pair.approvedText.substring(0, 200),
      updatedText: pair.updatedText.substring(0, 200)
    };
  });
}

/**
 * Generate change summary for mock diff
 */
function generateChangeSummary(changeType, pair) {
  switch (changeType) {
    case 'added':
      return `New section added (${pair.updatedText.length} characters)`;
    case 'removed':
      return `Section removed (was ${pair.approvedText.length} characters)`;
    case 'unchanged':
      return 'No changes detected';
    case 'modified':
      const delta = pair.updatedText.length - pair.approvedText.length;
      return `Content modified (${delta > 0 ? '+' : ''}${delta} characters)`;
    default:
      return 'Change detected';
  }
}