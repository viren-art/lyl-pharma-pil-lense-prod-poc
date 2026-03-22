// LYL_DEP: @anthropic-ai/sdk@^0.9.0

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Align Innovator PIL sections to Local Market PIL Format
 * Uses semantic comparison to map sections across different naming conventions
 */
export async function alignSections(innovatorSections, marketFormatSections, regulatorySections) {
  if (USE_MOCK) {
    return mockAlignSections(innovatorSections, marketFormatSections);
  }
  
  try {
    const AnthropicModule = await import('@anthropic-ai/sdk'); const Anthropic = AnthropicModule.default || AnthropicModule.Anthropic;
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    const prompt = `You are aligning pharmaceutical PIL sections from an innovator document to a target market format.

INNOVATOR PIL SECTIONS:
${innovatorSections.map((s, i) => `${i + 1}. ${s.sectionName}`).join('\n')}

TARGET MARKET FORMAT SECTIONS (required order):
${marketFormatSections.map((s, i) => `${i + 1}. ${s.sectionName}`).join('\n')}

REGULATORY SOURCE SECTIONS (for reference):
${regulatorySections.map((s, i) => `${i + 1}. ${s.sectionName}`).join('\n')}

Task: Map each Innovator PIL section to the corresponding Local Market section requirement.
Matching is by MEANING not exact name — "WARNINGS AND PRECAUTIONS" matches "WARNINGS" matches "特別警告與注意事項".

For each mapping:
{
  "innovatorSection": "DOSAGE AND ADMINISTRATION",
  "localMarketSection": "4.2 用法用量",
  "alignmentStatus": "aligned" | "gap" | "conflict",
  "notes": "explain any gaps or conflicts"
}

Rules:
1. Each target section must be mapped to exactly one innovator section
2. Multiple target sections can map to the same innovator section if content overlaps
3. Calculate mapping confidence (0.0-1.0) based on semantic similarity
4. Consider regulatory requirements when mapping
5. If no good match exists, set innovatorSection to "NOT_FOUND" with low confidence
6. Handle cross-language matching (English, Traditional Chinese, Thai)

Return JSON array:
[
  {
    "targetSection": "PRODUCT NAME",
    "innovatorSection": "Product Information",
    "mappingConfidence": 0.95,
    "notes": "Direct match with high confidence"
  },
  ...
]`;

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
    
    // Validate and enhance alignment results
    const enhancedAlignment = result.map(alignment => ({
      ...alignment,
      targetSectionContent: marketFormatSections.find(s => s.sectionName === alignment.targetSection)?.content || '',
      innovatorSectionContent: innovatorSections.find(s => s.sectionName === alignment.innovatorSection)?.content || '',
      pageReferences: innovatorSections.find(s => s.sectionName === alignment.innovatorSection)?.pageReferences || []
    }));
    
    console.log('Section alignment completed', {
      totalMappings: enhancedAlignment.length,
      highConfidence: enhancedAlignment.filter(a => a.mappingConfidence >= 0.8).length,
      notFound: enhancedAlignment.filter(a => a.innovatorSection === 'NOT_FOUND').length
    });
    
    return enhancedAlignment;
    
  } catch (error) {
    console.error('Section alignment failed', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Section alignment failed: ${error.message}`);
  }
}

/**
 * Parse Claude JSON response
 */
function parseClaudeResponse(response) {
  try {
    const content = response.content[0].text;
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    
    if (!jsonMatch) {
      throw new Error('No JSON array found in response');
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed)) {
      throw new Error('Response is not an array');
    }
    
    // Validate structure
    parsed.forEach((item, index) => {
      if (!item.targetSection || !item.innovatorSection || typeof item.mappingConfidence !== 'number') {
        throw new Error(`Invalid alignment item at index ${index}`);
      }
    });
    
    return parsed;
    
  } catch (error) {
    console.error('Failed to parse Claude response', { error: error.message });
    return [];
  }
}

/**
 * Mock implementation for development
 */
function mockAlignSections(innovatorSections, marketFormatSections) {
  console.log('Using mock section alignment');
  
  // Simple keyword-based matching for mock
  const alignment = marketFormatSections.map(targetSection => {
    // Try to find best match based on keyword overlap
    let bestMatch = null;
    let bestScore = 0;
    
    innovatorSections.forEach(innovatorSection => {
      const targetWords = new Set(targetSection.sectionName.toLowerCase().split(/\s+/));
      const innovatorWords = new Set(innovatorSection.sectionName.toLowerCase().split(/\s+/));
      
      const intersection = new Set([...targetWords].filter(w => innovatorWords.has(w)));
      const score = intersection.size / Math.max(targetWords.size, innovatorWords.size);
      
      if (score > bestScore) {
        bestScore = score;
        bestMatch = innovatorSection;
      }
    });
    
    return {
      targetSection: targetSection.sectionName,
      innovatorSection: bestMatch ? bestMatch.sectionName : 'NOT_FOUND',
      mappingConfidence: bestMatch ? Math.min(0.95, bestScore + 0.3) : 0.2,
      notes: bestMatch ? 'Keyword-based match (mock)' : 'No suitable match found',
      targetSectionContent: targetSection.content,
      innovatorSectionContent: bestMatch?.content || '',
      pageReferences: bestMatch?.pageReferences || []
    };
  });
  
  return alignment;
}