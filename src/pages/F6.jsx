import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function F6Preview() {
  const [selectedAwDraft, setSelectedAwDraft] = React.useState('');
  const [selectedApprovedPil, setSelectedApprovedPil] = React.useState('');
  const [analyzing, setAnalyzing] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [selectedDeviation, setSelectedDeviation] = React.useState(null);
  const [filterSeverity, setFilterSeverity] = React.useState('all');
  const [progress, setProgress] = React.useState(0);

  const awDrafts = [
    { id: '1', name: 'Zenora_AW_Draft_v3.pdf', product: 'Zenora (Abiraterone Acetate) 250mg', pages: 12 },
    { id: '2', name: 'Lenalidomide_AW_Draft_TW.pdf', product: 'Lenalidomide 25mg', pages: 8 }
  ];

  const approvedPils = [
    { id: '1', name: 'Zenora_Approved_PIL_2024.pdf', product: 'Zenora (Abiraterone Acetate) 250mg', pages: 10 },
    { id: '2', name: 'Lenalidomide_Approved_PIL.pdf', product: 'Lenalidomide 25mg', pages: 7 }
  ];

  const deviations = [
    {
      severity: 'critical',
      sectionName: 'DOSAGE AND ADMINISTRATION',
      approvedText: 'Take 250mg (one tablet) once daily with food',
      artworkText: 'Take 250mg (one tablet) twice daily with food',
      deviationType: 'Dosage Error',
      pageReference: 3,
      confidenceScore: 0.98,
      description: 'Dosage frequency changed from once daily to twice daily'
    },
    {
      severity: 'critical',
      sectionName: 'WARNINGS AND PRECAUTIONS',
      approvedText: 'Do not use if you are pregnant or breastfeeding. May cause severe liver damage.',
      artworkText: 'Do not use if you are pregnant or breastfeeding.',
      deviationType: 'Missing Warning',
      pageReference: 5,
      confidenceScore: 0.95,
      description: 'Liver damage warning missing from artwork'
    },
    {
      severity: 'major',
      sectionName: 'INDICATIONS',
      approvedText: 'Treatment of metastatic castration-resistant prostate cancer',
      artworkText: 'Treatment of prostate cancer',
      deviationType: 'Content Error',
      pageReference: 2,
      confidenceScore: 0.92,
      description: 'Indication text simplified, missing "metastatic castration-resistant" qualifier'
    },
    {
      severity: 'major',
      sectionName: 'ADVERSE REACTIONS',
      approvedText: 'Common side effects include fatigue, nausea, diarrhea, and hypertension. Serious reactions may include hepatotoxicity and cardiovascular events.',
      artworkText: '',
      deviationType: 'Missing Section',
      pageReference: 6,
      confidenceScore: 0.99,
      description: 'ADVERSE REACTIONS section completely missing from artwork'
    },
    {
      severity: 'minor',
      sectionName: 'STORAGE',
      approvedText: 'Store at room temperature (15-30°C). Keep away from moisture.',
      artworkText: 'Store at room temperature (15-30°C).\nKeep away from moisture.',
      deviationType: 'Formatting Difference',
      pageReference: 8,
      confidenceScore: 0.88,
      description: 'Line break added between storage instructions'
    },
    {
      severity: 'minor',
      sectionName: 'PRODUCT NAME',
      approvedText: 'Zenora (Abiraterone Acetate) 250mg',
      artworkText: 'Zenora  (Abiraterone Acetate)  250mg',
      deviationType: 'Spacing Difference',
      pageReference: 1,
      confidenceScore: 0.75,
      description: 'Extra spacing added around parentheses'
    }
  ];

  const summary = {
    totalCritical: 2,
    totalMajor: 2,
    totalMinor: 2
  };

  const handleStartReview = () => {
    setAnalyzing(true);
    setProgress(0);
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setAnalyzing(false);
          setShowResults(true);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'rose',
      major: 'amber',
      minor: 'slate'
    };
    return colors[severity] || 'amber';
  };

  const filteredDeviations = filterSeverity === 'all' 
    ? deviations 
    : deviations.filter(d => d.severity === filterSeverity);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">Review AW Workflow</h1>
            <p className="text-zinc-400">
              Detect deviations between AW Draft and Approved PIL
            </p>
          </div>
          <button className="text-zinc-400 hover:text-white transition-colors">
            ← Back to Documents
          </button>
        </div>

        {/* Document Selection */}
        {!showResults && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-xl font-bold text-white mb-4">Select Documents</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* AW Draft Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  AW Draft PDF
                </label>
                <select
                  value={selectedAwDraft}
                  onChange={(e) => setSelectedAwDraft(e.target.value)}
                  disabled={analyzing}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select AW Draft...</option>
                  {awDrafts.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.product})
                    </option>
                  ))}
                </select>
                {selectedAwDraft && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xs text-zinc-500 mb-1">Selected:</div>
                    <div className="text-sm text-white font-medium">
                      {awDrafts.find(d => d.id === selectedAwDraft)?.name}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {awDrafts.find(d => d.id === selectedAwDraft)?.pages} pages
                    </div>
                  </div>
                )}
              </div>

              {/* Approved PIL Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  Approved PIL
                </label>
                <select
                  value={selectedApprovedPil}
                  onChange={(e) => setSelectedApprovedPil(e.target.value)}
                  disabled={analyzing}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select Approved PIL...</option>
                  {approvedPils.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.product})
                    </option>
                  ))}
                </select>
                {selectedApprovedPil && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xs text-zinc-500 mb-1">Selected:</div>
                    <div className="text-sm text-white font-medium">
                      {approvedPils.find(d => d.id === selectedApprovedPil)?.name}
                    </div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {approvedPils.find(d => d.id === selectedApprovedPil)?.pages} pages
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Execute Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleStartReview}
                disabled={!selectedAwDraft || !selectedApprovedPil || analyzing}
                className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                {analyzing ? 'Analyzing Deviations...' : 'Start Review'}
              </button>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {analyzing && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <div className="flex items-center gap-4 mb-4">
              <div className="animate-spin text-2xl">⚙️</div>
              <div>
                <div className="font-semibold text-white">Analyzing Documents</div>
                <div className="text-sm text-zinc-400">
                  Extracting content and detecting deviations...
                </div>
              </div>
            </div>
            <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
              <div
                className="bg-violet-500 h-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 mt-2 text-right">
              {progress}% complete
            </div>
          </div>
        )}

        {/* Results */}
        {showResults && (
          <>
            {/* Summary Header */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">Deviation Report</h2>
                  <p className="text-sm text-zinc-400">
                    Comparing {awDrafts.find(d => d.id === selectedAwDraft)?.name} against {approvedPils.find(d => d.id === selectedApprovedPil)?.name}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-xs text-zinc-500">Executed</div>
                  <div className="text-sm text-zinc-300">
                    {new Date().toLocaleString()}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    3.2s processing time
                  </div>
                </div>
              </div>

              {/* Summary Statistics */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-3xl font-bold text-white mb-1">6</div>
                  <div className="text-xs text-zinc-400">Total Deviations</div>
                </div>
                <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/20">
                  <div className="text-3xl font-bold text-rose-400 mb-1">{summary.totalCritical}</div>
                  <div className="text-xs text-rose-300">Critical</div>
                </div>
                <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
                  <div className="text-3xl font-bold text-amber-400 mb-1">{summary.totalMajor}</div>
                  <div className="text-xs text-amber-300">Major</div>
                </div>
                <div className="bg-slate-500/10 rounded-xl p-4 border border-slate-500/20">
                  <div className="text-3xl font-bold text-slate-400 mb-1">{summary.totalMinor}</div>
                  <div className="text-xs text-slate-300">Minor</div>
                </div>
              </div>

              {/* Critical Alert */}
              <div className="mt-4 bg-rose-500/10 border border-rose-500/30 
rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">⚠️</div>
                  <div>
                    <div className="font-semibold text-rose-400 mb-1">
                      Critical Deviations Detected
                    </div>
                    <div className="text-sm text-rose-300">
                      {summary.totalCritical} critical deviations found. 
                      These require immediate correction before regulatory approval.
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Filters */}
            <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/[0.06] shadow-lg shadow-black/20">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-zinc-400">Filter by severity:</label>
                  <select
                    value={filterSeverity}
                    onChange={(e) => setFilterSeverity(e.target.value)}
                    className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
                  >
                    <option value="all">All (6)</option>
                    <option value="critical">Critical ({summary.totalCritical})</option>
                    <option value="major">Major ({summary.totalMajor})</option>
                    <option value="minor">Minor ({summary.totalMinor})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Deviations List */}
            <div className="space-y-3">
              {filteredDeviations.map((deviation, index) => (
                <div
                  key={index}
                  className={`bg-zinc-800/50 rounded-2xl border transition-all cursor-pointer shadow-lg shadow-black/20 ${
                    selectedDeviation === index
                      ? 'border-violet-500/50 shadow-violet-500/10'
                      : 'border-white/[0.06] hover:border-white/10'
                  }`}
                  onClick={() => setSelectedDeviation(selectedDeviation === index ? null : index)}
                >
                  <div className="p-5">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-${getSeverityColor(deviation.severity)}-500/10 text-${getSeverityColor(deviation.severity)}-400 border border-${getSeverityColor(deviation.severity)}-500/20`}>
                            {deviation.severity.toUpperCase()}
                          </span>
                          <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                            {deviation.deviationType}
                          </span>
                          <span className="text-xs text-zinc-500">
                            Page {deviation.pageReference}
                          </span>
                        </div>
                        <div className="font-semibold text-white mb-1">
                          {deviation.sectionName}
                        </div>
                        <div className="text-sm text-zinc-400">
                          {deviation.description}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-right">
                          <div className="text-xs text-zinc-500">Confidence</div>
                          <div className="text-sm font-semibold text-white">
                            {(deviation.confidenceScore * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className="text-zinc-500">
                          {selectedDeviation === index ? '▼' : '▶'}
                        </div>
                      </div>
                    </div>

                    {/* Expanded Details */}
                    {selectedDeviation === index && (
                      <div className="mt-4 pt-4 border-t border-white/10 space-y-4">
                        <div>
                          <div className="text-xs font-semibold text-emerald-400 mb-2 flex items-center gap-2">
                            <span>✓</span>
                            <span>APPROVED PIL TEXT</span>
                          </div>
                          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
                            <div className="text-sm text-white whitespace-pre-wrap">
                              {deviation.approvedText || '(No text)'}
                            </div>
                          </div>
                        </div>

                        <div>
                          <div className="text-xs font-semibold text-rose-400 mb-2 flex items-center gap-2">
                            <span>✗</span>
                            <span>ARTWORK DRAFT TEXT</span>
                          </div>
                          <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-4">
                            <div className="text-sm text-white whitespace-pre-wrap">
                              {deviation.artworkText || '(Missing or empty)'}
                            </div>
                          </div>
                        </div>

                        {deviation.severity === 'critical' && (
                          <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
                            <div className="text-xs font-semibold text-rose-400 mb-1">
                              REGULATORY IMPACT
                            </div>
                            <div className="text-sm text-rose-300">
                              Patient safety risk - immediate correction required before approval
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Export Button */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => setShowResults(false)}
                className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Start New Review
              </button>
              <button className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
                📄 Export Report as PDF
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}