export default function F4Preview() {
  const [activeTab, setActiveTab] = React.useState('alignment');
  const [selectedPage, setSelectedPage] = React.useState(null);
  const [showWorkflowSelector, setShowWorkflowSelector] = React.useState(false);
  const [processing, setProcessing] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showResults, setShowResults] = React.useState(true);

  const sectionAlignment = [
    {
      targetSection: 'PRODUCT NAME',
      innovatorSection: 'Product Information',
      mappingConfidence: 0.95,
      notes: 'Direct semantic match',
      pageReferences: [1]
    },
    {
      targetSection: 'ACTIVE INGREDIENTS',
      innovatorSection: 'Composition',
      mappingConfidence: 0.92,
      notes: 'High confidence mapping',
      pageReferences: [2]
    },
    {
      targetSection: 'INDICATIONS',
      innovatorSection: 'Therapeutic Indications',
      mappingConfidence: 0.88,
      notes: 'Semantic alignment verified',
      pageReferences: [3]
    },
    {
      targetSection: 'DOSAGE AND ADMINISTRATION',
      innovatorSection: 'Posology and Method of Administration',
      mappingConfidence: 0.91,
      notes: 'Contains dosage tables requiring special attention',
      pageReferences: [4, 5]
    },
    {
      targetSection: 'CONTRAINDICATIONS',
      innovatorSection: 'Contraindications',
      mappingConfidence: 0.98,
      notes: 'Exact match',
      pageReferences: [6]
    },
    {
      targetSection: 'WARNINGS AND PRECAUTIONS',
      innovatorSection: 'Special Warnings and Precautions',
      mappingConfidence: 0.89,
      notes: 'Regulatory alignment confirmed',
      pageReferences: [7, 8]
    },
    {
      targetSection: 'ADVERSE REACTIONS',
      innovatorSection: 'Undesirable Effects',
      mappingConfidence: 0.87,
      notes: 'Terminology variation handled',
      pageReferences: [9, 10]
    },
    {
      targetSection: 'STORAGE CONDITIONS',
      innovatorSection: 'NOT_FOUND',
      mappingConfidence: 0.25,
      notes: 'Missing from innovator PIL - requires new content',
      pageReferences: []
    }
  ];

  const gapAnalysis = {
    missingSections: [
      {
        sectionName: 'STORAGE CONDITIONS',
        reason: 'Required by Taiwan TFDA but not present in innovator PIL',
        severity: 'major',
        suggestedSource: 'regulatory_source'
      },
      {
        sectionName: 'EMERGENCY CONTACT INFORMATION',
        reason: 'Mandatory for local market compliance',
        severity: 'critical',
        suggestedSource: 'market_format'
      }
    ],
    incompleteContent: [
      {
        sectionName: 'CONTRAINDICATIONS',
        missingElements: ['pregnancy warnings', 'pediatric use restrictions'],
        severity: 'major',
        pageReferences: [6]
      },
      {
        sectionName: 'DOSAGE AND ADMINISTRATION',
        missingElements: ['renal impairment dosing', 'hepatic impairment dosing'],
        severity: 'critical',
        pageReferences: [4, 5]
      }
    ]
  };

  const translationChecklist = [
    {
      section: 'DOSAGE AND ADMINISTRATION',
      sourceLanguage: 'en',
      targetLanguage: 'zh-TW',
      complexity: 'high',
      reason: 'Contains dosage tables with precise measurements',
      requiresSpecialist: true,
      estimatedWords: 850,
      specialInstructions: 'Preserve table formatting, verify measurement units (mg/kg)',
      pageReferences: [4, 5]
    },
    {
      section: 'ACTIVE INGREDIENTS',
      sourceLanguage: 'en',
      targetLanguage: 'zh-TW',
      complexity: 'high',
      reason: 'Contains chemical formulas and IUPAC nomenclature',
      requiresSpecialist: true,
      estimatedWords: 320,
      specialInstructions: 'Verify chemical formula accuracy, maintain molecular weight precision',
      pageReferences: [2]
    },
    {
      section: 'WARNINGS AND PRECAUTIONS',
      sourceLanguage: 'en',
      targetLanguage: 'zh-TW',
      complexity: 'medium',
      reason: 'Medical terminology requiring accurate translation',
      requiresSpecialist: false,
      estimatedWords: 1200,
      specialInstructions: 'Maintain regulatory tone, verify medical terms',
      pageReferences: [7, 8]
    },
    {
      section: 'ADVERSE REACTIONS',
      sourceLanguage: 'en',
      targetLanguage: 'zh-TW',
      complexity: 'medium',
      reason: 'Clinical terminology and frequency classifications',
      requiresSpecialist: false,
      estimatedWords: 950,
      specialInstructions: 'Preserve frequency categories (common, uncommon, rare)',
      pageReferences: [9, 10]
    }
  ];

  const specialAttentionFlags = [
    {
      section: 'DOSAGE AND ADMINISTRATION',
      reason: 'dosage_table',
      description: 'Contains complex dosage tables requiring precise translation and formatting',
      pageReferences: [4, 5],
      confidenceScore: 0.91
    },
    {
      section: 'ACTIVE INGREDIENTS',
      reason: 'chemical_formula',
      description: 'Contains chemical formulas (C₂₇H₃₄O₃) requiring expert verification',
      pageReferences: [2],
      confidenceScore: 0.92
    },
    {
      section: 'PHARMACOKINETICS',
      reason: 'complex_table',
      description: 'Contains pharmacokinetic parameter tables with statistical data',
      pageReferences: [11],
      confidenceScore: 0.88
    }
  ];

  const handleStartWorkflow = () => {
    setProcessing(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setProcessing(false);
            setShowWorkflowSelector(false);
            setShowResults(true);
          }, 500);
          return 100;
        }
        return prev + 10;
      });
    }, 400);
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'text-emerald-600 bg-emerald-50';
    if (score >= 0.70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  const getSeverityColor = (severity) => {
    if (severity === 'critical') return 'bg-red-100 text-red-800 border-red-300';
    if (severity === 'major') return 'bg-amber-100 text-amber-800 border-amber-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  };

  const getComplexityColor = (complexity) => {
    if (complexity === 'high') return 'bg-red-100 text-red-800';
    if (complexity === 'medium') return 'bg-amber-100 text-amber-800';
    return 'bg-emerald-100 text-emerald-800';
  };

  if (showWorkflowSelector) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-8 shadow-2xl">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">
                Create PIL Draft Workflow
              </h2>
              <p className="text-zinc-400">
                Generate structured draft outline with section alignment and gap analysis
              </p>
            </div>

            {processing ? (
              <div className="space-y-6">
                <div className="p-6 bg-violet-500/10 border border-violet-500/20 rounded-xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 border-3 border-violet-400 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg font-semibold text-white">
                      Processing Workflow...
                    </p>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-3 overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                  <p className="text-sm text-zinc-400 mt-3">
                    {progress < 30 && 'Extracting document content...'}
                    {progress >= 30 && progress < 60 && 'Aligning sections to market format...'}
                    {progress >= 60 && progress < 90 && 'Analyzing content gaps...'}
                    {progress >= 90 && 'Generating translation checklist...'}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-5 mb-8">
                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      1. Innovator PIL <span className="text-rose-400">*</span>
                    </label>
                    <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500">
                      <option>Zenora_Innovator_PIL_EN.pdf (Abiraterone Acetate 250mg)</option>
                      <option>Lenalidomide_Innovator_PIL_EN.pdf (Lenalidomide 25mg)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      2. Regulatory Source <span className="text-rose-400">*</span>
                    </label>
                    <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500">
                      <option>Taiwan_TFDA_Requirements_2024.pdf</option>
                      <option>Thailand_FDA_Guidelines_2024.pdf</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-white mb-2">
                      3. Local Market PIL Format <span className="text-rose-400">*</span>
                    </label>
                    <select className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500">
                      <option>Taiwan_TFDA_PIL_Template.pdf</option>
                      <option>Thailand_FDA_PIL_Template.pdf</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={handleStartWorkflow}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl hover:from-violet-500 hover:to-violet-400 active:scale-95 transition-all shadow-lg shadow-violet-500/25"
                  >
                    Start Workflow
                  </button>
                  <button
                    onClick={() => setShowWorkflowSelector(false)}
                    className="px-6 py-3 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 active:scale-95 transition-all border border-white/10"
                  >
                    Cancel
                  </button>
                </div>

                <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-start gap-3">
                    <span className="text-xl">ℹ️</span>
                    <div className="text-sm text-blue-200">
                      <p className="font-semibold mb-1">What this workflow does:</p>
                      <ul className="list-disc list-inside space-y-1 text-blue-300">
                        <li>Aligns Innovator PIL sections to target market format</li>
                        <li>Identifies missing sections and content gaps</li>
                        <li>Generates translation checklist for CJK/Thai content</li>
                        <li>Flags dosage tables and chemical formulas</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!showResults) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center py-20">
            <button
              onClick={() => setShowWorkflowSelector(true)}
              className="px-8 py-4 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-bold rounded-xl hover:from-violet-500 hover:to-violet-400 active:scale-95 transition-all shadow-2xl shadow-violet-500/25 text-lg"
            >
              📝 Start Create PIL Draft Workflow
            </button>
          </div>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'alignment', label: 'Section Alignment', count: sectionAlignment.length, icon: '🔗' },
    { id: 'gaps', label: 'Gap Analysis', count: gapAnalysis.missingSections.length + gapAnalysis.incompleteContent.length, icon: '⚠️' },
    { id: 'translation', label: 'Translation Checklist', count: translationChecklist.length, icon: '🌐' },
    { id: 'attention', label: 'Special Attention', count: specialAttentionFlags.length, icon: '💊' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-violet-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 p-6 shadow-2xl">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Create PIL Draft - Results
              </h2>
              <p className="text-sm text-zinc-400">
                Workflow completed in 47.3s • 3 documents processed
              </p>
            </div>
            <div className="flex gap-3">
              <button className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-500 active:scale-95 transition-all shadow-lg shadow-violet-500/25">
                📄 Export PDF
              </button>
              <button 
                onClick={() => setShowResults(false)}
                className="px-4 py-2 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 active:scale-95 transition-all border border-white/10"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs font-semibold text-zinc-400 mb-1">Innovator PIL</p>
              <p className="text-sm text-white">8 sections extracted</p>
              <p className="text-xs text-zinc-500 mt-1">Provider: Google Document AI</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs font-semibold text-zinc-400 mb-1">Regulatory Source</p>
              <p className="text-sm text-white">12 sections extracted</p>
              <p className="text-xs text-zinc-500 mt-1">Provider: Google Document AI</p>
            </div>
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <p className="text-xs font-semibold text-zinc-400 mb-1">Market Format</p>
              <p className="text-sm text-white">8 sections extracted</p>
              <p className="text-xs text-zinc-500 mt-1">Provider: Claude Vision</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
          <div className="border-b border-white/10">
            <div className="flex">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 px-6 py-4 font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-violet-500/20 text-violet-300 border-b-2 border-violet-400'
                      : 'text-zinc-400 hover:bg-white/5'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                  <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/10 text-zinc-300">
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {/* Section Alignment Tab */}
            {activeTab === 'alignment' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Section Alignment to Target Market Format
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {sectionAlignment.filter(a => a.mappingConfidence >= 0.8).length} high confidence mappings
                  </p>
                </div>

                {sectionAlignment.map((alignment, index) => (
                  <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-white mb-1">
                          {alignment.targetSection}
                        </p>
                        <p className="text-sm text-zinc-400">
                          Maps to: <span className="font-medium text-zinc-300">{alignment.innovatorSection}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(alignment.mappingConfidence)}`}>
                          {(alignment.mappingConfidence * 100).toFixed(0)}% confidence
                        </span>
                        {alignment.pageReferences.length > 0 && (
                          <button
                            onClick={() => setSelectedPage(alignment.pageReferences[0])}
                            className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded-full hover:bg-blue-500/30 border border-blue-500/30"
                          >
                            📄 Page {alignment.pageReferences[0]}
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-400 italic">
                      {alignment.notes}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {/* Gap Analysis Tab */}
            {activeTab === 'gaps' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-white mb-4">
                    Missing Sections ({gapAnalysis.missingSections.length})
                  </h3>
                  <div className="space-y-3">
                    {gapAnalysis.missingSections.map((item, index) => (
                      <div key={index} className="p-4 bg-red-500/10 rounded-xl border border-red-500/30">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-white mb-1">
                              {item.sectionName}
                            </p>
                            <p className="text-sm text-zinc-300 mb-2">
                              {item.reason}
                            </p>
                            <p className="text-xs text-zinc-400">
                              Suggested source: <span className="font-medium text-zinc-300">{item.suggestedSource}</span>
                            </p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white mb-4">
                    Incomplete Content ({gapAnalysis.incompleteContent.length})
                  </h3>
                  <div className="space-y-3">
                    {gapAnalysis.incompleteContent.map((item, index) => (
                      <div key={index} className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-white">
                            {item.sectionName}
                          </p>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                        <p className="text-sm text-zinc-300 mb-2">
                          Missing elements:
                        </p>
                        <ul className="list-disc list-inside text-sm text-zinc-400 space-y-1">
                          {item.missingElements.map((element, i) => (
                            <li key={i}>{element}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Translation Checklist Tab */}
            {activeTab === 'translation' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Translation Requirements
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {translationChecklist.filter(t => t.requiresSpecialist).length} require specialist translator
                  </p>
                </div>

                {translationChecklist.map((item, index) => (
                  <div key={index} className="p-4 bg-white/5 rounded-xl border border-white/10">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-white mb-1">
                          {item.section}
                        </p>
                        <p className="text-sm text-zinc-400 mb-2">
                          {item.sourceLanguage.toUpperCase()} → {item.targetLanguage.toUpperCase()}
                        </p>
                        <p className="text-sm text-zinc-300">
                          {item.reason}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComplexityColor(item.complexity)}`}>
                          {item.complexity} complexity
                        </span>
                        {item.requiresSpecialist && (
                          <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-500/20 text-purple-300 border border-purple-500/30">
                            🎓 Specialist required
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                      <p className="text-xs text-blue-200">
                        <span className="font-semibold">Instructions:</span> {item.specialInstructions}
                      </p>
                    </div>
                    <div className="mt-2 flex items-center gap-4 text-xs text-zinc-500">
                      <span>~{item.estimatedWords} words</span>
                      <button className="text-blue-400 hover:text-blue-300 font-medium">
                        📄 View page {item.pageReferences[0]}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Special Attention Tab */}
            {activeTab === 'attention' && (
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white mb-4">
                  Items Requiring Special Attention
                </h3>

                {specialAttentionFlags.map((item, index) => (
                  <div key={index} className="p-4 bg-amber-500/10 rounded-xl border border-amber-500/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">
                            {item.reason === 'dosage_table' ? '💊' : 
                             item.reason === 'chemical_formula' ? '🧪' : '📊'}
                          </span>
                          <p className="font-semibold text-white">
                            {item.section}
                          </p>
                        </div>
                        <p className="text-sm text-zinc-300 mb-2">
                          {item.description}
                        </p>
                        <p className="text-xs text-zinc-400">
                          Type: <span className="font-medium text-zinc-300">{item.reason.replace('_', ' ')}</span>
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedPage(item.pageReferences[0])}
                        className="px-3 py-1 bg-blue-500/20 text-blue-300 text-xs font-medium rounded-full hover:bg-blue-500/30 border border-blue-500/30"
                      >
                        📄 Page {item.pageReferences[0]}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Page Viewer Modal */}
      {selectedPage && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10">
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold text-white">
                Page {selectedPage} Preview
              </h3>
              <button
                onClick={() => setSelectedPage(null)}
                className="px-4 py-2 bg-white/5 text-white font-semibold rounded-xl hover:bg-white/10 border border-white/10"
              >
                Close
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)] bg-zinc-800">
              <div className="bg-white rounded-lg p-8 text-center">
                <p className="text-gray-500 mb-4">Page {selectedPage} content would display here</p>
                <div className="w-full h-96 bg-gray-100 rounded-lg flex items-center justify-center">
                  <span className="text-6xl">📄</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}