import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

/* ---------- confidence / severity color helpers ---------- */

function confidenceColor(score) {
  if (score >= 0.85) return 'text-emerald-700 bg-emerald-50 border-emerald-200';
  if (score >= 0.70) return 'text-amber-700 bg-amber-50 border-amber-200';
  return 'text-red-700 bg-red-50 border-red-200';
}

function severityStyle(severity) {
  if (severity === 'critical') return 'bg-red-50 text-red-700 border-red-200';
  if (severity === 'major') return 'bg-orange-50 text-orange-700 border-orange-200';
  return 'bg-yellow-50 text-yellow-700 border-yellow-200';
}

function significanceColor(score) {
  if (score >= 90) return 'text-red-600';
  if (score >= 70) return 'text-orange-600';
  if (score >= 40) return 'text-amber-600';
  return 'text-gray-500';
}

/* ---------- Workflow title mapping ---------- */

const WORKFLOW_TITLES = {
  create_draft: 'Create PIL Draft',
  assess_variation: 'Assess Variation',
  review_aw: 'Review AW',
  generate_aw: 'Generate AW Draft',
};

/* ---------- Data normalization helpers ---------- */

/**
 * Normalize backend response to the shape each renderer expects.
 * Backend responses vary by workflow, so we map fields accordingly.
 */
function normalizeCreateDraftData(raw) {
  // Map sectionMapping (new backend) or sectionAlignment (old) to UI format
  const mapping = raw.sectionMapping || raw.sectionAlignment || [];
  const sectionAlignment = mapping.map(a => {
    // New backend format: { targetSection: { name, localName }, sourceSection: { sectionName }, mappingConfidence, status }
    const target = typeof a.targetSection === 'object'
      ? `${a.targetSection.name}${a.targetSection.localName ? ' (' + a.targetSection.localName + ')' : ''}`
      : (a.targetSection || a.localMarketSection || '');
    const source = a.sourceSection?.sectionName || a.innovatorSection || a.innovatorSectionName || 'NOT FOUND';
    return {
      targetSection: target,
      innovatorSection: source,
      confidence: a.mappingConfidence || a.confidence || 0,
      notes: a.status || a.notes || a.alignmentStatus || '',
      pages: a.sourceSection?.pageReferences || a.pageReferences || a.pages || [],
    };
  });

  // Map gapAnalysis (new backend) or gaps (old) to UI format
  const gapData = raw.gapAnalysis || raw.gaps || {};
  const missingGaps = (gapData.gaps || gapData.missing || gapData.missingSections || []).map(g => ({
    section: g.targetSection || g.section || g.sectionName || '',
    reason: g.suggestedAction || g.reason || g.description || '',
    severity: g.severity || g.priority || 'major',
  }));
  const unmapped = (gapData.unmappedSources || []).map(u => ({
    section: u.sectionName || '',
    elements: [u.suggestedAction || 'Content may need restructuring'],
    severity: 'minor',
    pages: [],
  }));

  return {
    documentsProcessed: raw.extractionResults?.length || raw.documentsProcessed || 3,
    executionTime: formatTime(raw.executionTimeMs),
    sectionAlignment,
    gaps: {
      missing: missingGaps,
      incomplete: (gapData.incomplete || gapData.incompleteContent || unmapped || []).map(g => ({
        section: g.section || g.sectionName || '',
        elements: g.elements || g.missingElements || [],
        severity: g.severity || 'major',
        pages: g.pages || g.pageReferences || [],
      })),
    },
    // Extra data from new backend
    diagrams: raw.diagramCarryover || [],
    crossRefReport: raw.crossRefReport || null,
    translationChecklist: raw.translationChecklist || [],
    marketTemplate: raw.marketTemplate || null,
    structuredDraft: raw.structuredDraft || null,
  };
}

function normalizeAssessVariationData(raw) {
  const classification = (raw.classification || '').toLowerCase();
  return {
    executionTime: formatTime(raw.executionTimeMs),
    classification,
    confidenceScore: raw.confidenceScore || raw.confidence || 0,
    justification: raw.justification || '',
    summary: raw.summary || {
      totalSections: (raw.sectionDiffs || []).length,
      changed: (raw.sectionDiffs || []).filter(d => d.changeType !== 'unchanged').length,
      added: (raw.sectionDiffs || []).filter(d => d.changeType === 'added').length,
      removed: (raw.sectionDiffs || []).filter(d => d.changeType === 'removed').length,
      avgSignificance: Math.round(
        ((raw.sectionDiffs || []).reduce((sum, d) => sum + (d.significance || d.significanceScore || 0), 0) /
        Math.max(1, (raw.sectionDiffs || []).length))
      ),
    },
    sectionDiffs: (raw.sectionDiffs || []).map(d => ({
      section: d.section || d.sectionName || '',
      changeType: d.changeType || 'unchanged',
      significance: d.significance || d.significanceScore || 0,
      summary: d.summary || d.changeSummary || '',
    })),
  };
}

function normalizeReviewAWData(raw) {
  const deviations = (raw.deviations || []).map(d => ({
    severity: d.severity || 'minor',
    section: d.section || d.sectionName || '',
    approvedText: d.approvedText || '',
    artworkText: d.artworkText || '',
    page: d.page || d.pageReference || 1,
    confidence: d.confidence || d.confidenceScore || 0.85,
    explanation: d.explanation || d.description || '',
  }));

  const summary = raw.summary || {
    critical: deviations.filter(d => d.severity === 'critical').length,
    major: deviations.filter(d => d.severity === 'major').length,
    minor: deviations.filter(d => d.severity === 'minor').length,
  };

  // Extract sections from the extraction result if available
  const sections = (raw.sections || raw.extractedSections || []).map(s => ({
    name: s.name || s.sectionName || '',
    content: s.content || '',
    pages: s.pages || s.pageReferences || [],
    confidence: s.confidence || s.confidenceScore || 0.85,
  }));

  return { executionTime: formatTime(raw.executionTimeMs), deviations, summary, sections };
}

function normalizeGenerateAWData(raw) {
  return {
    executionTime: formatTime(raw.executionTimeMs),
    market: raw.market || '',
    sectionsProcessed: raw.sectionsProcessed || 0,
    diecutApplied: raw.diecutApplied || false,
    template: raw.template || {},
  };
}

function formatTime(ms) {
  if (!ms) return '--';
  return `${(ms / 1000).toFixed(1)}s`;
}

/* ---------- Sub-renderers ---------- */

function CreateDraftResults({ data }) {
  const [tab, setTab] = useState('alignment');
  const diagramCount = (data.diagrams || []).length;
  const translationCount = (data.translationChecklist || []).length;

  return (
    <div className="space-y-6">
      {/* Market template info */}
      {data.marketTemplate && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm">
          <span className="font-semibold text-blue-800">Target Market:</span>{' '}
          <span className="text-blue-700">{data.marketTemplate.marketName || data.marketTemplate.marketCode}</span>
          <span className="text-blue-500 ml-2">({data.marketTemplate.language})</span>
          <span className="text-blue-400 ml-2">• {data.marketTemplate.sectionCount} sections • Source: {data.marketTemplate.source}</span>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
        <Stat label="Documents Processed" value={data.documentsProcessed} />
        <Stat label="Sections Mapped" value={data.sectionAlignment.length} />
        <Stat label="Gaps Found" value={data.gaps.missing.length + data.gaps.incomplete.length} accent="text-orange-600" />
        <Stat label="Diagrams" value={diagramCount} />
        <Stat label="Translation Items" value={translationCount} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          {[
            { id: 'alignment', label: 'Section Mapping', count: data.sectionAlignment.length },
            { id: 'gaps', label: 'Gap Analysis', count: data.gaps.missing.length + data.gaps.incomplete.length },
            ...(diagramCount > 0 ? [{ id: 'diagrams', label: 'Diagrams', count: diagramCount }] : []),
            ...(translationCount > 0 ? [{ id: 'translation', label: 'Translation', count: translationCount }] : []),
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                tab === t.id
                  ? 'text-navy-700 border-b-2 border-navy-700 bg-navy-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label} <span className="ml-1 text-xs text-gray-400">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {tab === 'alignment' && (
            <div className="space-y-3">
              {data.sectionAlignment.map((a, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{a.targetSection}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Maps to: <span className="font-medium text-gray-700">{a.innovatorSection}</span>
                      </p>
                      <p className="text-xs text-gray-400 mt-1 italic">{a.notes}</p>
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium border ${confidenceColor(a.confidence)}`}>
                      {(a.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'gaps' && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Missing Sections ({data.gaps.missing.length})</h4>
                <div className="space-y-2">
                  {data.gaps.missing.map((g, i) => (
                    <div key={i} className="rounded-lg border border-red-100 bg-red-50/50 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{g.section}</p>
                          <p className="text-xs text-gray-600 mt-1">{g.reason}</p>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityStyle(g.severity)}`}>{g.severity}</span>
                      </div>
                    </div>
                  ))}
                  {data.gaps.missing.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No missing sections found</p>
                  )}
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Incomplete Content ({data.gaps.incomplete.length})</h4>
                <div className="space-y-2">
                  {data.gaps.incomplete.map((g, i) => (
                    <div key={i} className="rounded-lg border border-orange-100 bg-orange-50/50 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-semibold text-gray-900">{g.section}</p>
                        <span className={`px-2 py-0.5 rounded text-xs font-medium border ${severityStyle(g.severity)}`}>{g.severity}</span>
                      </div>
                      <ul className="list-disc list-inside text-xs text-gray-600 space-y-0.5">
                        {(g.elements || []).map((el, j) => <li key={j}>{el}</li>)}
                      </ul>
                    </div>
                  ))}
                  {data.gaps.incomplete.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-4">No incomplete content found</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {tab === 'diagrams' && (
            <div className="space-y-3">
              {(data.diagrams || []).map((d, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 mr-2">
                        {d.type?.replace('_', ' ')}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">{d.description}</span>
                      <p className="text-xs text-gray-500 mt-1">
                        Page {d.pageNumber} • Target section: {d.targetSection || d.relatedSection || 'N/A'}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">carry over</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'translation' && (
            <div className="space-y-3">
              {(data.translationChecklist || []).map((t, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4 hover:bg-gray-50/50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{t.section}</p>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                          t.status?.includes('Translated') ? 'bg-emerald-50 text-emerald-700' :
                          t.status?.includes('human') ? 'bg-red-50 text-red-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>{t.status || 'Pending'}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{t.localName}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {t.sourceLanguage} → {t.targetLanguage} • {t.wordCount} words
                      </p>
                      {t.preservationNotes?.length > 0 && (
                        <ul className="mt-2 space-y-0.5">
                          {t.preservationNotes.map((n, j) => (
                            <li key={j} className="text-xs text-amber-600">⚠ {n}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <span className={`inline-flex px-2.5 py-1 rounded text-xs font-medium border ${
                      t.complexity === 'high' ? 'bg-red-50 text-red-700 border-red-200' :
                      t.complexity === 'medium' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>{t.complexity}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssessVariationResults({ data }) {
  const isComplicated = data.classification === 'complicated';
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Variation Classification</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Confidence: <span className="font-semibold text-gray-900">{(data.confidenceScore * 100).toFixed(0)}%</span>
            </p>
          </div>
          <span className={`px-4 py-1.5 rounded-full text-sm font-semibold ${
            isComplicated ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          }`}>
            {isComplicated ? 'COMPLICATED' : 'GENERAL'}
          </span>
        </div>
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
          <p className="text-sm text-gray-600 leading-relaxed">{data.justification}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total Sections" value={data.summary.totalSections} />
        <Stat label="Changed" value={data.summary.changed} accent="text-amber-600" />
        <Stat label="Added" value={data.summary.added} accent="text-sky-600" />
        <Stat label="Removed" value={data.summary.removed} accent="text-red-600" />
        <Stat label="Avg Significance" value={data.summary.avgSignificance} />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">Section-by-Section Analysis</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Section</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Significance</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Summary</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.sectionDiffs.map((s, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-5 py-3 text-sm font-medium text-gray-900">{s.section}</td>
                  <td className="px-5 py-3"><ChangeTypeBadge type={s.changeType} /></td>
                  <td className="px-5 py-3">
                    <span className={`text-lg font-bold ${significanceColor(s.significance)}`}>{s.significance}</span>
                  </td>
                  <td className="px-5 py-3 text-sm text-gray-500 max-w-md">{s.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ReviewAWResults({ data }) {
  const [expandedIdx, setExpandedIdx] = useState(null);
  const [activeTab, setActiveTab] = useState('deviations');

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-red-200 p-5">
          <div className="text-3xl font-bold text-red-600">{data.summary.critical}</div>
          <div className="text-xs text-gray-500 mt-1">Critical Deviations</div>
        </div>
        <div className="bg-white rounded-xl border border-orange-200 p-5">
          <div className="text-3xl font-bold text-orange-600">{data.summary.major}</div>
          <div className="text-xs text-gray-500 mt-1">Major Deviations</div>
        </div>
        <div className="bg-white rounded-xl border border-yellow-200 p-5">
          <div className="text-3xl font-bold text-yellow-600">{data.summary.minor}</div>
          <div className="text-xs text-gray-500 mt-1">Minor Deviations</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { id: 'deviations', label: 'Deviations', count: data.deviations.length },
            { id: 'extraction', label: 'Extracted Sections', count: data.sections.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === t.id
                  ? 'text-navy-700 border-b-2 border-navy-700 bg-navy-50/50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              {t.label} <span className="ml-1 text-xs text-gray-400">({t.count})</span>
            </button>
          ))}
        </div>

        <div className="p-5">
          {activeTab === 'deviations' && (
            <div className="space-y-3">
              {data.deviations.map((d, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-4 cursor-pointer transition-colors ${
                    expandedIdx === i ? 'border-navy-200 bg-navy-50/30' : 'border-gray-100 hover:border-gray-200'
                  }`}
                  onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold border uppercase ${severityStyle(d.severity)}`}>
                          {d.severity}
                        </span>
                        <span className="text-sm font-semibold text-gray-900">{d.section}</span>
                      </div>
                      <p className="text-xs text-gray-400">Page {d.page}</p>
                      {d.explanation && (
                        <p className="text-xs text-gray-500 mt-1">{d.explanation}</p>
                      )}
                    </div>
                    <span className={`px-2.5 py-1 rounded text-xs font-medium border ${confidenceColor(d.confidence)}`}>
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                  </div>

                  {expandedIdx === i && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-semibold text-emerald-700 mb-1.5">Approved Text</p>
                        <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                          <p className="text-sm text-gray-700">{d.approvedText}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-red-700 mb-1.5">Artwork Text</p>
                        <div className="bg-red-50 rounded-lg p-3 border border-red-100">
                          <p className="text-sm text-gray-700">{d.artworkText || '(Missing)'}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {data.deviations.length === 0 && (
                <p className="text-sm text-emerald-600 text-center py-8">No deviations detected — documents are aligned.</p>
              )}
            </div>
          )}

          {activeTab === 'extraction' && (
            <div className="space-y-3">
              {data.sections.map((s, i) => (
                <div key={i} className="rounded-lg border border-gray-100 p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-sm font-semibold text-gray-900">{s.name}</h4>
                    <span className={`px-2.5 py-1 rounded text-xs font-medium border ${confidenceColor(s.confidence)}`}>
                      {(s.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{s.content}</p>
                  {s.pages.length > 0 && (
                    <p className="text-xs text-gray-400 mt-2">Pages: {s.pages.join(', ')}</p>
                  )}
                </div>
              ))}
              {data.sections.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">No extracted sections available</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GenerateAWResults({ data }) {
  return (
    <div className="space-y-6">
      <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
        <div className="flex items-start gap-3">
          <svg className="w-6 h-6 text-emerald-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <div>
            <h3 className="text-base font-semibold text-emerald-800">AW Draft Generated Successfully</h3>
            <p className="text-sm text-emerald-700 mt-0.5">
              All sections formatted according to {data.market} requirements. Ready for InDesign refinement.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Target Market" value={data.market} small />
        <Stat label="Sections Processed" value={data.sectionsProcessed} />
        <Stat label="Diecut Applied" value={data.diecutApplied ? 'Yes' : 'No'} small />
        <Stat label="Generation Time" value={data.executionTime} small />
      </div>

      {data.template && Object.keys(data.template).length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Applied Template Configuration</h3>
          <div className="space-y-3">
            {Object.entries(data.template).map(([key, val]) => (
              <div key={key} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-500">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
                <span className="text-sm font-medium text-gray-900">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- Shared small components ---------- */

function Stat({ label, value, accent, small }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
      <div className={`${small ? 'text-sm font-semibold' : 'text-2xl font-bold'} ${accent || 'text-navy-700'}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-1">{label}</div>
    </div>
  );
}

function ChangeTypeBadge({ type }) {
  const styles = {
    added: 'bg-sky-50 text-sky-700 border-sky-200',
    removed: 'bg-red-50 text-red-700 border-red-200',
    modified: 'bg-amber-50 text-amber-700 border-amber-200',
    unchanged: 'bg-gray-50 text-gray-500 border-gray-200',
  };
  const labels = { added: '+ Added', removed: '- Removed', modified: '~ Modified', unchanged: '= Unchanged' };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${styles[type] || styles.unchanged}`}>
      {labels[type] || type}
    </span>
  );
}

/* ---------- Main page ---------- */

export default function ResultsPage() {
  const location = useLocation();
  const workflowType = location.state?.workflowType;
  const rawResult = location.state?.result;

  if (!workflowType || !rawResult) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">No Results to Display</h2>
        <p className="text-sm text-gray-500 mb-6">
          Run a workflow from the Workflows page to see results here.
        </p>
        <Link
          to="/workflows"
          className="inline-flex px-5 py-2.5 bg-lotus-500 hover:bg-lotus-600 text-white rounded-lg font-medium text-sm transition-colors"
        >
          Go to Workflows
        </Link>
      </div>
    );
  }

  // Check for error in result
  if (rawResult.error) {
    return (
      <div className="max-w-3xl mx-auto px-6 py-16 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 mb-2">Workflow Failed</h2>
        <p className="text-sm text-gray-500 mb-6">{rawResult.error.message || 'An unexpected error occurred'}</p>
        <Link
          to="/workflows"
          className="inline-flex px-5 py-2.5 bg-lotus-500 hover:bg-lotus-600 text-white rounded-lg font-medium text-sm transition-colors"
        >
          Try Again
        </Link>
      </div>
    );
  }

  // Normalize data based on workflow type
  let data;
  const title = WORKFLOW_TITLES[workflowType] || 'Workflow';
  const executionTime = formatTime(rawResult.executionTimeMs);

  switch (workflowType) {
    case 'create_draft':
      data = normalizeCreateDraftData(rawResult);
      break;
    case 'assess_variation':
      data = normalizeAssessVariationData(rawResult);
      break;
    case 'review_aw':
      data = normalizeReviewAWData(rawResult);
      break;
    case 'generate_aw':
      data = normalizeGenerateAWData(rawResult);
      break;
    default:
      data = rawResult;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">{title} — Results</h1>
          <p className="text-sm text-gray-500 mt-1">
            Completed in {data.executionTime || executionTime}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/workflows"
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            New Workflow
          </Link>
        </div>
      </div>

      {/* Download buttons for Create PIL Draft */}
      {workflowType === 'create_draft' && (rawResult.docxEnBase64 || rawResult.docxBase64 || rawResult.docxTranslatedBase64) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {(rawResult.docxEnBase64 || rawResult.docxBase64) && (
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${rawResult.docxEnBase64 || rawResult.docxBase64}`;
                link.download = `PIL_Draft_${rawResult.marketTemplate?.marketCode || 'market'}_EN_${new Date().toISOString().split('T')[0]}.docx`;
                link.click();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-navy-600 hover:bg-navy-700 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
              Download English Draft
            </button>
          )}
          {rawResult.docxTranslatedBase64 && (
            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${rawResult.docxTranslatedBase64}`;
                const langCode = rawResult.targetLanguage === 'th' ? 'TH' : 'TC';
                link.download = `PIL_Draft_${rawResult.marketTemplate?.marketCode || 'market'}_${langCode}_${new Date().toISOString().split('T')[0]}.docx`;
                link.click();
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-lotus-500 hover:bg-lotus-600 text-white rounded-lg font-medium text-sm transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" /></svg>
              Download Translated Draft
            </button>
          )}
        </div>
      )}

      {/* Conditional rendering based on workflow type */}
      {workflowType === 'create_draft' && <CreateDraftResults data={data} />}
      {workflowType === 'assess_variation' && <AssessVariationResults data={data} />}
      {workflowType === 'review_aw' && <ReviewAWResults data={data} />}
      {workflowType === 'generate_aw' && <GenerateAWResults data={data} />}
    </div>
  );
}
