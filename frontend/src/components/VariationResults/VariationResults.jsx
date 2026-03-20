import { useState } from 'react';

export default function VariationResults({ workflowResult }) {
  const [selectedSection, setSelectedSection] = useState(null);
  const [showAllSections, setShowAllSections] = useState(false);
  const [filterChangeType, setFilterChangeType] = useState('all');

  if (!workflowResult) {
    return (
      <div className="p-8 text-center text-zinc-400">
        <p>No workflow result available</p>
      </div>
    );
  }

  const {
    classification,
    justification,
    confidenceScore,
    sectionDiffs,
    summary,
    keyChanges,
    criticalSections
  } = workflowResult;

  // Filter sections based on change type
  const filteredSections = filterChangeType === 'all' 
    ? sectionDiffs 
    : sectionDiffs.filter(s => s.changeType === filterChangeType);

  // Sort sections by significance score (descending)
  const sortedSections = [...filteredSections].sort((a, b) => b.significanceScore - a.significanceScore);

  // Show only top 10 sections unless "show all" is enabled
  const displayedSections = showAllSections ? sortedSections : sortedSections.slice(0, 10);

  const getClassificationColor = (classification) => {
    return classification === 'complicated' ? 'text-rose-400' : 'text-emerald-400';
  };

  const getClassificationBadge = (classification) => {
    const isComplicated = classification === 'complicated';
    return (
      <span className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${
        isComplicated 
          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' 
          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
      }`}>
        {isComplicated ? '⚠️ COMPLICATED' : '✅ GENERAL'}
      </span>
    );
  };

  const getChangeTypeBadge = (changeType) => {
    const styles = {
      added: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      removed: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      modified: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      unchanged: 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30'
    };

    const labels = {
      added: '+ Added',
      removed: '− Removed',
      modified: '~ Modified',
      unchanged: '= Unchanged'
    };

    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium border ${styles[changeType]}`}>
        {labels[changeType]}
      </span>
    );
  };

  const getSignificanceColor = (score) => {
    if (score >= 90) return 'text-rose-400';
    if (score >= 70) return 'text-amber-400';
    if (score >= 40) return 'text-yellow-400';
    if (score >= 20) return 'text-cyan-400';
    return 'text-zinc-400';
  };

  const getSignificanceLabel = (score) => {
    if (score >= 90) return 'Critical';
    if (score >= 70) return 'Major';
    if (score >= 40) return 'Moderate';
    if (score >= 20) return 'Minor';
    return 'Trivial';
  };

  return (
    <div className="space-y-6">
      {/* Classification Result */}
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Variation Classification</h2>
            <p className="text-sm text-zinc-400">
              Confidence: <span className="text-white font-semibold">{(confidenceScore * 100).toFixed(0)}%</span>
            </p>
          </div>
          {getClassificationBadge(classification)}
        </div>

        <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/[0.04]">
          <h3 className="text-sm font-semibold text-zinc-300 mb-2">Justification</h3>
          <p className="text-sm text-zinc-400 leading-relaxed">{justification}</p>
        </div>

        {keyChanges && keyChanges.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-zinc-300 mb-2">Key Changes Detected</h3>
            <ul className="space-y-2">
              {keyChanges.map((change, index) => (
                <li key={index} className="flex items-start gap-2 text-sm text-zinc-400">
                  <span className="text-violet-400 mt-0.5">•</span>
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {criticalSections && criticalSections.length > 0 && (
          <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
            <h3 className="text-sm font-semibold text-rose-400 mb-2">⚠️ Critical Sections Modified</h3>
            <div className="flex flex-wrap gap-2">
              {criticalSections.map((section, index) => (
                <span key={index} className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs rounded-md border border-rose-500/30">
                  {section}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
          <div className="text-2xl font-bold text-white">{summary.totalSections}</div>
          <div className="text-xs text-zinc-400 mt-1">Total Sections</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
          <div className="text-2xl font-bold text-amber-400">{summary.sectionsChanged}</div>
          <div className="text-xs text-zinc-400 mt-1">Changed</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
          <div className="text-2xl font-bold text-cyan-400">{summary.sectionsAdded}</div>
          <div className="text-xs text-zinc-400 mt-1">Added</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
          <div className="text-2xl font-bold text-rose-400">{summary.sectionsRemoved}</div>
          <div className="text-xs text-zinc-400 mt-1">Removed</div>
        </div>
        <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
          <div className="text-2xl font-bold text-violet-400">{summary.averageSignificance}</div>
          <div className="text-xs text-zinc-400 mt-1">Avg Significance</div>
        </div>
      </div>

      {/* Section Diff Table */}
      <div className="bg-zinc-800/50 rounded-2xl border border-white/[0.06] shadow-lg shadow-black/20 overflow-hidden">
        <div className="p-6 border-b border-white/[0.06]">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">Section-by-Section Analysis</h2>
            <div className="flex items-center gap-3">
              <select
                value={filterChangeType}
                onChange={(e) => setFilterChangeType(e.target.value)}
                className="px-3 py-2 bg-zinc-900 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="all">All Changes</option>
                <option value="modified">Modified Only</option>
                <option value="added">Added Only</option>
                <option value="removed">Removed Only</option>
                <option value="unchanged">Unchanged Only</option>
              </select>
              <button
                onClick={() => setShowAllSections(!showAllSections)}
                className="px-3 py-2 bg-violet-500/20 text-violet-400 rounded-lg text-sm font-medium hover:bg-violet-500/30 transition-colors border border-violet-500/30"
              >
                {showAllSections ? 'Show Top 10' : `Show All (${filteredSections.length})`}
              </button>
            </div>
          </div>
          <p className="text-sm text-zinc-400">
            Showing {displayedSections.length} of {filteredSections.length} sections
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-zinc-900/50 border-b border-white/[0.06]">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Section Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Change Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Significance
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Summary
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {displayedSections.map((section, index) => (
                <tr 
                  key={index}
                  className="hover:bg-white/[0.02] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-white">{section.sectionName}</div>
                  </td>
                  <td className="px-6 py-4">
                    {getChangeTypeBadge(section.changeType)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-bold ${getSignificanceColor(section.significanceScore)}`}>
                        {section.significanceScore}
                      </div>
                      <div className="text-xs text-zinc-500">
                        {getSignificanceLabel(section.significanceScore)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-zinc-400 max-w-md truncate">
                      {section.changeSummary}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => setSelectedSection(selectedSection === index ? null : index)}
                      className="text-sm text-violet-400 hover:text-violet-300 font-medium"
                    >
                      {selectedSection === index ? 'Hide Details' : 'View Details'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {displayedSections.length === 0 && (
          <div className="p-12 text-center text-zinc-500">
            <p>No sections match the selected filter</p>
          </div>
        )}
      </div>

      {/* Section Detail Modal */}
      {selectedSection !== null && displayedSections[selectedSection] && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white mb-1">
                  {displayedSections[selectedSection].sectionName}
                </h3>
                <div className="flex items-center gap-3">
                  {getChangeTypeBadge(displayedSections[selectedSection].changeType)}
                  <span className={`text-sm font-semibold ${getSignificanceColor(displayedSections[selectedSection].significanceScore)}`}>
                    Significance: {displayedSections[selectedSection].significanceScore} ({getSignificanceLabel(displayedSections[selectedSection].significanceScore)})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedSection(null)}
                className="text-zinc-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-white/[0.04]">
                <h4 className="text-sm font-semibold text-zinc-300 mb-2">Change Summary</h4>
                <p className="text-sm text-zinc-400">{displayedSections[selectedSection].changeSummary}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.04]">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-3">Approved PIL Text</h4>
                  <div className="text-sm text-zinc-400 leading-relaxed">
                    {displayedSections[selectedSection].approvedText || (
                      <span className="text-zinc-600 italic">No content (section added)</span>
                    )}
                  </div>
                </div>

                <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.04]">
                  <h4 className="text-sm font-semibold text-zinc-300 mb-3">Updated PIL Text</h4>
                  <div className="text-sm text-zinc-400 leading-relaxed">
                    {displayedSections[selectedSection].updatedText || (
                      <span className="text-zinc-600 italic">No content (section removed)</span>
                    )}
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