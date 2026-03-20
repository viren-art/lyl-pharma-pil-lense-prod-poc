import { useState } from 'react';

/**
 * Workflow Results Display Component
 * Displays workflow-specific output with source page images, extracted content,
 * and confidence scores for human verification
 */
export default function ResultsDisplay({ workflowResult, onExport, onClose }) {
  const [selectedPage, setSelectedPage] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [zoomLevel, setZoomLevel] = useState(100);

  if (!workflowResult) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-950">
        <div className="text-center">
          <p className="text-zinc-400 text-lg">No workflow results to display</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700"
          >
            Back to Workflows
          </button>
        </div>
      </div>
    );
  }

  const { workflowType, output, extractionResults, executedDate, inputDocuments } = workflowResult;

  const handleViewPage = (pageNumber, documentId) => {
    const extraction = extractionResults.find(e => e.documentId === documentId);
    if (extraction) {
      const pageImage = extraction.pageImages.find(p => p.pageNumber === pageNumber);
      if (pageImage) {
        setSelectedPage({
          pageNumber,
          documentId,
          documentName: inputDocuments.find(d => d.id === documentId)?.name || 'Unknown',
          imageBase64: pageImage.imageBase64
        });
      }
    }
  };

  const handleClosePageViewer = () => {
    setSelectedPage(null);
    setZoomLevel(100);
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 0.70) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  const renderWorkflowSpecificContent = () => {
    switch (workflowType) {
      case 'create_draft':
        return <CreateDraftResults output={output} onViewPage={handleViewPage} />;
      case 'assess_variation':
        return <VariationResults output={output} onViewPage={handleViewPage} />;
      case 'review_aw':
        return <DeviationResults output={output} onViewPage={handleViewPage} />;
      case 'generate_aw':
        return <GeneratedAWResults output={output} />;
      default:
        return <div className="text-zinc-400">Unknown workflow type</div>;
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-40 backdrop-blur-xl bg-zinc-900/80 border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">
                {workflowType === 'create_draft' && 'Create PIL Draft Results'}
                {workflowType === 'assess_variation' && 'Variation Assessment Results'}
                {workflowType === 'review_aw' && 'AW Review Results'}
                {workflowType === 'generate_aw' && 'Generated AW Draft'}
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Executed: {new Date(executedDate).toLocaleString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onExport}
                className="px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors"
              >
                📄 Export PDF Report
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-semibold hover:bg-zinc-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex gap-2 border-b border-white/5">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'text-violet-400 border-b-2 border-violet-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('extraction')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'extraction'
                ? 'text-violet-400 border-b-2 border-violet-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Extraction Details
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 font-semibold transition-colors ${
              activeTab === 'documents'
                ? 'text-violet-400 border-b-2 border-violet-400'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            Input Documents
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {renderWorkflowSpecificContent()}
          </div>
        )}

        {activeTab === 'extraction' && (
          <div className="space-y-6">
            {extractionResults.map((extraction, idx) => (
              <div key={idx} className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {inputDocuments.find(d => d.id === extraction.documentId)?.name || 'Unknown Document'}
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
                          {section.pageReferences.length > 0 && (
                            <button
                              onClick={() => handleViewPage(section.pageReferences[0], extraction.documentId)}
                              className="text-xs text-violet-400 hover:text-violet-300"
                            >
                              📄 View Page {section.pageReferences[0]}
                            </button>
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-zinc-300 whitespace-pre-wrap line-clamp-3">
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
            {inputDocuments.map((doc, idx) => (
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
                  onClick={handleClosePageViewer}
                  className="px-3 py-1 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="overflow-auto max-h-[calc(90vh-80px)] p-4 bg-zinc-950">
              <img
                src={`data:image/png;base64,${selectedPage.imageBase64}`}
                alt={`Page ${selectedPage.pageNumber}`}
                style={{ width: `${zoomLevel}%` }}
                className="mx-auto"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Create PIL Draft Results Component
 */
function CreateDraftResults({ output, onViewPage }) {
  const { sectionAlignment, gapAnalysis, translationChecklist, specialAttentionFlags } = output;

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 0.70) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  const getSeverityColor = (severity) => {
    const colors = {
      high: 'text-rose-500 bg-rose-500/10',
      medium: 'text-amber-500 bg-amber-500/10',
      low: 'text-emerald-500 bg-emerald-500/10'
    };
    return colors[severity] || 'text-zinc-400 bg-zinc-400/10';
  };

  return (
    <div className="space-y-6">
      {/* Section Alignment */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">📋 Section Alignment</h2>
        <div className="space-y-3">
          {sectionAlignment.map((alignment, idx) => (
            <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-semibold text-violet-400">Target:</span>
                    <span className="text-sm text-white">{alignment.targetSection}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-cyan-400">Innovator:</span>
                    <span className="text-sm text-white">{alignment.innovatorSection}</span>
                  </div>
                </div>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(alignment.mappingConfidence)}`}>
                  {(alignment.mappingConfidence * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Gap Analysis */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">⚠️ Gap Analysis</h2>
        
        {gapAnalysis.missingSections.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-rose-400 mb-2">Missing Sections</h3>
            <div className="space-y-2">
              {gapAnalysis.missingSections.map((section, idx) => (
                <div key={idx} className="bg-rose-500/10 rounded-lg p-3 border border-rose-500/20">
                  <span className="text-sm text-white">{section}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {gapAnalysis.translationRequired.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-amber-400 mb-2">Translation Required</h3>
            <div className="space-y-2">
              {gapAnalysis.translationRequired.map((item, idx) => (
                <div key={idx} className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">{item.section}</span>
                    <span className="text-xs text-zinc-400">
                      {item.sourceLanguage} → {item.targetLanguage}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Translation Checklist */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">🌐 Translation Checklist</h2>
        <div className="space-y-3">
          {translationChecklist.map((item, idx) => (
            <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-white">{item.section}</span>
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  item.complexity === 'high' ? 'bg-rose-500/10 text-rose-400' :
                  item.complexity === 'medium' ? 'bg-amber-500/10 text-amber-400' :
                  'bg-emerald-500/10 text-emerald-400'
                }`}>
                  {item.complexity} complexity
                </span>
              </div>
              <p className="text-xs text-zinc-400">
                {item.sourceLanguage} → {item.targetLanguage}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Special Attention Flags */}
      {specialAttentionFlags.length > 0 && (
        <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
          <h2 className="text-xl font-bold text-white mb-4">🚨 Special Attention Required</h2>
          <div className="space-y-3">
            {specialAttentionFlags.map((flag, idx) => (
              <div key={idx} className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="text-sm font-semibold text-white">{flag.section}</h4>
                    <p className="text-xs text-amber-400 mt-1">{flag.reason}</p>
                  </div>
                  <button
                    onClick={() => onViewPage(flag.pageReferences[0])}
                    className="text-xs text-violet-400 hover:text-violet-300"
                  >
                    📄 Page {flag.pageReferences[0]}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Variation Assessment Results Component
 */
function VariationResults({ output, onViewPage }) {
  const { classification, justification, sectionDiffs } = output;

  const getClassificationColor = (classification) => {
    return classification === 'complicated' 
      ? 'bg-rose-500/10 text-rose-400 border-rose-500/20'
      : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
  };

  const getSignificanceColor = (score) => {
    if (score >= 70) return 'text-rose-500 bg-rose-500/10';
    if (score >= 40) return 'text-amber-500 bg-amber-500/10';
    return 'text-emerald-500 bg-emerald-500/10';
  };

  return (
    <div className="space-y-6">
      {/* Classification */}
      <div className={`rounded-2xl p-6 border ${getClassificationColor(classification)}`}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Classification Result</h2>
          <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-bold uppercase">
            {classification}
          </span>
        </div>
        <p className="text-sm leading-relaxed">{justification}</p>
      </div>

      {/* Section Diffs */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">📊 Section-by-Section Changes</h2>
        <div className="space-y-4">
          {sectionDiffs.map((diff, idx) => (
            <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
              <div className="flex items-start justify-between mb-3">
                <h4 className="font-semibold text-white">{diff.sectionName}</h4>
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getSignificanceColor(diff.significanceScore)}`}>
                    {diff.significanceScore} significance
                  </span>
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    diff.changeType === 'added' ? 'bg-emerald-500/10 text-emerald-400' :
                    diff.changeType === 'removed' ? 'bg-rose-500/10 text-rose-400' :
                    diff.changeType === 'modified' ? 'bg-amber-500/10 text-amber-400' :
                    'bg-zinc-500/10 text-zinc-400'
                  }`}>
                    {diff.changeType}
                  </span>
                </div>
              </div>
              
              {diff.changeType !== 'unchanged' && (
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Approved Text</p>
                    <p className="text-sm text-zinc-300 bg-zinc-950/50 rounded-lg p-3 line-clamp-3">
                      {diff.approvedText}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-zinc-400 mb-1">Updated Text</p>
                    <p className="text-sm text-zinc-300 bg-zinc-950/50 rounded-lg p-3 line-clamp-3">
                      {diff.updatedText}
                    </p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Deviation Report Results Component
 */
function DeviationResults({ output, onViewPage }) {
  const { deviations, summary } = output;

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'text-rose-500 bg-rose-500/10 border-rose-500/20',
      major: 'text-amber-500 bg-amber-500/10 border-amber-500/20',
      minor: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20'
    };
    return colors[severity] || 'text-zinc-400 bg-zinc-400/10';
  };

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-rose-500/10 rounded-2xl p-6 border border-rose-500/20">
          <div className="text-4xl font-bold text-rose-400">{summary.totalCritical}</div>
          <div className="text-sm text-rose-300 mt-1">Critical Deviations</div>
        </div>
        <div className="bg-amber-500/10 rounded-2xl p-6 border border-amber-500/20">
          <div className="text-4xl font-bold text-amber-400">{summary.totalMajor}</div>
          <div className="text-sm text-amber-300 mt-1">Major Deviations</div>
        </div>
        <div className="bg-emerald-500/10 rounded-2xl p-6 border border-emerald-500/20">
          <div className="text-4xl font-bold text-emerald-400">{summary.totalMinor}</div>
          <div className="text-sm text-emerald-300 mt-1">Minor Deviations</div>
        </div>
      </div>

      {/* Deviations List */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">🔍 Deviation Details</h2>
        <div className="space-y-4">
          {deviations.map((deviation, idx) => (
            <div key={idx} className={`rounded-xl p-4 border ${getSeverityColor(deviation.severity)}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h4 className="font-semibold text-white">{deviation.sectionName}</h4>
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium mt-2 uppercase">
                    {deviation.severity}
                  </span>
                </div>
                <button
                  onClick={() => onViewPage(deviation.pageReference)}
                  className="text-xs text-violet-400 hover:text-violet-300"
                >
                  📄 Page {deviation.pageReference}
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-1">Approved Text</p>
                  <p className="text-sm bg-zinc-950/50 rounded-lg p-3 line-clamp-2">
                    {deviation.approvedText}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-zinc-400 mb-1">Artwork Text</p>
                  <p className="text-sm bg-zinc-950/50 rounded-lg p-3 line-clamp-2">
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
  );
}

/**
 * Generated AW Results Component
 */
function GeneratedAWResults({ output }) {
  const { pdfBase64, market, diecutApplied, sectionsProcessed, generationTimeMs } = output;

  const handleDownloadPdf = () => {
    const byteCharacters = atob(pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `aw-draft-${market}-${Date.now()}.pdf`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Generation Summary */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <h2 className="text-xl font-bold text-white mb-4">✅ Generation Complete</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-zinc-400">Target Market</p>
            <p className="text-lg font-semibold text-white mt-1">
              {market === 'taiwan_tfda' ? 'Taiwan TFDA' : 'Thailand Thai FDA'}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Sections Processed</p>
            <p className="text-lg font-semibold text-white mt-1">{sectionsProcessed}</p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Diecut Applied</p>
            <p className="text-lg font-semibold text-white mt-1">
              {diecutApplied ? 'Yes' : 'No'}
            </p>
          </div>
          <div>
            <p className="text-sm text-zinc-400">Generation Time</p>
            <p className="text-lg font-semibold text-white mt-1">{(generationTimeMs / 1000).toFixed(2)}s</p>
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">📄 Generated PDF</h2>
          <button
            onClick={handleDownloadPdf}
            className="px-4 py-2 bg-violet-600 text-white rounded-xl font-semibold hover:bg-violet-700 transition-colors"
          >
            Download PDF
          </button>
        </div>
        <div className="bg-zinc-900 rounded-xl p-4 border border-white/5">
          <iframe
            src={`data:application/pdf;base64,${pdfBase64}`}
            className="w-full h-[600px] rounded-lg"
            title="Generated AW PDF Preview"
          />
        </div>
      </div>
    </div>
  );
}