import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import VariationResults from '../components/VariationResults/VariationResults';

export default function AssessVariation() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [approvedPilId, setApprovedPilId] = useState('');
  const [changeTriggerDocumentId, setChangeTriggerDocumentId] = useState('');
  const [executing, setExecuting] = useState(false);
  const [workflowResult, setWorkflowResult] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/documents', {
        headers: {
          'x-session-id': sessionId
        }
      });
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleStartWorkflow = async () => {
    if (!approvedPilId || !changeTriggerDocumentId) {
      setError('Please select both documents');
      return;
    }

    if (approvedPilId === changeTriggerDocumentId) {
      setError('Please select different documents');
      return;
    }

    setExecuting(true);
    setError(null);
    setProgress(0);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 1000);

    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/assessVariation/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          approvedPilId,
          changeTriggerDocumentId
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Workflow execution failed');
      }

      const result = await response.json();
      setWorkflowResult(result);

    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      console.error('Workflow execution failed:', err);
    } finally {
      setExecuting(false);
    }
  };

  const handleReset = () => {
    setWorkflowResult(null);
    setApprovedPilId('');
    setChangeTriggerDocumentId('');
    setError(null);
    setProgress(0);
  };

  const approvedPilDocuments = documents.filter(d => d.type === 'approved_pil');
  const changeTriggerDocuments = documents.filter(d => 
    ['updated_pil', 'regulatory_announcement', 'regulatory_source'].includes(d.type)
  );

  const selectedApprovedPil = documents.find(d => d.id === approvedPilId);
  const selectedChangeTrigger = documents.find(d => d.id === changeTriggerDocumentId);

  if (workflowResult) {
    return (
      <div className="min-h-screen bg-zinc-950 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white mb-2">Assess Variation Results</h1>
              <p className="text-sm text-zinc-400">
                Workflow completed in {(workflowResult.executionTimeMs / 1000).toFixed(1)}s
              </p>
            </div>
            <button
              onClick={handleReset}
              className="px-4 py-2 bg-zinc-800 text-white rounded-xl font-medium hover:bg-zinc-700 transition-colors border border-white/10"
            >
              ← New Assessment
            </button>
          </div>

          <VariationResults workflowResult={workflowResult} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white mb-2">Assess Variation</h1>
          <p className="text-sm text-zinc-400">
            Classify PIL variation as complicated or general with section-by-section analysis
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-rose-400 text-xl">⚠️</span>
              <div>
                <h3 className="text-sm font-semibold text-rose-400 mb-1">Error</h3>
                <p className="text-sm text-rose-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Document Selection */}
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-lg font-bold text-white mb-4">Select Documents</h2>

            <div className="space-y-4">
              {/* Approved PIL Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  1. Approved PIL
                </label>
                <select
                  value={approvedPilId}
                  onChange={(e) => setApprovedPilId(e.target.value)}
                  disabled={executing}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select approved PIL document...</option>
                  {approvedPilDocuments.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.productName})
                    </option>
                  ))}
                </select>
                {approvedPilDocuments.length === 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    No approved PIL documents available. Please upload one first.
                  </p>
                )}
              </div>

              {/* Change Trigger Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  2. Change Trigger Document
                </label>
                <select
                  value={changeTriggerDocumentId}
                  onChange={(e) => setChangeTriggerDocumentId(e.target.value)}
                  disabled={executing}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">Select change trigger document...</option>
                  {changeTriggerDocuments.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.type.replace(/_/g, ' ')})
                    </option>
                  ))}
                </select>
                {changeTriggerDocuments.length === 0 && (
                  <p className="mt-2 text-xs text-zinc-500">
                    No change trigger documents available. Upload an updated PIL, regulatory announcement, or regulatory source.
                  </p>
                )}
              </div>
            </div>

            {/* Selected Documents Summary */}
            {(selectedApprovedPil || selectedChangeTrigger) && (
              <div className="mt-6 p-4 bg-zinc-900/50 rounded-xl border border-white/[0.04]">
                <h3 className="text-sm font-semibold text-zinc-300 mb-3">Selected Documents</h3>
                <div className="space-y-2">
                  {selectedApprovedPil && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-zinc-500">Approved PIL:</span>
                      <span className="text-white font-medium">{selectedApprovedPil.name}</span>
                      <span className="text-zinc-400">({selectedApprovedPil.pageCount} pages)</span>
                    </div>
                  )}
                  {selectedChangeTrigger && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-zinc-500">Change Trigger:</span>
                      <span className="text-white font-medium">{selectedChangeTrigger.name}</span>
                      <span className="text-zinc-400">({selectedChangeTrigger.pageCount} pages)</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Workflow Execution */}
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-lg font-bold text-white mb-4">Execute Workflow</h2>

            {executing ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-violet-500 border-t-transparent"></div>
                  <span className="text-sm text-zinc-300">
                    Analyzing variation... {progress}%
                  </span>
                </div>

                <div className="w-full bg-zinc-900 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-violet-500 to-cyan-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>

                <div className="text-xs text-zinc-500 space-y-1">
                  <p>• Extracting approved PIL content...</p>
                  <p>• Extracting change trigger content...</p>
                  <p>• Classifying variation type...</p>
                  <p>• Generating section-by-section diff...</p>
                  <p>• Calculating significance scores...</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-zinc-400">
                  This workflow will classify the variation as <span className="text-rose-400 font-semibold">COMPLICATED</span> (requires new Draft PIL) 
                  or <span className="text-emerald-400 font-semibold">GENERAL</span> (proceeds direct to AW) based on the magnitude and type of changes detected.
                </p>

                <button
                  onClick={handleStartWorkflow}
                  disabled={!approvedPilId || !changeTriggerDocumentId}
                  className="w-full py-3 px-4 bg-gradient-to-r from-violet-500 to-cyan-500 text-white rounded-xl font-semibold hover:from-violet-600 hover:to-cyan-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-violet-500 disabled:hover:to-cyan-500"
                >
                  Start Assessment
                </button>
              </div>
            )}
          </div>

          {/* Info Panel */}
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
                  <li>Drug interaction changes</li>
                </ul>
              </div>
              <div>
                <h4 className="text-emerald-400 font-semibold mb-2">GENERAL Variations</h4>
                <ul className="space-y-1 list-disc list-inside">
                  <li>Wording improvements</li>
                  <li>Contact information updates</li>
                  <li>Formatting changes</li>
                  <li>Spelling/grammar corrections</li>
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