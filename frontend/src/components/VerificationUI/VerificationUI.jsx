import { useState } from 'react';

export default function VerificationUI({ extractionResult }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [selectedPage, setSelectedPage] = useState(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  if (!extractionResult) {
    return (
      <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-8 text-center">
        <div className="text-4xl mb-4">📄</div>
        <p className="text-zinc-400">No extraction results to display</p>
      </div>
    );
  }

  const { sections, pageImages, provider, fallbackUsed } = extractionResult;

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

  const isCriticalSection = (sectionName) => {
    const criticalKeywords = [
      'DOSAGE',
      'WARNINGS',
      'PRECAUTIONS',
      'CONTRAINDICATIONS',
      'ACTIVE INGREDIENTS'
    ];
    return criticalKeywords.some(keyword => 
      sectionName.toUpperCase().includes(keyword)
    );
  };

  const handleSectionClick = (section) => {
    setSelectedSection(section);
    if (section.pageReferences.length > 0) {
      setSelectedPage(section.pageReferences[0]);
    }
  };

  const handlePageClick = (pageNumber) => {
    setSelectedPage(pageNumber);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-zinc-200">
            Extraction Verification
          </h2>
          <div className="flex items-center gap-3">
            <div className="text-xs text-zinc-400">
              Provider: <span className="text-zinc-200 font-medium">
                {provider === 'google_docai' ? 'Google Document AI' : 'Claude Vision'}
              </span>
            </div>
            {fallbackUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-500/10 text-amber-400 rounded-full text-xs font-medium">
                <span>⚠️</span>
                <span>Fallback Used</span>
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-zinc-500 mb-1">Total Sections</div>
            <div className="text-2xl font-bold text-violet-400">{sections.length}</div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Total Pages</div>
            <div className="text-2xl font-bold text-cyan-400">{pageImages.length}</div>
          </div>
          <div>
            <div className="text-zinc-500 mb-1">Avg Confidence</div>
            <div className="text-2xl font-bold text-emerald-400">
              {Math.round(sections.reduce((sum, s) => sum + s.confidenceScore, 0) / sections.length * 100)}%
            </div>
          </div>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-2 gap-6">
        {/* Left: Sections list */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-zinc-200 mb-3">
            Extracted Sections
          </h3>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
            {sections.map((section, idx) => (
              <div
                key={idx}
                onClick={() => handleSectionClick(section)}
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
                        {section.sectionName}
                      </h4>
                      {isCriticalSection(section.sectionName) && (
                        <span className="text-xs">⚠️</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <span>Pages: {section.pageReferences.join(', ')}</span>
                    </div>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(section.confidenceScore)}`}>
                    {Math.round(section.confidenceScore * 100)}%
                  </span>
                </div>
                
                <p className="text-xs text-zinc-400 line-clamp-2">
                  {section.content}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Page viewer and content */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-zinc-200 mb-3">
            Source Verification
          </h3>

          {selectedSection ? (
            <div className="space-y-4">
              {/* Section content */}
              <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-zinc-200">
                    {selectedSection.sectionName}
                  </h4>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(selectedSection.confidenceScore)}`}>
                      {getConfidenceLabel(selectedSection.confidenceScore)}
                    </span>
                    {selectedSection.confidenceScore < 0.85 && isCriticalSection(selectedSection.sectionName) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-rose-500/10 text-rose-400 rounded-full text-xs font-medium">
                        <span>⚠️</span>
                        <span>Review Required</span>
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="text-sm text-zinc-300 whitespace-pre-wrap max-h-[200px] overflow-y-auto">
                  {selectedSection.content}
                </div>
              </div>

              {/* Page thumbnails */}
              <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-4">
                <div className="text-xs text-zinc-500 mb-3">
                  Source Pages ({selectedSection.pageReferences.length})
                </div>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {selectedSection.pageReferences.map(pageNum => {
                    const pageImage = pageImages.find(p => p.pageNumber === pageNum);
                    return (
                      <div
                        key={pageNum}
                        onClick={() => handlePageClick(pageNum)}
                        className={`flex-shrink-0 cursor-pointer border-2 rounded-lg overflow-hidden transition-all ${
                          selectedPage === pageNum
                            ? 'border-violet-500'
                            : 'border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div className="w-20 h-28 bg-zinc-700 flex items-center justify-center">
                          {pageImage ? (
                            <img
                              src={`data:image/png;base64,${pageImage.imageBase64}`}
                              alt={`Page ${pageNum}`}
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <div className="text-2xl">📄</div>
                          )}
                        </div>
                        <div className="bg-zinc-900 px-2 py-1 text-center">
                          <div className="text-xs text-zinc-400">Page {pageNum}</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Full page viewer */}
              {selectedPage && (
                <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-4">
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
                  
                  <div className="bg-zinc-900 rounded-lg overflow-auto max-h-[400px]">
                    {pageImages.find(p => p.pageNumber === selectedPage) ? (
                      <img
                        src={`data:image/png;base64,${pageImages.find(p => p.pageNumber === selectedPage).imageBase64}`}
                        alt={`Page ${selectedPage}`}
                        className="mx-auto"
                        style={{ transform: `scale(${zoomLevel})`, transformOrigin: 'top center' }}
                      />
                    ) : (
                      <div className="h-96 flex items-center justify-center text-zinc-500">
                        <div className="text-center">
```javascript
                          <div className="text-4xl mb-2">📄</div>
                          <div>Page image not available</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-800/50 border border-white/[0.06] rounded-xl p-8 text-center">
              <div className="text-4xl mb-4">👈</div>
              <p className="text-zinc-400">Select a section to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}