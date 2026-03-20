import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import DeviationReport from '../components/DeviationReport/DeviationReport';

export default function ReviewAW() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [awDraftId, setAwDraftId] = useState('');
  const [approvedPilId, setApprovedPilId] = useState('');
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

  const handleExecuteWorkflow = async () => {
    if (!awDraftId || !approvedPilId) {
      setError('Please select both AW Draft and Approved PIL documents');
      return;
    }

    setExecuting(true);
    setError(null);
    setProgress(0);
    setWorkflowResult(null);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/workflows/review-aw', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          awDraftId,
          approvedPilId
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

  const awDrafts = documents.filter(d => d.type === 'aw_draft');
  const approvedPils = documents.filter(d => d.type === 'approved_pil');

  const selectedAwDraft = documents.find(d => d.id === awDraftId);
  const selectedApprovedPil = documents.find(d => d.id === approvedPilId);

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
          <button
            onClick={() => navigate('/documents')}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            ← Back to Documents
          </button>
        </div>

        {/* Document Selection */}
        {!workflowResult && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
            <h2 className="text-xl font-bold text-white mb-4">Select Documents</h2>
            
            <div className="grid grid-cols-2 gap-6">
              {/* AW Draft Selection */}
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-3">
                  AW Draft PDF
                </label>
                <select
                  value={awDraftId}
                  onChange={(e) => setAwDraftId(e.target.value)}
                  disabled={executing}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select AW Draft...</option>
                  {awDrafts.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.productName})
                    </option>
                  ))}
                </select>
                {awDrafts.length === 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    No AW Draft documents uploaded
                  </p>
                )}
                {selectedAwDraft && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xs text-zinc-500 mb-1">Selected:</div>
                    <div className="text-sm text-white font-medium">{selectedAwDraft.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {selectedAwDraft.pageCount} pages • {(selectedAwDraft.fileSize / 1024).toFixed(0)} KB
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
                  value={approvedPilId}
                  onChange={(e) => setApprovedPilId(e.target.value)}
                  disabled={executing}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-violet-500/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="">Select Approved PIL...</option>
                  {approvedPils.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.productName})
                    </option>
                  ))}
                </select>
                {approvedPils.length === 0 && (
                  <p className="text-xs text-amber-400 mt-2">
                    No Approved PIL documents uploaded
                  </p>
                )}
                {selectedApprovedPil && (
                  <div className="mt-3 p-3 bg-white/5 rounded-xl border border-white/10">
                    <div className="text-xs text-zinc-500 mb-1">Selected:</div>
                    <div className="text-sm text-white font-medium">{selectedApprovedPil.name}</div>
                    <div className="text-xs text-zinc-400 mt-1">
                      {selectedApprovedPil.pageCount} pages • {(selectedApprovedPil.fileSize / 1024).toFixed(0)} KB
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Execute Button */}
            <div className="mt-6 flex justify-end">
              <button
                onClick={handleExecuteWorkflow}
                disabled={!awDraftId || !approvedPilId || executing}
                className="bg-violet-500 hover:bg-violet-600 active:bg-violet-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-semibold py-3 px-8 rounded-xl transition-colors"
              >
                {executing ? 'Analyzing Deviations...' : 'Start Review'}
              </button>
            </div>
          </div>
        )}

        {/* Progress Indicator */}
        {executing && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06]">
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

        {/* Error Display */}
        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6">
            <div className="flex items-start gap-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <div className="font-semibold text-rose-400 mb-1">Workflow Failed</div>
                <div className="text-sm text-rose-300">{error}</div>
                <button
                  onClick={() => setError(null)}
                  className="mt-3 text-sm text-rose-400 hover:text-rose-300 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Results */}
        {workflowResult && (
          <>
            <DeviationReport workflowResult={workflowResult} />
            
            <div className="flex justify-center">
              <button
                onClick={() => {
                  setWorkflowResult(null);
                  setAwDraftId('');
                  setApprovedPilId('');
                  setProgress(0);
                }}
                className="bg-zinc-700 hover:bg-zinc-600 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
              >
                Start New Review
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}