// LYL_DEP: @anthropic-ai/sdk@^0.9.0
// LYL_DEP: dotenv@^16.3.1

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CLAUDE_MODEL = 'claude-3-5-sonnet-20241022';
const USE_MOCK = !CLAUDE_API_KEY;

/**
 * Stage 2: Semantic intelligence using Claude API
 * Performs workflow-specific analysis on extracted content
 */

/**
 * Analyze deviation between approved PIL and artwork draft
 * Used by Review AW workflow
 */
export async function analyzeDeviations(approvedSections, artworkSections) {
  console.info('Starting deviation analysis', {
    approvedSectionCount: approvedSections.length,
    artworkSectionCount: artworkSections.length
  });
  
  if (USE_MOCK) {
    return mockDeviationAnalysis(approvedSections, artworkSections);
  }
  
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  
  const prompt = `You are analyzing deviations between an approved PIL and an artwork draft.

APPROVED PIL SECTIONS:
${JSON.stringify(approvedSections, null, 2)}

ARTWORK DRAFT SECTIONS:
${JSON.stringify(artworkSections, null, 2)}

Identify all deviations and classify by severity:
- CRITICAL: Dosage errors, missing warnings, wrong active ingredient information, contraindication changes
- MAJOR: Missing sections, significant content errors, regulatory text changes
- MINOR: Formatting differences, spacing issues, non-critical typos

Return JSON array:
[
  {
    "severity": "critical|major|minor",
    "sectionName": "SECTION NAME",
    "approvedText": "text from approved PIL",
    "artworkText": "text from artwork draft",
    "pageReference": 3,
    "confidenceScore": 0.95
  }
]

Focus on pharmaceutical accuracy. Return valid JSON only.`;
  
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return parseClaudeJSON(response.content[0].text);
}

/**
 * Classify variation as complicated or general
 * Used by Assess Variation workflow
 */
export async function classifyVariation(approvedSections, updatedSections) {
  console.info('Starting variation classification', {
    approvedSectionCount: approvedSections.length,
    updatedSectionCount: updatedSections.length
  });
  
  if (USE_MOCK) {
    return mockVariationClassification(approvedSections, updatedSections);
  }
  
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  
  const prompt = `Classify this PIL variation as COMPLICATED or GENERAL.

APPROVED PIL:
${JSON.stringify(approvedSections, null, 2)}

UPDATED PIL:
${JSON.stringify(updatedSections, null, 2)}

Classification rules:
- COMPLICATED: New sections added, dosage changes, indication changes, new warnings, contraindication changes
- GENERAL: Minor text updates, formatting changes, clarifications without new medical information

Return JSON:
{
  "classification": "complicated|general",
  "justification": "Detailed explanation of classification decision",
  "sectionDiffs": [
    {
      "sectionName": "SECTION NAME",
      "approvedText": "original text",
      "updatedText": "new text",
      "significanceScore": 0.85,
      "changeType": "added|removed|modified|unchanged"
    }
  ]
}

Return valid JSON only.`;
  
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return parseClaudeJSON(response.content[0].text);
}

/**
 * Generate draft outline with section alignment and gap analysis
 * Used by Create PIL Draft workflow
 */
export async function generateDraftOutline(innovatorSections, regulatorySections, marketFormatSections) {
  console.info('Starting draft outline generation', {
    innovatorSectionCount: innovatorSections.length,
    regulatorySectionCount: regulatorySections.length,
    marketFormatSectionCount: marketFormatSections.length
  });
  
  if (USE_MOCK) {
    return mockDraftOutline(innovatorSections, regulatorySections, marketFormatSections);
  }
  
  const { Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: CLAUDE_API_KEY });
  
  const prompt = `Generate a PIL draft outline by aligning innovator content to target market format.

INNOVATOR PIL:
${JSON.stringify(innovatorSections, null, 2)}

REGULATORY SOURCE:
${JSON.stringify(regulatorySections, null, 2)}

TARGET MARKET FORMAT:
${JSON.stringify(marketFormatSections, null, 2)}

Return JSON:
{
  "sectionAlignment": [
    {
      "targetSection": "TARGET SECTION NAME",
      "innovatorSection": "INNOVATOR SECTION NAME",
      "mappingConfidence": 0.92
    }
  ],
  "gapAnalysis": {
    "missingSections": ["SECTION1", "SECTION2"],
    "translationRequired": [
      {
        "section": "SECTION NAME",
        "sourceLanguage": "en",
        "targetLanguage": "th",
        "complexity": "low|medium|high"
      }
    ],
    "specialAttentionFlags": [
      {
        "section": "DOSAGE AND ADMINISTRATION",
        "reason": "dosage_table",
        "pageReferences": [3, 4]
      }
    ]
  },
  "translationChecklist": [
    {
      "section": "SECTION NAME",
      "sourceLanguage": "en",
      "targetLanguage": "th",
      "complexity": "medium"
    }
  ]
}

Flag dosage tables and chemical formulas for special attention. Return valid JSON only.`;
  
  const response = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }]
  });
  
  return parseClaudeJSON(response.content[0].text);
}

/**
 * Parse Claude JSON response with error handling
 */
function parseClaudeJSON(responseText) {
  try {
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    return JSON.parse(jsonText);
  } catch (error) {
    console.error('Failed to parse Claude response', {
      error: error.message,
      responseText: responseText.substring(0, 200)
    });
    throw new Error('Invalid JSON response from Claude API');
  }
}

/**
 * Mock implementations for development
 */
function mockDeviationAnalysis(approvedSections, artworkSections) {
  return [
    {
      severity: 'critical',
      sectionName: 'DOSAGE AND ADMINISTRATION',
      approvedText: 'Adults: 250mg once daily',
      artworkText: 'Adults: 500mg once daily',
      pageReference: 3,
      confidenceScore: 0.96
    },
    {
      severity: 'major',
      sectionName: 'WARNINGS AND PRECAUTIONS',
      approvedText: 'Monitor liver function regularly',
      artworkText: 'Monitor kidney function regularly',
      pageReference: 4,
      confidenceScore: 0.92
    },
    {
      severity: 'minor',
      sectionName: 'STORAGE',
      approvedText: 'Store at 15-30°C',
      artworkText: 'Store at 15-30 °C',
      pageReference: 5,
      confidenceScore: 0.88
    }
  ];
}

function mockVariationClassification(approvedSections, updatedSections) {
  return {
    classification: 'complicated',
    justification: 'New warning added regarding hepatic impairment, dosage adjustment required for elderly patients',
    sectionDiffs: [
      {
        sectionName: 'WARNINGS AND PRECAUTIONS',
        approvedText: 'Use with caution in patients with renal impairment',
        updatedText: 'Use with caution in patients with renal or hepatic impairment. Monitor liver enzymes.',
        significanceScore: 0.85,
        changeType: 'modified'
      },
      {
        sectionName: 'DOSAGE AND ADMINISTRATION',
        approvedText: 'Adults: 250mg once daily',
        updatedText: 'Adults: 250mg once daily. Elderly (>65 years): 125mg once daily',
        significanceScore: 0.78,
        changeType: 'modified'
      }
    ]
  };
}

function mockDraftOutline(innovatorSections, regulatorySections, marketFormatSections) {
  return {
    sectionAlignment: [
      {
        targetSection: 'PRODUCT NAME',
        innovatorSection: 'PRODUCT NAME',
        mappingConfidence: 0.98
      },
      {
        targetSection: 'ACTIVE INGREDIENTS',
        innovatorSection: 'COMPOSITION',
        mappingConfidence: 0.92
      },
      {
        targetSection: 'THERAPEUTIC INDICATIONS',
        innovatorSection: 'INDICATIONS',
        mappingConfidence: 0.95
      }
    ],
    gapAnalysis: {
      missingSections: ['EMERGENCY CONTACT INFORMATION', 'LOCAL REGULATORY DISCLAIMER'],
      translationRequired: [
        {
          section: 'DOSAGE AND ADMINISTRATION',
          sourceLanguage: 'en',
          targetLanguage: 'th',
          complexity: 'high'
        },
        {
          section: 'WARNINGS AND PRECAUTIONS',
          sourceLanguage: 'en',
          targetLanguage: 'th',
          complexity: 'medium'
        }
      ],
      specialAttentionFlags: [
        {
          section: 'DOSAGE AND ADMINISTRATION',
          reason: 'dosage_table',
          pageReferences: [3, 4]
        },
        {
          section: 'ACTIVE INGREDIENTS',
          reason: 'chemical_formula',
          pageReferences: [2]
        }
      ]
    },
    translationChecklist: [
      {
        section: 'DOSAGE AND ADMINISTRATION',
        sourceLanguage: 'en',
        targetLanguage: 'th',
        complexity: 'high'
      },
      {
        section: 'WARNINGS AND PRECAUTIONS',
        sourceLanguage: 'en',
        targetLanguage: 'th',
        complexity: 'medium'
      },
      {
        section: 'ADVERSE REACTIONS',
        sourceLanguage: 'en',
        targetLanguage: 'th',
        complexity: 'low'
      }
    ]
  };
}