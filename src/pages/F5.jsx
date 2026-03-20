import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function F5Preview()
export default function F5Preview() {
  const [approvedPilId, setApprovedPilId] = React.useState('');
  const [changeTriggerDocumentId, setChangeTriggerDocumentId] = React.useState('');
  const [executing, setExecuting] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [selectedSection, setSelectedSection] = React.useState(null);
  const [filterChangeType, setFilterChangeType] = React.useState('all');
  const [progress, setProgress] = React.useState(0);

  const documents = [
    { id: '1', name: 'Zenora_Approved_PIL_TW.pdf', type: 'approved_pil', productName: 'Zenora (Abiraterone Acetate) 250mg', pageCount: 8 },
    { id: '2', name: 'Zenora_Updated_PIL_2024.pdf', type: 'updated_pil', productName: 'Zenora (Abiraterone Acetate) 250mg', pageCount: 9 },
    { id: '3', name: 'TFDA_Safety_Update_Jan2024.pdf', type: 'regulatory_announcement', productName: 'Zenora (Abiraterone Acetate) 250mg', pageCount: 3 },
    { id: '4', name: 'Lenalidomide_Approved_PIL.pdf', type: 'approved_pil', productName: 'Lenalidomide 25mg', pageCount: 12 }
  ];

  const mockResult = {
    classification: 'complicated',
    confidenceScore: 0.87,
    justification: 'Classified as COMPLICATED: 42.9% of sections changed (6/14), including 2 critical section(s). Significant modifications detected in DOSAGE AND ADMINISTRATION and WARNINGS AND PRECAUTIONS sections, with new contraindication added for hepatic impairment patients.',
    keyChanges: [
      'DOSAGE AND ADMINISTRATION: Modified dosing schedule for hepatic impairment patients (+340 chars)',
      'WARNINGS AND PRECAUTIONS: Added new warning for hepatotoxicity monitoring requirements (+520 chars)',
      'CONTRAINDICATIONS: New contraindication added for severe hepatic impairment',
      'ADVERSE REACTIONS: Updated frequency data from post-marketing surveillance (+180 chars)',
      'DRUG INTERACTIONS: Added interaction with strong CYP3A4 inhibitors (+210 chars)'
    ],
    criticalSections: ['DOSAGE AND ADMINISTRATION', 'CONTRAINDICATIONS'],
    summary: {
      totalSections: 14,
      sectionsChanged: 6,
      sectionsAdded: 1,
      sectionsRemoved: 0,
      sectionsModified: 5,
      averageSignificance: 68
    },
    sectionDiffs: [
      {
        sectionName: 'DOSAGE AND ADMINISTRATION',
        changeType: 'modified',
        significanceScore: 95,
        changeSummary: 'Modified dosing schedule for hepatic impairment patients, added dose reduction guidelines',
        approvedText: 'The recommended dose is 1,000 mg (four 250 mg tablets) administered orally once daily in combination with prednisone 5 mg administered orally twice daily...',
        updatedText: 'The recommended dose is 1,000 mg (four 250 mg tablets) administered orally once daily in combination with prednisone 5 mg administered orally twice daily. For patients with hepatic impairment (Child-Pugh Class B), reduce dose to 750 mg once daily...'
      },
      {
        sectionName: 'CONTRAINDICATIONS',
        changeType: 'modified',
        significanceScore: 92,
        changeSummary: 'New contraindication added for severe hepatic impairment',
        approvedText: 'Abiraterone is contraindicated in: Women who are or may become pregnant. Patients with known hypersensitivity to abiraterone acetate or any component of the product...',
        updatedText: 'Abiraterone is contraindicated in: Women who are or may become pregnant. Patients with known hypersensitivity to abiraterone acetate or any component of the product. Patients with severe hepatic impairment (Child-Pugh Class C)...'
      },
      {
        sectionName: 'WARNINGS AND PRECAUTIONS',
        changeType: 'modified',
        significanceScore: 88,
        changeSummary: 'Added hepatotoxicity monitoring requirements and risk mitigation strategies',
        approvedText: 'Hypertension, hypokalemia, and fluid retention: Monitor blood pressure, serum potassium, and for signs and symptoms of fluid retention at least monthly...',
        updatedText: 'Hepatotoxicity: Monitor liver function tests (ALT, AST, bilirubin) at baseline, every 2 weeks for first 3 months, then monthly. Discontinue if ALT or AST >5x ULN or bilirubin >3x ULN. Hypertension, hypokalemia, and fluid retention: Monitor blood pressure, serum potassium...'
      },
      {
        sectionName: 'DRUG INTERACTIONS',
        changeType: 'modified',
        significanceScore: 75,
        changeSummary: 'Added interaction with strong CYP3A4 inhibitors requiring dose adjustment',
        approvedText: 'Abiraterone is a substrate of CYP3A4. Avoid concomitant use with strong CYP3A4 inducers...',
        updatedText: 'Abiraterone is a substrate of CYP3A4. Avoid concomitant use with strong CYP3A4 inducers. When co-administered with strong CYP3A4 inhibitors (e.g., ketoconazole, clarithromycin), reduce abiraterone dose to 500 mg once daily...'
      },
      {
        sectionName: 'ADVERSE REACTIONS',
        changeType: 'modified',
        significanceScore: 65,
        changeSummary: 'Updated frequency data from post-marketing surveillance studies',
        approvedText: 'Most common adverse reactions (≥10%): fatigue, joint swelling or discomfort, edema, hot flush, diarrhea, vomiting, cough, hypertension, dyspnea, urinary tract infection...',
        updatedText: 'Most common adverse reactions (≥10%): fatigue (39%), joint swelling or discomfort (30%), edema (27%), hot flush (19%), diarrhea (18%), vomiting (15%), cough (11%), hypertension (22%), dyspnea (12%), urinary tract infection (12%), hepatotoxicity (8%)...'
      },
      {
        sectionName: 'SPECIAL POPULATIONS',
        changeType: 'added',
        significanceScore: 70,
        changeSummary: 'New section added for hepatic impairment population',
        approvedText: '',
        updatedText: 'Hepatic Impairment: Patients with baseline moderate hepatic impairment (Child-Pugh Class B) had higher systemic exposure. Dose reduction to 750 mg once daily is recommended. Abiraterone is contraindicated in patients with severe hepatic impairment...'
      },
      {
        sectionName: 'PRODUCT NAME',
        changeType: 'unchanged',
        significanceScore: 0,
        changeSummary: 'No changes detected',
        approvedText: 'ZENORA (Abiraterone Acetate) 250 mg Tablets',
        updatedText: 'ZENORA (Abiraterone Acetate) 250 mg Tablets'
      },
      {
        sectionName: 'ACTIVE INGREDIENTS',
        changeType: 'unchanged',
        significanceScore: 0,
        changeSummary: 'No changes detected',
        approvedText: 'Each tablet contains 250 mg of abiraterone acetate',
        updatedText: 'Each tablet contains 250 mg of abiraterone acetate'
      },
      {
        sectionName: 'INDICATIONS',
        changeType: 'unchanged',
        significanceScore: 5,
        changeSummary: 'Minor formatting adjustment',
        approvedText: 'ZENORA is indicated in combination with prednisone for the treatment of patients with metastatic castration-resistant prostate cancer',
        updatedText: 'ZENORA is indicated in combination with prednisone for the treatment of patients with metastatic castration-resistant prostate cancer.'
      },
      {
        sectionName: 'STORAGE',
        changeType: 'unchanged',
        significanceScore: 0,
        changeSummary: 'No changes detected',
        approvedText: 'Store at 20°C to 25°C (68°F to 77°F). Keep tablets in original container.',
        updatedText: 'Store at 20°C to 25°C (68°F to 77°F). Keep tablets in original container.'
      }
    ]
  };

  const handleStartWorkflow = () => {
    setExecuting(true);
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setExecuting(false);
            setShowResults(true);
          }, 300);
          return 100;
        }
        return prev + 12;
      });
    }, 400);
  };

  const handleReset = () => {
    setShowResults(false);
    setApprovedPilId('');
    setChangeTriggerDocumentId('');
    setSelectedSection(null);
    setProgress(0);
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

  const approvedPilDocs = documents.filter(d => d.type === 'approved_pil');
  const changeTriggerDocs = documents.filter(d => ['updated_pil', 'regulatory_announcement', 'regulatory_source'].includes(d.type));

  const filteredSections = filterChangeType === 'all' 
    ? mockResult.sectionDiffs 
    : mockResult.sectionDiffs.filter(s => s.changeType === filterChangeType);

  const sortedSections = [...filteredSections].sort((a, b) => b.significanceScore - a.significanceScore);

  if (showResults) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Assess Variation Results</h1>
              <p className="text-sm text-zinc-400">Workflow completed in 6.8s</p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors border border-white/10"
            >
              ← New Assessment
            </button>
          </div>

          <div className="space-y-6">
            {/* Classification Result */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white mb-2">Variation Classification</h2>
                  <p className="text-sm text-zinc-400">
                    Confidence: <span className="text-white font-semibold">{(mockResult.confidenceScore * 100).toFixed(0)}%</span>
                  </p>
                </div>
                {getClassificationBadge(mockResult.classification)}
              </div>

              <div className="bg-zinc-900/50 rounded-xl p-4 border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Justification</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{mockResult.justification}</p>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold text-zinc-300 mb-2">Key Changes Detected</h3>
                <ul className="space-y-2">
                  {mockResult.keyChanges.map((change, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-zinc-400">
                      <span className="text-violet-400 mt-0.5">•</span>
                      <span>{change}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4 p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <h3 className="text-sm font-semibold text-rose-400 mb-2">⚠️ Critical Sections Modified</h3>
                <div className="flex flex-wrap gap-2">
                  {mockResult.criticalSections.map((section, index) => (
                    <span key={index} className="px-2 py-1 bg-rose-500/20 text-rose-300 text-xs rounded-md border border-rose-500/30">
                      {section}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-2xl font-bold text-white">{mockResult.summary.totalSections}</div>
                <div className="text-xs text-zinc-400 mt-1">Total Sections</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-2xl font-bold text-amber-400">{mockResult.summary.sectionsChanged}</div>
                <div className="text-xs text-zinc-400 mt-1">Changed</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-2xl font-bold text-cyan-400">{mockResult.summary.sectionsAdded}</div>
                <div className="text-xs text-zinc-400 mt-1">Added</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-2xl font-bold text-rose-400">{mockResult.summary.sectionsRemoved}</div>
                <div className="text-xs text-zinc-400 mt-1">Removed</div>
              </div>
              <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.06]">
                <div className="text-2xl font-bold text-violet-400">{mockResult.summary.averageSignificance}</div>
                <div className="text-xs text-zinc-400 mt-1">Avg Significance</div>
              </div>
            </div>

            {/* Section Diff Table */}
            <div className="bg-zinc-800/50 rounded-2xl border border-white/[0.06] shadow-lg shadow-black/20 overflow-hidden">
              <div className="p-6 border-b border-white/[0.06]">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Section-by-Section Analysis</h2>
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
                </div>
                <p className="text-sm text-zinc-400">
                  Showing {sortedSections.length} sections
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-zinc-900/50 border-b border-white/[0.06]">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">Section Name</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">Change Type</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">Significance</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">Summary</th>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-zinc-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/[0.04]">
                    {sortedSections.slice(0, 6).map((section, index) => (
                      <tr key={index} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-white">{section.sectionName}</div>
                        </td>
                        <td className="px-6 py-4">{getChangeTypeBadge(section.changeType)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className={`text-lg font-bold ${getSignificanceColor(section.significanceScore)}`}>
                              {section.significanceScore}
                            </div>
                            <div className="text-xs text-zinc-500">{getSignificanceLabel(section.significanceScore)}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-zinc-400 max-w-md truncate">{section.changeSummary}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setSelectedSection(selectedSection === index ? null : index)}
                            className="text-sm text-violet-400 hover:text-violet-300 font-medium"
                          >
                            {selectedSection === index ? 'Hide' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Section Detail Modal */}
          {selectedSection !== null && sortedSections[selectedSection] && (
            <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
              <div className="bg-zinc-900 rounded-2xl border border-white/10 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
                <div className="p-6 border-b border-white/[0.06] flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-bold text-white mb-1">{sortedSections[selectedSection].sectionName}</h3>
                    <div className="flex items-center gap-3">
                      {getChangeTypeBadge(sortedSections[selectedSection].changeType)}
                      <span className={`text-sm font-semibold ${getSignificanceColor(sortedSections[selectedSection].significanceScore)}`}>
                        Significance: {sortedSections[selectedSection].significanceScore} ({getSignificanceLabel(sortedSections[selectedSection].significanceScore)})
                      </span>
                    </div>
                  </div>
                  <button onClick={() => setSelectedSection(null)} className="text-zinc-400 hover:text-white text-2xl">×</button>
                </div>
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                  <div className="mb-4 p-3 bg-zinc-800/50 rounded-lg border border-white/[0.04]">
                    <h4 className="text-sm font-semibold text-zinc-300 mb-2">Change Summary</h4>
                    <p className="text-sm text-zinc-400">{sortedSections[selectedSection].changeSummary}</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.04]">
                      <h4 className="text-sm font-semibold text-zinc-300 mb-3">Approved PIL Text</h4>
                      <div className="text-sm text-zinc-400 leading-relaxed">
                        {sortedSections[selectedSection].approvedText || <span className="text-zinc-600 italic">No content (section added)</span>}
                      </div>
                    </div>
                    <div className="bg-zinc-800/50 rounded-xl p-4 border border-white/[0.04]">
                      <h4 className="text-sm font-semibold text-zinc-300 mb-3">Updated PIL Text</h4>
                      <div className="text-sm text-zinc-400 leading-relaxed">
                        {sortedSections[selectedSection].updatedText || <span className="text-zinc-600 italic">No content (section removed)</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Assess Variation</h1>
          <p className="text-sm text-zinc-400">Classify PIL variation as complicated or general with section-by-section analysis</p>
        </div>

        <div className="space-y-6">
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-lg font-bold text-white mb-4">Select Documents</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">1. Approved PIL</label>
                <select
                  value={approvedPilId}
                  onChange={(e) => setApprovedPilId(e.target.value)}
                  disabled={executing}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select approved PIL document...</option>
                  {approvedPilDocs.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name} ({doc.productName})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">2. Change Trigger Document</label>
                <select
                  value={changeTriggerDocumentId}
                  onChange={(e) => setChangeTriggerDocumentId(e.target.value)}
                  disabled={executing}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select change trigger document...</option>
                  {changeTriggerDocs.map(doc => (
                    <option key={doc.id} value={doc.id}>{doc.name} ({doc.type.replace(/_/g, ' ')})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-lg font-bold text-white mb-4">Execute Workflow</h2>
            {executing ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-500 border-t-transparent"></div>
                  <span className="text-sm text-zinc-300">Analyzing variation... {progress}%</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500" style={{ width: `${progress}%` }} />
                </div>
                <div className="text-xs text-zinc-500 space-y-1">
                  <p>• Extracting approved PIL content...</p>
                  <p>• Extracting change trigger content...</p>
                  <p>• Classifying variation type...</p>
                  <p>• Generating section-by-section diff...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  This workflow will classify the variation as <span className="text-rose-400 font-semibold">COMPLICATED</span> or <span className="text-emerald-400 font-semibold">GENERAL</span> based on detected changes.
                </p>
                <button
                  onClick={handleStartWorkflow}
                  disabled={!approvedPilId || !changeTriggerDocumentId}
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Start Assessment
                </button>
              </div>
            )}
          </div>

          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
            <h3 className="text-sm font-semibold text-zinc-300 mb-3">ℹ️ Classification Criteria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-zinc-400">
              <div>
                <h4 className="text-rose-400 font-semibold mb-2">COMPLICATED Variations</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Dosage or administration changes</li>
                  <li>New/modified indications</li>
                  <li>New contraindications or warnings</li>
                  <li>Safety information updates</li>
                </ul>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-2">GENERAL Variations</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Wording improvements</li>
                  <li>Contact information updates</li>
                  <li>Formatting changes</li>
                  <li>Minor clarifications</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}