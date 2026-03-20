export default function F8Preview() {
  const [activeTab, setActiveTab] = React.useState('overview');
  const [selectedPage, setSelectedPage] = React.useState(null);
  const [zoomLevel, setZoomLevel] = React.useState(100);
  const [workflowType, setWorkflowType] = React.useState('review_aw');

  const mockWorkflowResult = {
    workflowId: 'wf-001',
    workflowType: workflowType,
    executedDate: new Date().toISOString(),
    executionTimeMs: 8234,
    inputDocuments: [
      { id: 'doc-1', name: 'Zenora_AW_Draft_v3.pdf', type: 'aw_draft' },
      { id: 'doc-2', name: 'Zenora_Approved_PIL_TW.pdf', type: 'approved_pil' }
    ],
    output: {
      deviations: [
        {
          severity: 'critical',
          sectionName: 'DOSAGE AND ADMINISTRATION',
          approvedText: 'Take 1000mg (four 250mg tablets) once daily at least one hour before or two hours after food.',
          artworkText: 'Take 1000mg (four 250mg tablets) once daily with food.',
          pageReference: 3,
          confidenceScore: 0.94
        },
        {
          severity: 'critical',
          sectionName: 'CONTRAINDICATIONS',
          approvedText: 'Hypersensitivity to abiraterone acetate or any excipients. Women who are or may become pregnant.',
          artworkText: 'Hypersensitivity to abiraterone acetate or any excipients.',
          pageReference: 5,
          confidenceScore: 0.91
        },
        {
          severity: 'major',
          sectionName: 'WARNINGS AND PRECAUTIONS',
          approvedText: 'Hepatotoxicity: Monitor liver function tests before treatment, every two weeks for first three months.',
          artworkText: 'Hepatotoxicity: Monitor liver function tests before treatment and monthly.',
          pageReference: 6,
          confidenceScore: 0.88
        },
        {
          severity: 'major',
          sectionName: 'ACTIVE INGREDIENTS',
          approvedText: 'Each tablet contains 250mg abiraterone acetate (equivalent to 238mg abiraterone).',
          artworkText: 'Each tablet contains 250mg abiraterone acetate.',
          pageReference: 1,
          confidenceScore: 0.85
        },
        {
          severity: 'minor',
          sectionName: 'STORAGE CONDITIONS',
          approvedText: 'Store below 30°C. Keep in original package to protect from moisture.',
          artworkText: 'Store below 30°C in original package.',
          pageReference: 12,
          confidenceScore: 0.79
        }
      ],
      summary: {
        totalCritical: 2,
        totalMajor: 2,
        totalMinor: 1
      }
    },
    extractionResults: [
      {
        documentId: 'doc-1',
        provider: 'google_docai',
        processingTimeMs: 4120,
        sections: [
          {
            sectionName: 'PRODUCT NAME',
            content: 'Zenora (Abiraterone Acetate) 250mg Film-Coated Tablets',
            pageReferences: [1],
            confidenceScore: 0.96
          },
          {
            sectionName: 'ACTIVE INGREDIENTS',
            content: 'Each tablet contains 250mg abiraterone acetate.',
            pageReferences: [1],
            confidenceScore: 0.85
          },
          {
            sectionName: 'DOSAGE AND ADMINISTRATION',
            content: 'Take 1000mg (four 250mg tablets) once daily with food. Swallow tablets whole with water.',
            pageReferences: [3],
            confidenceScore: 0.94
          }
        ],
        pageImages: [
          { pageNumber: 1, imageBase64: 'mock-base64-1' },
          { pageNumber: 3, imageBase64: 'mock-base64-3' }
        ]
      }
    ]
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
      major: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      minor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    };
    return colors[severity] || 'bg-zinc-500/10 text-zinc-400';
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 0.70) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  const handleViewPage = (pageNumber) => {
    setSelectedPage({
      pageNumber,
      documentName: 'Zenora_AW_Draft_v3.pdf',
      imageBase64: 'mock-base64'
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-zinc-900/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">AW Review Results</h1>
              <p className="text-sm text-zinc-400 mt-1">
                Executed: {new Date().toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button className="px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors">
                📄 Export PDF Report
              </button>
              <button className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-semibold hover:bg-zinc-700 transition-colors">
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Workflow Type Selector (Demo) */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06] mb-4">
          <p className="text-sm text-zinc-400 mb-2">Demo: Switch Workflow Type</p>
          <div className="flex gap-2">
            {['create_draft', 'assess_variation', 'review_aw', 'generate_aw'].map(type => (
              <button
                key={type}
                onClick={() => setWorkflowType(type)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  workflowType === type
                    ? 'bg-violet-600 text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                {type.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 border-b border-white/5">
          {['overview', 'extraction', 'documents'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 font-semibold transition-colors ${
                activeTab === tab
                  ? 'text-violet-400 border-b-2 border-violet-400'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-rose-500/10 rounded-2xl p-6 border border-rose-500/20">
                <div className="text-4xl font-bold text-rose-400">2</div>
                <div className="text-sm text-rose-300 mt-1">Critical Deviations</div>
              </div>
              <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
                <div className="text-4xl font-bold text-amber-400">2</div>
                <div className="text-sm text-amber-300 mt-1">Major Deviations</div>
              </div>
              <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
                <div className="text-4xl font-bold text-emerald-400">1</div>
                <div className="text-sm text-emerald-300 mt-1">Minor Deviations</div>
              </div>
            </div>

            {/* Deviations List */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
              <h2 className="text-xl font-bold text-white mb-4">🔍 Deviation Details</h2>
              <div className="space-y-4">
                {mockWorkflowResult.output.deviations.map((deviation, idx) => (
                  <div key={idx} className={`rounded-xl p-4 border ${getSeverityColor(deviation.severity)}`}>
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-white">{deviation.sectionName}</h4>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 uppercase">
                          {deviation.severity}
                        </span>
                      </div>
                      <button
                        onClick={() => handleViewPage(deviation.pageReference)}
                        className="text-xs text-violet-400 hover:text-violet-300"
                      >
                        📄 Page {deviation.pageReference}
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-3">
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1">Approved Text</p>
                        <p className="text-sm bg-zinc-950/50 rounded-lg p-3">
                          {deviation.approvedText}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-zinc-400 mb-1">Artwork Text</p>
                        <p className="text-sm bg-zinc-950/50 rounded-lg p-3">
                          {deviation.artworkText}
                        </p>
                      </div>
                    </div>
                    
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-zinc-500">
                        Confidence: {(deviation.confidenceScore * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'extraction' && (
          <div className="space-y-6">
            {mockWorkflowResult.extractionResults.map((extraction, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {mockWorkflowResult.inputDocuments[idx]?.name}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      Provider: {extraction.provider} • Processing time: {extraction.processingTimeMs}ms
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {extraction.sections.map((section, sIdx) => (
                    <div key={sIdx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                      <div className="flex items-start justify-between mb-2">
                        <h4 className="font-semibold text-white">{section.sectionName}</h4>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(section.confidenceScore)}`}>
                            {(section.confidenceScore * 100).toFixed(0)}% confidence
                          </span>
                          <button
                            onClick={() => handleViewPage(section.pageReferences[0])}
                            className="text-xs text-violet-400 hover:text-violet-300"
                          >
                            📄 View Page {section.pageReferences[0]}
                          </button>
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap">
                        {section.content}
                      </p>
                      <p className="text-xs text-zinc-500 mt-2">
                        Pages: {section.pageReferences.join(', ')}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="space-y-4">
            {mockWorkflowResult.inputDocuments.map((doc, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white">{doc.name}</h3>
                    <p className="text-sm text-zinc-400">Type: {doc.type}</p>
                  </div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400">
                    {doc.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Page Image Viewer Modal */}
      {selectedPage && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
          <div className="bg-zinc-900 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden border border-white/10">
            <div className="flex items-center justify-between p-4 border-b border-white/5">
              <div>
                <h3 className="text-lg font-bold text-white">
                  {selectedPage.documentName} - Page {selectedPage.pageNumber}
                </h3>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setZoomLevel(Math.max(50, zoomLevel - 25))}
                  className="px-3 py-1 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  −
                </button>
                <span className="text-sm text-zinc-400">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(Math.min(200, zoomLevel + 25))}
                  className="px-3 py-1 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  +
                </button>
                <button
                  onClick={() => setSelectedPage(null)}
                  className="px-3 py-1 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-80px)] p-4 bg-zinc-950 flex items-center justify-center">
              <div className="bg-white rounded-lg shadow-2xl" style={{ width: `${zoomLevel}%` }}>
                <div className="aspect-[8.5/11] bg-gradient-to-br from-zinc-100 to-zinc-200 p-8">
                  <div className="text-center mb-6">
                    <h1 className="text-2xl font-bold text-zinc-900">Zenora</h1>
                    <p className="text-sm text-zinc-600">(Abiraterone Acetate) 250mg</p>
                  </div>
                  <div className="space-y-4 text-xs text-zinc-800">
                    <div>
                      <h2 className="font-bold mb-2">DOSAGE AND ADMINISTRATION</h2>
                      <p>Take 1000mg (four 250mg tablets) once daily with food. Swallow tablets whole with water.</p>
                    </div>
                    <div>
                      <h2 className="font-bold mb-2">CONTRAINDICATIONS</h2>
                      <p>Hypersensitivity to abiraterone acetate or any excipients.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}