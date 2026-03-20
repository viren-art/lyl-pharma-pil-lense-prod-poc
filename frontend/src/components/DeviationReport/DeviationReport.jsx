import { useState } from 'react';

export default function DeviationReport({ workflowResult }) {
  const [selectedDeviation, setSelectedDeviation] = useState(null);
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [sortBy, setSortBy] = useState('severity'); // severity, section, page

  if (!workflowResult) {
    return (
      <div className="p-6 text-center text-zinc-400">
        No deviation report available
      </div>
    );
  }

  const { deviations, summary, executionTimeMs, executedDate, inputDocuments } = workflowResult;

  // Filter deviations by severity
  const filteredDeviations = filterSeverity === 'all' 
    ? deviations 
    : deviations.filter(d => d.severity === filterSeverity);

  // Sort deviations
  const sortedDeviations = [...filteredDeviations].sort((a, b) => {
    if (sortBy === 'severity') {
      const severityOrder = { critical: 3, major: 2, minor: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    } else if (sortBy === 'section') {
      return a.sectionName.localeCompare(b.sectionName);
    } else if (sortBy === 'page') {
      return a.pageReference - b.pageReference;
    }
    return 0;
  });

  const getSeverityColor = (severity) => {
    const colors = {
      critical: 'rose',
      major: 'amber',
      minor: 'slate'
    };
    return colors[severity] || 'amber';
  };

  const getSeverityBadgeClasses = (severity) => {
    const color = getSeverityColor(severity);
    return `inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-${color}-500/10 text-${color}-400 border border-${color}-500/20`;
  };

  const getDeviationTypeLabel = (type) => {
    const labels = {
      dosage_error: 'Dosage Error',
      missing_warning: 'Missing Warning',
      wrong_ingredient_info: 'Wrong Ingredient Info',
      missing_section: 'Missing Section',
      content_error: 'Content Error',
      formatting_difference: 'Formatting Difference',
      spacing_difference: 'Spacing Difference'
    };
    return labels[type] || type;
  };

  const awDraft = inputDocuments.find(d => d.type === 'aw_draft');
  const approvedPil = inputDocuments.find(d => d.type === 'approved_pil');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Deviation Report</h2>
            <p className="text-sm text-zinc-400">
              Comparing {awDraft?.name} against {approvedPil?.name}
            </p>
          </div>
          <div className="text-right">
            <div className="text-xs text-zinc-500">Executed</div>
            <div className="text-sm text-zinc-300">
              {new Date(executedDate).toLocaleString()}
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {(executionTimeMs / 1000).toFixed(1)}s processing time
            </div>
          </div>
        </div>

        {/* Summary Statistics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-white/5 rounded-xl p-4 border border-white/10">
            <div className="text-3xl font-bold text-white mb-1">
              {deviations.length}
            </div>
            <div className="text-xs text-zinc-400">Total Deviations</div>
          </div>
          <div className="bg-rose-500/10 rounded-xl p-4 border border-rose-500/20">
            <div className="text-3xl font-bold text-rose-400 mb-1">
              {summary.totalCritical}
            </div>
            <div className="text-xs text-rose-300">Critical</div>
          </div>
          <div className="bg-amber-500/10 rounded-xl p-4 border border-amber-500/20">
            <div className="text-3xl font-bold text-amber-400 mb-1">
              {summary.totalMajor}
            </div>
            <div className="text-xs text-amber-300">Major</div>
          </div>
          <div className="bg-slate-500/10 rounded-xl p-4 border border-slate-500/20">
            <div className="text-3xl font-bold text-slate-400 mb-1">
              {summary.totalMinor}
            </div>
            <div className="text-xs text-slate-300">Minor</div>
          </div>
        </div>

        {/* Critical Alert */}
        {summary.totalCritical > 0 && (
          <div className="mt-4 bg-rose-500/10 border border-rose-500/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-semibold text-rose-400 mb-1">
                  Critical Deviations Detected
                </div>
                <div className="text-sm text-rose-300">
                  {summary.totalCritical} critical deviation{summary.totalCritical !== 1 ? 's' : ''} found. 
                  These require immediate correction before regulatory approval.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Controls */}
      <div className="bg-zinc-800/50 rounded-2xl p-4 border border-white/[0.06]">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-400">Filter by severity:</label>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
            >
              <option value="all">All ({deviations.length})</option>
              <option value="critical">Critical ({summary.totalCritical})</option>
              <option value="major">Major ({summary.totalMajor})</option>
              <option value="minor">Minor ({summary.totalMinor})</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-zinc-400">Sort by:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-zinc-900 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none"
            >
              <option value="severity">Severity</option>
              <option value="section">Section Name</option>
              <option value="page">Page Number</option>
            </select>
          </div>
        </div>
      </div>

      {/* Deviations List */}
      {sortedDeviations.length === 0 ? (
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-8 text-center">
          <div className="text-4xl mb-3">✅</div>
          <div className="text-lg font-semibold text-emerald-400 mb-2">
            No Deviations Found
          </div>
          <div className="text-sm text-emerald-300">
            {filterSeverity === 'all' 
              ? 'The artwork draft matches the approved PIL perfectly.'
              : `No ${filterSeverity} deviations detected.`}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedDeviations.map((deviation, index) => (
            <div
              key={index}
              className={`bg-zinc-800/50 rounded-2xl border transition-all cursor-pointer ${
                selectedDeviation === index
                  ? 'border-violet-500/50 shadow-lg shadow-violet-500/10'
                  : 'border-white/[0.06] hover:border-white/10'
              }`}
              onClick={() => setSelectedDeviation(selectedDeviation === index ? null : index)}
            >
              <div className="p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={getSeverityBadgeClasses(deviation.severity)}>
                        {deviation.severity.toUpperCase()}
                      </span>
                      <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-violet-500/10 text-violet-400 border border-violet-500/20">
                        {getDeviationTypeLabel(deviation.deviationType)}
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
      )}

      {/* Export Button */}
      <div className="flex justify-end">
        <button
          onClick={() => {
            // Export functionality would be implemented here
            alert('Export to PDF functionality would be implemented here');
          }}
          className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          📄 Export Report as PDF
        </button>
      </div>
    </div>
  );
}