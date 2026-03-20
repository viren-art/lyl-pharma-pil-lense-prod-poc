// LYL_DEP: @anthropic-ai/sdk@^0.9.0

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Analyze content gaps between Innovator PIL and target market requirements
 * Identifies missing sections, incomplete content, and regulatory compliance gaps
 */
export async function analyzeGaps(innovatorSections, marketFormatSections, regulatorySections) {
  if (USE_MOCK) {
    return mockAnalyzeGaps(innovatorSections, marketFormatSections, regulatorySections);
  }
  
  try {
    const { Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    const prompt = `You are analyzing content gaps in a pharmaceutical PIL draft.

INNOVATOR PIL SECTIONS:
${innovatorSections.map(s => `- ${s.sectionName}: ${s.content.substring(0, 200)}...`).join('\n')}

TARGET MARKET FORMAT REQUIREMENTS:
${marketFormatSections.map(s => `- ${s.sectionName} (REQUIRED)`).join('\n')}

REGULATORY SOURCE REQUIREMENTS:
${regulatorySections.map(s => `- ${s.sectionName}: ${s.content.substring(0, 200)}...`).join('\n')}

Task: Identify all content gaps that must be addressed before PIL approval.

Analyze:
1. Missing sections - Required sections not present in innovator PIL
2. Incomplete content - Sections present but missing critical information
3. Translation requirements - Content needing translation from source language
4. Special attention items - Complex content requiring expert review

Return JSON:
{
  "missingSections": [
    {
      "sectionName": "STORAGE CONDITIONS",
      "reason": "Required by target market but not in innovator PIL",
      "severity": "critical|major|minor",
      "suggestedSource": "regulatory_source|market_format|new_content"
    }
  ],
  "incompleteContent": [
    {
      "sectionName": "CONTRAINDICATIONS",
      "missingElements": ["pregnancy warnings", "pediatric use"],
      "severity": "critical|major|minor"
    }
  ],
  "translationRequired": [
    {
      "section": "DOSAGE AND ADMINISTRATION",
      "sourceLanguage": "en",
      "targetLanguage": "zh-TW|th",
      "complexity": "high|medium|low",
      "reason": "Contains dosage tables and technical terminology"
    }
  ],
  "specialAttentionFlags": [
    {
      "section": "ACTIVE INGREDIENTS",
      "reason": "chemical_formula|dosage_table|complex_table",
      "description": "Detailed explanation"
    }
  ]
}`;

    const response = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 4000,
      temperature: 0.3,
      messages: [{
        role: 'user',
        content: prompt
      }]
    });
    
    const result = parseClaudeResponse(response);
    
    // Enhance with page references
    const enhancedResult = {
      missingSections: result.missingSections || [],
      incompleteContent: (result.incompleteContent || []).map(item => ({
        ...item,
        pageReferences: innovatorSections.find(s => s.sectionName === item.sectionName)?.pageReferences || []
      })),
      translationRequired: (result.translationRequired || []).map(item => ({
        ...item,
        pageReferences: innovatorSections.find(s => s.sectionName === item.section)?.pageReferences || []
      })),
      specialAttentionFlags: (result.specialAttentionFlags || []).map(item => ({
        ...item,
        pageReferences: innovatorSections.find(s => s.sectionName === item.section)?.pageReferences || []
      }))
    };
    
    console.log('Gap analysis completed', {
      missingSections: enhancedResult.missingSections.length,
      incompleteContent: enhancedResult.incompleteContent.length,
      translationRequired: enhancedResult.translationRequired.length,
      specialAttentionFlags: enhancedResult.specialAttentionFlags.length
    });
    
    return enhancedResult;
    
  } catch (error) {
    console.error('Gap analysis failed', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Gap analysis failed: ${error.message}`);
  }
}

/**
 * Parse Claude JSON response
 */
function parseClaudeResponse(response) {
  try {
    const content = response.content[0].text;
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    
    if (!jsonMatch) {
      throw new Error('No JSON object found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    return {
      missingSections: parsed.missingSections || [],
      incompleteContent: parsed.incompleteContent || [],
      translationRequired: parsed.translationRequired || [],
      specialAttentionFlags: parsed.specialAttentionFlags || []
    };
    
  } catch (error) {
    console.error('Failed to parse Claude response', { error: error.message });
    return {
      missingSections: [],
      incompleteContent: [],
      translationRequired: [],
      specialAttentionFlags: []
    };
  }
}

/**
 * Mock implementation for development
 */
function mockAnalyzeGaps(innovatorSections, marketFormatSections, regulatorySections) {
  console.log('Using mock gap analysis');
  
  // Find sections in market format but not in innovator
  const innovatorSectionNames = new Set(innovatorSections.map(s => s.sectionName.toLowerCase()));
  const missingSections = marketFormatSections
    .filter(s => !innovatorSectionNames.has(s.sectionName.toLowerCase()))
    .map(s => ({
      sectionName: s.sectionName,
      reason: 'Required by target market but not in innovator PIL',
      severity: 'major',
      suggestedSource: 'regulatory_source'
    }));
  
  // Detect CJK/Thai content needing translation
  const translationRequired = innovatorSections
    .filter(s => {
      // Check for CJK characters (Chinese, Japanese, Korean)
      const hasCJK = /[\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(s.content);
      // Check for Thai characters
      const hasThai = /[\u0E00-\u0E7F]/.test(s.content);
      return hasCJK || hasThai;
    })
    .map(s => ({
      section: s.sectionName,
      sourceLanguage: /[\u0E00-\u0E7F]/.test(s.content) ? 'th' : 'zh',
      targetLanguage: 'en',
      complexity: s.sectionName.toLowerCase().includes('dosage') ? 'high' : 'medium',
      reason: 'Contains non-English content requiring translation',
      pageReferences: s.pageReferences
    }));
  
  return {
    missingSections,
    incompleteContent: [],
    translationRequired,
    specialAttentionFlags: []
  };
}