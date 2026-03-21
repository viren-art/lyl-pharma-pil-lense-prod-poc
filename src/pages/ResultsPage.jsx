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

/* ---------- Mock data for each workflow type ---------- */

const MOCK = {
  create_draft: {
    title: 'Create PIL Draft',
    executionTime: '47.3s',
    documentsProcessed: 3,
    sectionAlignment: [
      { targetSection: 'PRODUCT NAME', innovatorSection: 'Product Information', confidence: 0.95, notes: 'Direct semantic match', pages: [1] },
      { targetSection: 'ACTIVE INGREDIENTS', innovatorSection: 'Composition', confidence: 0.92, notes: 'High confidence mapping', pages: [2] },
      { targetSection: 'INDICATIONS', innovatorSection: 'Therapeutic Indications', confidence: 0.88, notes: 'Semantic alignment verified', pages: [3] },
      { targetSection: 'DOSAGE AND ADMINISTRATION', innovatorSection: 'Posology and Method of Administration', confidence: 0.91, notes: 'Contains dosage tables requiring special attention', pages: [4, 5] },
      { targetSection: 'CONTRAINDICATIONS', innovatorSection: 'Contraindications', confidence: 0.98, notes: 'Exact match', pages: [6] },
      { targetSection: 'WARNINGS AND PRECAUTIONS', innovatorSection: 'Special Warnings and Precautions', confidence: 0.89, notes: 'Regulatory alignment confirmed', pages: [7, 8] },
      { targetSection: 'ADVERSE REACTIONS', innovatorSection: 'Undesirable Effects', confidence: 0.87, notes: 'Terminology variation handled', pages: [9, 10] },
      { targetSection: 'STORAGE CONDITIONS', innovatorSection: 'NOT_FOUND', confidence: 0.25, notes: 'Missing from innovator PIL - requires new content', pages: [] },
    ],
    gaps: {
      missing: [
        { section: 'STORAGE CONDITIONS', reason: 'Required by Taiwan TFDA but not present in innovator PIL', severity: 'major' },
        { section: 'EMERGENCY CONTACT INFORMATION', reason: 'Mandatory for local market compliance', severity: 'critical' },
      ],
      incomplete: [
        { section: 'CONTRAINDICATIONS', elements: ['pregnancy warnings', 'pediatric use restrictions'], severity: 'major', pages: [6] },
        { section: 'DOSAGE AND ADMINISTRATION', elements: ['renal impairment dosing', 'hepatic impairment dosing'], severity: 'critical', pages: [4, 5] },
      ],
    },
  },
  assess_variation: {
    title: 'Assess Variation',
    executionTime: '6.8s',
    classification: 'complicated',
    confidenceScore: 0.87,
    justification: 'Classified as COMPLICATED: 42.9% of sections changed (6/14), including 2 critical section(s). Significant modifications detected in DOSAGE AND ADMINISTRATION and WARNINGS AND PRECAUTIONS sections.',
    summary: { totalSections: 14, changed: 6, added: 1, removed: 0, avgSignificance: 68 },
    sectionDiffs: [
      { section: 'DOSAGE AND ADMINISTRATION', changeType: 'modified', significance: 95, summary: 'Modified dosing schedule for hepatic impairment patients' },
      { section: 'CONTRAINDICATIONS', changeType: 'modified', significance: 92, summary: 'New contraindication added for severe hepatic impairment' },
      { section: 'WARNINGS AND PRECAUTIONS', changeType: 'modified', significance: 88, summary: 'Added hepatotoxicity monitoring requirements' },
      { section: 'DRUG INTERACTIONS', changeType: 'modified', significance: 75, summary: 'Added interaction with strong CYP3A4 inhibitors' },
      { section: 'ADVERSE REACTIONS', changeType: 'modified', significance: 65, summary: 'Updated frequency data from post-marketing surveillance' },
      { section: 'SPECIAL POPULATIONS', changeType: 'added', significance: 70, summary: 'New section for hepatic impairment population' },
    ],
  },
  review_aw: {
    title: 'Review AW',
    executionTime: '8.2s',
    deviations: [
      { severity: 'critical', section: 'DOSAGE AND ADMINISTRATION', approvedText: 'Take 1000mg once daily at least one hour before or two hours after food.', artworkText: 'Take 1000mg once daily with food.', page: 3, confidence: 0.94 },
      { severity: 'critical', section: 'CONTRAINDICATIONS', approvedText: 'Hypersensitivity to abiraterone acetate or any excipients. Women who are or may become pregnant.', artworkText: 'Hypersensitivity to abiraterone acetate or any excipients.', page: 5, confidence: 0.91 },
      { severity: 'major', section: 'WARNINGS AND PRECAUTIONS', approvedText: 'Monitor liver function tests every two weeks for first three months.', artworkText: 'Monitor liver function tests monthly.', page: 6, confidence: 0.88 },
      { severity: 'major', section: 'ACTIVE INGREDIENTS', approvedText: 'Each tablet contains 250mg abiraterone acetate (equivalent to 238mg abiraterone).', artworkText: 'Each tablet contains 250mg abiraterone acetate.', page: 1, confidence: 0.85 },
      { severity: 'minor', section: 'STORAGE CONDITIONS', approvedText: 'Store below 30 C. Keep in original package to protect from moisture.', artworkText: 'Store below 30 C in original package.', page: 12, confidence: 0.79 },
    ],
    summary: { critical: 2, major: 2, minor: 1 },
    sections: [
      { name: 'PRODUCT NAME', content: 'Zenora (Abiraterone Acetate) 250mg Film-Coated Tablets', pages: [1], confidence: 0.96 },
      { name: 'ACTIVE INGREDIENTS', content: 'Each tablet contains 250mg abiraterone acetate.', pages: [1], confidence: 0.85 },
      { name: 'DOSAGE AND ADMINISTRATION', content: 'Take 1000mg (four 250mg tablets) once daily with food.', pages: [3], confidence: 0.94 },
    ],
  },
  generate_aw: {
    title: 'Generate AW Draft',
    executionTime: '4.8s',
    market: 'Taiwan TFDA',
    sectionsProcessed: 12,
    diecutApplied: false,
    template: {
      sectionOrdering: '12 sections (TFDA)',
      fontFamily: 'Noto Sans TC',
      paperSize: '210mm x 297mm (A4)',
      regulatoryText: '\u672C\u85E5\u9808\u7531\u91AB\u5E2B\u8655\u65B9\u4F7F\u7528',
      emergencyContact: '+886-2-1234-5678',
    },
  },
};

/* ---------- Sub-renderers ---------- */

function CreateDraftResults({ data }) {
  const [tab, setTab] = useState('alignment');
  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Stat label="Documents Processed" value={data.documentsProcessed} />
        <Stat label="Sections Aligned" value={data.sectionAlignment.length} />
        <Stat label="Gaps Found" value={data.gaps.missing.length + data.gaps.incomplete.length} accent="text-orange-600" />
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-gray-200">
          {[
            { id: 'alignment', label: 'Section Alignment', count: data.sectionAlignment.length },
            { id: 'gaps', label: 'Gap Analysis', count: data.gaps.missing.length + data.gaps.incomplete.length },
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
                        {g.elements.map((el, j) => <li key={j}>{el}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
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
      {/* Classification */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Stat label="Total Sections" value={data.summary.totalSections} />
        <Stat label="Changed" value={data.summary.changed} accent="text-amber-600" />
        <Stat label="Added" value={data.summary.added} accent="text-sky-600" />
        <Stat label="Removed" value={data.summary.removed} accent="text-red-600" />
        <Stat label="Avg Significance" value={data.summary.avgSignificance} />
      </div>

      {/* Section Diffs */}
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
                  <td className="px-5 py-3">
                    <ChangeTypeBadge type={s.changeType} />
                  </td>
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
      {/* Summary counts */}
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

      {/* Tabs */}
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
                  <p className="text-xs text-gray-400 mt-2">Pages: {s.pages.join(', ')}</p>
                </div>
              ))}
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
      {/* Success banner */}
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

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Target Market" value={data.market} small />
        <Stat label="Sections Processed" value={data.sectionsProcessed} />
        <Stat label="Diecut Applied" value={data.diecutApplied ? 'Yes' : 'No'} small />
        <Stat label="Generation Time" value={data.executionTime} small />
      </div>

      {/* Template config */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">Applied Template Configuration</h3>
        <div className="space-y-3">
          {Object.entries(data.template).map(([key, val]) => (
            <div key={key} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-500">{key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase())}</span>
              <span className="text-sm font-medium text-gray-900">{val}</span>
            </div>
          ))}
        </div>
      </div>

      {/* PDF Preview placeholder */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
        <h3 className="text-base font-semibold text-gray-900 mb-4">PDF Preview</h3>
        <div className="bg-gray-50 rounded-lg border border-gray-100 p-8 flex flex-col items-center justify-center min-h-[280px]">
          <div className="w-36 h-48 bg-white rounded-lg shadow-lg border border-gray-200 flex items-center justify-center mb-4">
            <div className="text-center p-4">
              <p className="text-xs font-semibold text-gray-600 mb-1">Zenora 250mg</p>
              <p className="text-[10px] text-gray-400">Patient Information Leaflet</p>
              <div className="mt-3 space-y-1">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-0.5 bg-gray-200 rounded" style={{ width: `${50 + Math.random() * 50}%` }} />
                ))}
              </div>
            </div>
          </div>
          <p className="text-sm text-gray-500">AW-Draft-taiwan_tfda.pdf</p>
          <p className="text-xs text-gray-400 mt-0.5">Ready for InDesign refinement</p>
        </div>
      </div>
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

  if (!workflowType || !MOCK[workflowType]) {
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

  const data = MOCK[workflowType];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-navy-700">{data.title} — Results</h1>
          <p className="text-sm text-gray-500 mt-1">
            Completed in {data.executionTime}
          </p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-navy-700 hover:bg-navy-800 text-white rounded-lg text-sm font-medium transition-colors">
            Export PDF
          </button>
          <Link
            to="/workflows"
            className="px-4 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg text-sm font-medium transition-colors"
          >
            New Workflow
          </Link>
        </div>
      </div>

      {/* Conditional rendering based on workflow type */}
      {workflowType === 'create_draft' && <CreateDraftResults data={data} />}
      {workflowType === 'assess_variation' && <AssessVariationResults data={data} />}
      {workflowType === 'review_aw' && <ReviewAWResults data={data} />}
      {workflowType === 'generate_aw' && <GenerateAWResults data={data} />}
    </div>
  );
}
