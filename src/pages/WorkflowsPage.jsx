import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const WORKFLOWS = [
  {
    id: 'create_draft',
    title: 'Create PIL Draft',
    description: 'Generate structured draft outline with section alignment and gap analysis',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    ),
    inputs: [
      { key: 'innovator_pil', label: 'Innovator PIL', required: true },
      { key: 'regulatory_source', label: 'Regulatory Source', required: true },
      { key: 'local_market_pil_format', label: 'Local Market PIL Format', required: true },
    ],
    steps: [
      'Aligns Innovator PIL sections to target market format',
      'Identifies missing sections and content gaps',
      'Generates translation checklist for CJK/Thai content',
      'Flags dosage tables and chemical formulas',
    ],
  },
  {
    id: 'assess_variation',
    title: 'Assess Variation',
    description: 'Classify PIL variation as complicated or general with section-by-section analysis',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
    ),
    inputs: [
      { key: 'approved_pil', label: 'Approved PIL', required: true },
      { key: 'change_trigger', label: 'Change Trigger Document', required: true, docTypes: ['updated_pil', 'regulatory_announcement'] },
    ],
    steps: [
      'Extracts content from both documents',
      'Compares section-by-section differences',
      'Classifies as COMPLICATED or GENERAL',
      'Generates significance scoring per section',
    ],
  },
  {
    id: 'review_aw',
    title: 'Review AW',
    description: 'Detect deviations between AW Draft and Approved PIL for regulatory compliance',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
    ),
    inputs: [
      { key: 'aw_draft', label: 'AW Draft PDF', required: true },
      { key: 'approved_pil', label: 'Approved PIL', required: true },
    ],
    steps: [
      'Extracts and aligns sections from both documents',
      'Detects text deviations with confidence scoring',
      'Classifies severity: critical, major, minor',
      'Generates deviation report with page references',
    ],
  },
  {
    id: 'generate_aw',
    title: 'Generate AW Draft',
    description: 'Generate formatted artwork PDF from Approved PIL using market-specific templates',
    icon: (
      <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
    ),
    inputs: [
      { key: 'approved_pil', label: 'Approved PIL', required: true },
      { key: 'target_market', label: 'Target Market', required: true, type: 'market' },
      { key: 'diecut_specification', label: 'Diecut Specification', required: false },
    ],
    steps: [
      'Extracts PIL content and applies market template',
      'Orders sections per regulatory requirements',
      'Applies fonts, regulatory disclaimers, emergency contacts',
      'Renders formatted artwork PDF',
    ],
  },
];

const MARKETS = [
  { code: 'taiwan_tfda', name: 'Taiwan TFDA' },
  { code: 'thailand_fda', name: 'Thailand FDA' },
];

export default function WorkflowsPage() {
  const [expandedId, setExpandedId] = useState(null);
  const [selections, setSelections] = useState({});
  const [allDocuments, setAllDocuments] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeError, setExecuteError] = useState(null);
  const navigate = useNavigate();

  // Fetch real documents from backend when a workflow card is expanded
  useEffect(() => {
    if (expandedId) {
      fetchDocuments();
    }
  }, [expandedId]);

  const fetchDocuments = async () => {
    try {
      setLoadingDocs(true);
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setAllDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setAllDocuments([]);
    } finally {
      setLoadingDocs(false);
    }
  };

  const getDocumentsForInput = (input) => {
    // If input specifies multiple docTypes (e.g. change_trigger), filter by those
    if (input.docTypes) {
      return allDocuments.filter(doc => input.docTypes.includes(doc.type));
    }
    // Otherwise filter by the input key as document type
    return allDocuments.filter(doc => doc.type === input.key);
  };

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
    if (expandedId !== id) {
      setSelections({});
    }
  };

  const handleSelect = (key, value) => {
    setSelections(prev => ({ ...prev, [key]: value }));
  };

  const handleStart = async (workflow) => {
    setExecuting(true);
    setExecuteError(null);

    try {
      // Map workflow ID to API endpoint and request body
      const endpointMap = {
        create_draft: {
          url: '/api/workflows/create-draft',
          body: {
            innovatorPilId: selections.innovator_pil,
            regulatorySourceId: selections.regulatory_source,
            marketFormatId: selections.local_market_pil_format,
          }
        },
        assess_variation: {
          url: '/api/workflows/assess-variation',
          body: {
            approvedPilId: selections.approved_pil,
            changeTriggerDocumentId: selections.change_trigger,
          }
        },
        review_aw: {
          url: '/api/workflows/review-aw',
          body: {
            awDraftId: selections.aw_draft,
            approvedPilId: selections.approved_pil,
          }
        },
        generate_aw: {
          url: '/api/workflows/generate-aw',
          body: {
            approvedPilId: selections.approved_pil,
            market: selections.target_market,
            diecutSpecificationId: selections.diecut_specification || null,
          }
        },
      };

      const endpoint = endpointMap[workflow.id];
      if (!endpoint) throw new Error(`Unknown workflow: ${workflow.id}`);

      const res = await fetch(endpoint.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endpoint.body),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || `Workflow failed (${res.status})`);
      }

      const result = await res.json();
      navigate('/results', { state: { workflowType: workflow.id, result } });

    } catch (err) {
      console.error('Workflow execution failed:', err);
      setExecuteError(err.message);
    } finally {
      setExecuting(false);
    }
  };

  const allRequiredSelected = (workflow) => {
    return workflow.inputs
      .filter(i => i.required)
      .every(i => selections[i.key]);
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-700">Workflows</h1>
        <p className="text-sm text-gray-500 mt-1">
          Select a workflow, choose your documents, and start processing
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {WORKFLOWS.map(wf => {
          const isExpanded = expandedId === wf.id;
          return (
            <div
              key={wf.id}
              className={`bg-white rounded-xl border transition-all ${
                isExpanded
                  ? 'border-navy-300 shadow-md md:col-span-2'
                  : 'border-gray-200 shadow-sm hover:border-navy-200 hover:shadow cursor-pointer'
              }`}
            >
              {/* Card Header */}
              <div
                className={`p-6 ${!isExpanded ? 'cursor-pointer' : ''}`}
                onClick={() => !isExpanded && handleToggle(wf.id)}
              >
                <div className="flex items-start gap-4">
                  <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isExpanded ? 'bg-navy-700 text-white' : 'bg-navy-50 text-navy-600'
                  }`}>
                    {wf.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-gray-900">{wf.title}</h3>
                      {isExpanded && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleToggle(wf.id); }}
                          className="text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-1">{wf.description}</p>
                    {!isExpanded && (
                      <div className="mt-3 flex items-center gap-1.5 text-xs text-navy-600 font-medium">
                        <span>{wf.inputs.filter(i => i.required).length} documents required</span>
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className="px-6 pb-6 border-t border-gray-100 pt-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Document Selectors */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-semibold text-gray-700">Select Documents</h4>

                      {loadingDocs && (
                        <p className="text-xs text-gray-400">Loading documents...</p>
                      )}

                      {wf.inputs.map((input, idx) => {
                        const docs = input.type === 'market' ? null : getDocumentsForInput(input);
                        const isEmpty = docs !== null && docs.length === 0;

                        return (
                          <div key={input.key}>
                            <label className="block text-sm font-medium text-gray-600 mb-1.5">
                              {idx + 1}. {input.label}
                              {input.required && <span className="text-red-500 ml-0.5">*</span>}
                              {!input.required && <span className="text-gray-400 ml-1 text-xs">(Optional)</span>}
                            </label>
                            {input.type === 'market' ? (
                              <select
                                value={selections[input.key] || ''}
                                onChange={(e) => handleSelect(input.key, e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
                              >
                                <option value="">Select target market...</option>
                                {MARKETS.map(m => (
                                  <option key={m.code} value={m.code}>{m.name}</option>
                                ))}
                              </select>
                            ) : isEmpty ? (
                              <div className="w-full border border-amber-200 bg-amber-50 rounded-lg py-2.5 px-3 text-sm text-amber-700">
                                No documents available — upload documents first
                              </div>
                            ) : (
                              <select
                                value={selections[input.key] || ''}
                                onChange={(e) => handleSelect(input.key, e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
                              >
                                <option value="">Select {input.label.toLowerCase()}...</option>
                                {(docs || []).map(doc => (
                                  <option key={doc.id} value={doc.id}>
                                    {doc.name}{doc.productName ? ` (${doc.productName})` : ''}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        );
                      })}

                      {executeError && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                          {executeError}
                        </div>
                      )}

                      <button
                        onClick={() => handleStart(wf)}
                        disabled={!allRequiredSelected(wf) || executing}
                        className="w-full mt-2 py-2.5 px-4 bg-lotus-500 hover:bg-lotus-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                      >
                        {executing ? (
                          <>
                            <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" /><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" /></svg>
                            Processing...
                          </>
                        ) : (
                          'Start Workflow'
                        )}
                      </button>
                    </div>

                    {/* Workflow Info */}
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">What this workflow does</h4>
                      <div className="bg-gray-50 rounded-lg border border-gray-100 p-4">
                        <ul className="space-y-2">
                          {wf.steps.map((step, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                              <span className="w-5 h-5 rounded-full bg-navy-100 text-navy-700 flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              {step}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
