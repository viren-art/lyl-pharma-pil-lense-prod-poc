import { useState } from 'react';

export default function DraftResults({ workflowResult, onExport, onClose }) {
  const [activeTab, setActiveTab] = useState('alignment');
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);

  if (!workflowResult) {
    return null;
  }

  const {
    sectionAlignment,
    gapAnalysis,
    translationChecklist,
    specialAttentionFlags,
    extractionResults,
    executionTimeMs
  } = workflowResult;

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

  const handleViewPage = (pageNumber, extractionIndex = 0) => {
    setSelectedPage({ pageNumber, extractionIndex });
  };

  const tabs = [
    { id: 'alignment', label: 'Section Alignment', count: sectionAlignment?.length || 0 },
    { id: 'gaps', label: 'Gap Analysis', count: (gapAnalysis?.missingSections?.length || 0) + (gapAnalysis?.incompleteContent?.length || 0) },
    { id: 'translation', label: 'Translation Checklist', count: translationChecklist?.length || 0 },
    { id: 'attention', label: 'Special Attention', count: specialAttentionFlags?.length || 0 }
  ];

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Create PIL Draft - Results
            </h2>
            <p className="text-sm text-gray-600">
              Workflow completed in {(executionTimeMs / 1000).toFixed(1)}s
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onExport}
              className="px-4 py-2 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 transition-colors"
            >
              📄 Export PDF
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 active:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Extraction Summary */}
        <div className="mt-4 grid grid-cols-3 gap-4">
          {extractionResults?.map((result, index) => (
            <div key={index} className="p-3 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {result.documentName}
              </p>
              <p className="text-sm text-gray-900">
                {result.sections?.length || 0} sections extracted
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Provider: {result.provider === 'google_docai' ? 'Google Document AI' : 'Claude Vision'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200">
          <div className="flex">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-violet-50 text-violet-700 border-b-2 border-violet-600'
                    : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                {tab.label}
                <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-200 text-gray-700">
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
                <h3 className="text-lg font-bold text-gray-900">
                  Section Alignment to Target Market Format
                </h3>
                <p className="text-sm text-gray-600">
                  {sectionAlignment?.filter(a => a.mappingConfidence >= 0.8).length || 0} high confidence mappings
                </p>
              </div>

              {sectionAlignment?.map((alignment, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <p className="font-semibold text-gray-900 mb-1">
                        {alignment.targetSection}
                      </p>
                      <p className="text-sm text-gray-600">
                        Maps to: <span className="font-medium text-gray-900">{alignment.innovatorSection}</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(alignment.mappingConfidence)}`}>
                        {(alignment.mappingConfidence * 100).toFixed(0)}% confidence
                      </span>
                      {alignment.pageReferences?.length > 0 && (
                        <button
                          onClick={() => handleViewPage(alignment.pageReferences[0], 0)}
                          className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-200"
                        >
                          📄 Page {alignment.pageReferences[0]}
                        </button>
                      )}
                    </div>
                  </div>
                  {alignment.notes && (
                    <p className="text-sm text-gray-600 italic">
                      {alignment.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Gap Analysis Tab */}
          {activeTab === 'gaps' && (
            <div className="space-y-6">
              {/* Missing Sections */}
              {gapAnalysis?.missingSections?.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Missing Sections ({gapAnalysis.missingSections.length})
                  </h3>
                  <div className="space-y-3">
                    {gapAnalysis.missingSections.map((item, index) => (
                      <div key={index} className="p-4 bg-red-50 rounded-xl border border-red-200">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="font-semibold text-gray-900 mb-1">
                              {item.sectionName}
                            </p>
                            <p className="text-sm text-gray-700 mb-2">
                              {item.reason}
                            </p>
                            <p className="text-xs text-gray-600">
                              Suggested source: <span className="font-medium">{item.suggestedSource}</span>
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
              )}

              {/* Incomplete Content */}
              {gapAnalysis?.incompleteContent?.length > 0 && (
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-4">
                    Incomplete Content ({gapAnalysis.incompleteContent.length})
                  </h3>
                  <div className="space-y-3">
                    {gapAnalysis.incompleteContent.map((item, index) => (
                      <div key={index} className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                        <div className="flex items-start justify-between mb-2">
                          <p className="font-semibold text-gray-900">
                            {item.sectionName}
                          </p>
                          <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getSeverityColor(item.severity)}`}>
                            {item.severity}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">
                          Missing elements:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                          {item.missingElements?.map((element, i) => (
                            <li key={i}>{element}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {gapAnalysis?.missingSections?.length === 0 && gapAnalysis?.incompleteContent?.length === 0 && (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">✅</span>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    No Content Gaps Detected
                  </p>
                  <p className="text-gray-600">
                    All required sections are present and complete
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Translation Checklist Tab */}
          {activeTab === 'translation' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Translation Requirements
                </h3>
                <p className="text-sm text-gray-600">
                  {translationChecklist?.filter(t => t.requiresSpecialist).length || 0} require specialist translator
                </p>
              </div>

              {translationChecklist?.length > 0 ? (
                <div className="space-y-3">
                  {translationChecklist.map((item, index) => (
                    <div key={index} className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-semibold text-gray-900 mb-1">
                            {item.section}
                          </p>
                          <p className="text-sm text-gray-600 mb-2">
                            {item.sourceLanguage.toUpperCase()} → {item.targetLanguage.toUpperCase()}
                          </p>
                          <p className="text-sm text-gray-700">
                            {item.reason}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${getComplexityColor(item.complexity)}`}>
                            {item.complexity} complexity
                          </span>
                          {item.requiresSpecialist && (
                            <span className="px-3 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              🎓 Specialist required
                            </span>
                          )}
                        </div>
                      </div>
                      {item.specialInstructions && (
                        <div className="mt-2 p-2 bg-blue-50 rounded-lg">
                          <p className="text-xs text-blue-900">
                            <span className="font-semibold">Instructions:</span> {item.specialInstructions}
                          </p>
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-4 text-xs text-gray-600">
                        <span>~{item.estimatedWords} words</span>
                        {item.pageReferences?.length > 0 && (
                          <button
                            onClick={() => handleViewPage(item.pageReferences[0], 0)}
                            className="text-blue-600 hover:text-blue-700 font-medium"
                          >
                            📄 View page {item.pageReferences[0]}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">🌐</span>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    No Translation Required
                  </p>
                  <p className="text-gray-600">
                    All content is in the target language
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Special Attention Tab */}
          {activeTab === 'attention' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Items Requiring Special Attention
                </h3>
              </div>

              {specialAttentionFlags?.length > 0 ? (
                <div className="space-y-3">
                  {specialAttentionFlags.map((item, index) => (
                    <div key={index} className="p-4 bg-amber-50 rounded-xl border border-amber-200">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-2xl">
                              {item.reason === 'dosage_table' ? '💊' : 
                               item.reason === 'chemical_formula' ? '🧪' : '📊'}
                            </span>
                            <p className="font-semibold text-gray-900">
                              {item.section}
                            </p>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">
                            {item.description}
                          </p>
                          <p className="text-xs text-gray-600">
                            Type: <span className="font-medium">{item.reason.replace('_', ' ')}</span>
                          </p>
                        </div>
                        {item.pageReferences?.length > 0 && (
                          <button
                            onClick={() => handleViewPage(item.pageReferences[0], 0)}
                            className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-medium rounded-full hover:bg-blue-200"
                          >
                            📄 Page {item.pageReferences[0]}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <span className="text-6xl mb-4 block">✨</span>
                  <p className="text-lg font-semibold text-gray-900 mb-2">
                    No Special Attention Items
                  </p>
                  <p className="text-gray-600">
                    No dosage tables or chemical formulas detected
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Page Viewer Modal */}
      {selectedPage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-bold text-gray-900">
                Page {selectedPage.pageNumber} Preview
              </h3>
              <button
                onClick={() => setSelectedPage(null)}
                className="px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200"
              >
                Close
              </button>
            </div>
            <div className="p-6 overflow-auto max-h-[calc(90vh-80px)]">
              {extractionResults?.[selectedPage.extractionIndex]?.pageImages?.find(
                p => p.pageNumber === selectedPage.pageNumber
              ) ? (
                <img
                  src={`data:image/png;base64,${extractionResults[selectedPage.extractionIndex].pageImages.find(p => p.pageNumber === selectedPage.pageNumber).imageBase64}`}
                  alt={`Page ${selectedPage.pageNumber}`}
                  className="w-full rounded-lg shadow-lg"
                />
              ) : (
                <div className="text-center py-12 text-gray-500">
                  Page image not available
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}