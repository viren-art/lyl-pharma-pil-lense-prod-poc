import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function F3Preview() {
  const [selectedDocument, setSelectedDocument] = React.useState('');
  const [extracting, setExtracting] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [selectedSection, setSelectedSection] = React.useState(null);
  const [selectedPage, setSelectedPage] = React.useState(1);
  const [zoomLevel, setZoomLevel] = React.useState(1);
  const [progress, setProgress] = React.useState(0);

  const documents = [
    { id: '1', name: 'Zenora_PIL_Taiwan_v2.3.pdf', type: 'approved_pil', pages: 8 },
    { id: '2', name: 'Lenalidomide_Innovator_EN.pdf', type: 'innovator_pil', pages: 12 },
    { id: '3', name: 'Ibrutinib_AW_Draft_Thailand.pdf', type: 'aw_draft', pages: 6 }
  ];

  const sections = [
    {
      name: 'PRODUCT NAME',
      content: 'Zenora (Abiraterone Acetate) 250mg\nFilm-coated Tablets',
      pages: [1],
      confidence: 0.96,
      critical: false
    },
    {
      name: 'ACTIVE INGREDIENTS',
      content: 'Each film-coated tablet contains:\nAbiraterone Acetate 250mg\n\nExcipients:\nLactose monohydrate\nMicrocrystalline cellulose\nCroscarmellose sodium\nPovidone K30\nSodium lauryl sulfate\nMagnesium stearate',
      pages: [1, 2],
      confidence: 0.93,
      critical: true
    },
    {
      name: 'THERAPEUTIC INDICATIONS',
      content: 'Zenora is indicated in combination with prednisone or prednisolone for:\n\n1. Treatment of metastatic castration-resistant prostate cancer (mCRPC) in adult men who are asymptomatic or mildly symptomatic after failure of androgen deprivation therapy in whom chemotherapy is not yet clinically indicated.\n\n2. Treatment of mCRPC in adult men whose disease has progressed on or after a docetaxel-based chemotherapy regimen.',
      pages: [2],
      confidence: 0.89,
      critical: false
    },
    {
      name: 'DOSAGE AND ADMINISTRATION',
      content: 'Recommended Dosage:\n• Adults: 1000mg (four 250mg tablets) once daily\n• Must be taken on an empty stomach\n• No food should be consumed for at least 2 hours before and 1 hour after taking Zenora\n• Tablets should be swallowed whole with water\n\nConcomitant Therapy:\n• Must be administered with prednisone or prednisolone 5mg twice daily\n\nDosage Modifications:\nHepatotoxicity:\n• ALT or AST >5× ULN: Discontinue treatment\n• Upon recovery, may restart at 750mg once daily',
      pages: [2, 3],
      confidence: 0.91,
      critical: true
    },
    {
      name: 'CONTRAINDICATIONS',
      content: '• Hypersensitivity to abiraterone acetate or any excipients\n• Women who are or may become pregnant\n• Severe hepatic impairment (Child-Pugh Class C)',
      pages: [3],
      confidence: 0.88,
      critical: true
    },
    {
      name: 'WARNINGS AND PRECAUTIONS',
      content: 'Hepatotoxicity:\n• Monitor liver function tests at baseline, every 2 weeks for first 3 months, then monthly\n• Elevations in ALT, AST, and bilirubin have been reported\n\nHypertension and Hypokalemia:\n• Monitor blood pressure and serum potassium\n• Correct hypokalemia before treatment\n\nAdrenocortical Insufficiency:\n• May occur with infection, stress, or interruption of corticosteroid\n• Monitor for signs and symptoms\n\nCardiac Disorders:\n• Use with caution in patients with history of cardiovascular disease',
      pages: [3, 4],
      confidence: 0.87,
      critical: true
    },
    {
      name: 'ADVERSE REACTIONS',
      content: 'Very Common (≥10%):\n• Urinary tract infection\n• Hypokalemia\n• Hypertension\n• Peripheral edema\n• Diarrhea\n• Hot flush\n\nCommon (1-10%):\n• Cardiac failure\n• Angina pectoris\n• Arrhythmia\n• Dyspepsia\n• Elevated liver enzymes\n• Rash\n• Fractures\n\nUncommon (0.1-1%):\n• Adrenocortical insufficiency\n• Myopathy\n• Rhabdomyolysis',
      pages: [4, 5],
      confidence: 0.90,
      critical: false
    },
    {
      name: 'STORAGE',
      content: 'Store at room temperature (15-30°C)\nKeep in original container to protect from moisture\nDo not use after expiry date\nKeep out of reach of children',
      pages: [5],
      confidence: 0.94,
      critical: false
    }
  ];

  React.useEffect(() => {
    if (extracting) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setExtracting(false);
            setShowResults(true);
            return 100;
          }
          return prev + 8;
        });
      }, 300);
      return () => clearInterval(interval);
    }
  }, [extracting]);

  const handleStartExtraction = () => {
    if (!selectedDocument) return;
    setProgress(0);
    setExtracting(true);
    setShowResults(false);
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.85) return 'text-emerald-400 bg-emerald-500/10';
    if (score >= 0.70) return 'text-amber-400 bg-amber-500/10';
    return 'text-rose-400 bg-rose-500/10';
  };

  const getConfidenceLabel = (score) => {
    if (score >= 0.85) return 'High';
    if (score >= 0.70) return 'Medium';
    return 'Low';
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">
              Document Extraction
            </h1>
            <p className="text-zinc-400">
              Extract structured content from pharmaceutical documents using AI
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 bg-violet-500/10 border border-violet-500/20 rounded-lg">
              <div className="text-xs text-violet-400 font-medium">Google Document AI</div>
            </div>
            <div className="px-3 py-1.5 bg-zinc-800 border border-white/10 rounded-lg">
              <div className="text-xs text-zinc-400">Fallback: Claude Vision</div>
            </div>
          </div>
        </div>

        {/* Document Selection */}
        {!extracting && !showResults && (
          <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-6 shadow-lg shadow-black/20">
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">
              Select Document to Extract
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Document
                </label>
                <select
                  value={selectedDocument}
                  onChange={(e) => setSelectedDocument(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select a document...</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.type}) - {doc.pages} pages
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={handleStartExtraction}
                disabled={!selectedDocument}
                className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all shadow-lg shadow-violet-500/20"
              >
                Start Extraction
              </button>
            </div>
          </div>
        )}

        {/* Extraction Progress */}
        {extracting && (
          <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-6 shadow-lg shadow-black/20">
            <div className="flex items-center gap-3 mb-4">
              <div className="animate-spin text-2xl">⚙️</div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-zinc-200">
                  Extracting Document Content
                </h3>
                <p className="text-sm text-zinc-400">Zenora_PIL_Taiwan_v2.3.pdf</p>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-violet-400">
                  {Math.round(progress)}%
                </div>
                <div className="text-xs text-zinc-500">{Math.floor(progress / 12.5)}s</div>
              </div>
            </div>

            <div className="relative h-2 bg-zinc-700/50 rounded-full overflow-hidden mb-4">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-zinc-500 mb-1">Status</div>
                <div className="text-zinc-200 font-medium">Extracting</div>
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Pages</div>
                <div className="text-zinc-200 font-medium">
                  {Math.floor(progress / 12.5)} / 8
                </div>
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Sections Found</div>
                <div className="text-zinc-200 font-medium">{Math.floor(progress / 12.5)}</div>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-5 shadow-lg shadow-black/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-zinc-200">
                  Extraction Complete
                </h2>
                <div className="flex items-center gap-3">
                  <div className="text-xs text-zinc-400">
                    Provider: <span className="text-emerald-400 font-medium">Google Document AI</span>
                  </div>
                  <button
                    onClick={() => {
                      setShowResults(false);
                      setSelectedDocument('');
                      setSelectedSection(null);
                    }}
                    className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    Extract Another
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <div className="text-zinc-500 mb-1">Total Sections</div>
                  <div className="text-2xl font-bold text-violet-400">{sections.length}</div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1">Total Pages</div>
                  <div className="text-2xl font-bold text-cyan-400">8</div>
                </div>
                <div>
                  <div className="text-zinc-500 mb-1">Avg Confidence</div>
                  <div className="text-2xl font-bold text-emerald-400">91%</div>
                </div>
              </div>
            </div>

            {/* Two-column layout */}
            <div className="grid grid-cols-2 gap-6">
              {/* Sections list */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-200 mb-3">
                  Extracted Sections
                </h3>
                
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                  {sections.map((section, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setSelectedSection(section);
                        setSelectedPage(section.pages[0]);
                      }}
                      className={`bg-zinc-800/50 border rounded-xl p-4 cursor-pointer transition-all ${
                        selectedSection === section
                          ? 'border-violet-500/50 bg-violet-500/5'
                          : 'border-white/[0.06] hover:border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-zinc-200 text-sm">
                              {section.name}
                            </h4>
                            {section.critical && (
                              <span className="text-xs">⚠️</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-zinc-500">
                            <span>Pages: {section.pages.join(', ')}</span>
                          </div>
                        </div>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(section.confidence)}`}>
                          {Math.round(section.confidence * 100)}%
                        </span>
                      </div>
                      
                      <p className="text-xs text-zinc-400 line-clamp-2">
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Verification panel */}
              <div className="space-y-3">
                <h3 className="text-lg font-semibold text-zinc-200 mb-3">
                  Source Verification
                </h3>

                {selectedSection ? (
                  <div className="space-y-4">
                    {/* Section content */}
                    <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-5 shadow-lg shadow-black/20">
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-semibold text-zinc-200">
                          {selectedSection.name}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(selectedSection.confidence)}`}>
                            {getConfidenceLabel(selectedSection.confidence)}
                          </span>
                          {selectedSection.confidence < 0.85 && selectedSection.critical && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full text-xs font-medium">
                              <span>⚠️</span>
                              <span>Review</span>
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="text-sm text-zinc-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                        {selectedSection.content}
                      </div>
                    </div>

                    {/* Page thumbnails */}
                    <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20">
                      <div className="text-xs text-zinc-500 mb-3">
                        Source Pages ({selectedSection.pages.length})
                      </div>
                      <div className="flex gap-2">
                        {selectedSection.pages.map(pageNum => (
                          <div
                            key={pageNum}
                            onClick={() => setSelectedPage(pageNum)}
                            className={`flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                              selectedPage === pageNum
                                ? 'border-violet-500'
                                : 'border-white/10 hover:border-white/20'
                            }`}
                          >
                            <div className="w-20 h-28 bg-zinc-700 flex items-center justify-center">
                              <div className="text-2xl">📄</div>
                            </div>
                            <div className="bg-zinc-900 px-2 py-1 text-center">
                              <div className="text-xs text-zinc-400">Page {pageNum}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Page viewer */}
                    <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-4 shadow-lg shadow-black/20">
                      <div className="flex items-center justify-between mb-3">
                        <div className="text-sm font-semibold text-zinc-200">
                          Page {selectedPage}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))}
                            className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300"
                          >
                            −
                          </button>
                          <span className="text-xs text-zinc-400 w-12 text-center">
                            {Math.round(zoomLevel * 100)}%
                          </span>
                          <button
                            onClick={() => setZoomLevel(Math.min(2, zoomLevel + 0.25))}
                            className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-xs text-zinc-300"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-zinc-900 rounded-lg p-8 flex items-center justify-center min-h-[400px]">
                        <div className="text-center text-zinc-500">
                          <div className="text-6xl mb-4">📄</div>
                          <div className="text-sm">Page {selectedPage} Preview</div>
                          <div className="text-xs mt-2">Zoom: {Math.round(zoomLevel * 100)}%</div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-8 text-center shadow-lg shadow-black/20">
                    <div className="text-4xl mb-4">👈</div>
                    <p className="text-zinc-400">Select a section to view details</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}