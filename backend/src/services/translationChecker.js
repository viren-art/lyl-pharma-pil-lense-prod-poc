// LYL_DEP: @anthropic-ai/sdk@^0.9.0

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Generate translation checklist for CJK/Thai content
 * Identifies sections requiring translation and assesses complexity
 */
export async function generateTranslationChecklist(innovatorSections, marketFormatSections) {
  if (USE_MOCK) {
    return mockGenerateTranslationChecklist(innovatorSections, marketFormatSections);
  }
  
  try {
    const AnthropicModule = await import('@anthropic-ai/sdk'); const Anthropic = AnthropicModule.default || AnthropicModule.Anthropic;
    const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
    
    const prompt = `You are creating a translation checklist for pharmaceutical PIL content.

INNOVATOR PIL SECTIONS:
${innovatorSections.map(s => `- ${s.sectionName}: ${s.content.substring(0, 300)}...`).join('\n')}

TARGET MARKET FORMAT:
${marketFormatSections.map(s => `- ${s.sectionName}`).join('\n')}

Task: Identify all sections requiring translation and assess complexity.

Analyze:
1. Detect source language (English, Chinese, Thai, Korean, Japanese)
2. Determine target language based on market format
3. Assess translation complexity based on:
   - Technical terminology (high complexity)
   - Dosage tables and measurements (high complexity)
   - Chemical formulas (high complexity)
   - Standard warnings (medium complexity)
   - General information (low complexity)
4. Flag sections requiring specialized medical translator

Return JSON array:
[
  {
    "section": "DOSAGE AND ADMINISTRATION",
    "sourceLanguage": "en|zh|th|ko|ja",
    "targetLanguage": "zh-TW|th|en",
    "complexity": "high|medium|low",
    "reason": "Contains dosage tables with precise measurements",
    "requiresSpecialist": true|false,
    "specialTerms": ["abiraterone acetate", "hepatotoxicity"],
    "estimatedWords": 500,
    "specialInstructions": "Preserve table formatting, verify measurement units"
  }
]

Additionally, flag any section containing:
- Dosage tables (need careful layout preservation)
- Chemical formulas (need exact character reproduction)
- Numerical data (dosage amounts, concentrations, percentages)
- Regulatory-specific phrases (must match TFDA/Thai FDA exact wording)`;

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
    
    // Enhance with page references and confidence scores
    const enhancedChecklist = result.map(item => {
      const section = innovatorSections.find(s => s.sectionName === item.section);
      return {
        ...item,
        pageReferences: section?.pageReferences || [],
        confidenceScore: section?.confidenceScore || 0.0,
        contentPreview: section?.content.substring(0, 200) || ''
      };
    });
    
    console.log('Translation checklist generated', {
      totalItems: enhancedChecklist.length,
      highComplexity: enhancedChecklist.filter(i => i.complexity === 'high').length,
      requiresSpecialist: enhancedChecklist.filter(i => i.requiresSpecialist).length
    });
    
    return enhancedChecklist;
    
  } catch (error) {
    console.error('Translation checklist generation failed', {
      error: error.message,
      stack: error.stack
    });
    throw new Error(`Translation checklist generation failed: ${error.message}`);
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
    
    return parsed;
    
  } catch (error) {
    console.error('Failed to parse Claude response', { error: error.message });
    return [];
  }
}

/**
 * Mock implementation for development
 */
function mockGenerateTranslationChecklist(innovatorSections, marketFormatSections) {
  console.log('Using mock translation checklist generation');
  
  const checklist = [];
  
  innovatorSections.forEach(section => {
    // Detect language based on character sets
    let sourceLanguage = 'en';
    let targetLanguage = 'zh-TW';
    
    if (/[\u4E00-\u9FFF]/.test(section.content)) {
      sourceLanguage = 'zh';
      targetLanguage = 'en';
    } else if (/[\u0E00-\u0E7F]/.test(section.content)) {
      sourceLanguage = 'th';
      targetLanguage = 'en';
    } else if (/[\uAC00-\uD7AF]/.test(section.content)) {
      sourceLanguage = 'ko';
      targetLanguage = 'en';
    } else if (/[\u3040-\u309F\u30A0-\u30FF]/.test(section.content)) {
      sourceLanguage = 'ja';
      targetLanguage = 'en';
    }
    
    // Only add to checklist if translation needed
    if (sourceLanguage !== 'en' || targetLanguage !== 'en') {
      const complexity = section.sectionName.toLowerCase().includes('dosage') ||
                        section.sectionName.toLowerCase().includes('administration') ||
                        section.sectionName.toLowerCase().includes('contraindication')
                        ? 'high' : 'medium';
      
      checklist.push({
        section: section.sectionName,
        sourceLanguage,
        targetLanguage,
        complexity,
        reason: `Translation from ${sourceLanguage} to ${targetLanguage} required`,
        requiresSpecialist: complexity === 'high',
        estimatedWords: Math.floor(section.content.length / 5),
        specialInstructions: complexity === 'high' 
          ? 'Verify technical terminology and measurements'
          : 'Standard translation',
        pageReferences: section.pageReferences,
        confidenceScore: section.confidenceScore,
        contentPreview: section.content.substring(0, 200)
      });
    }
  });
  
  return checklist;
}