import { useState, useEffect } from 'react';

export default function WorkflowSelector({ onWorkflowStart, onCancel }) {
  const [documents, setDocuments] = useState([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState('create_draft');
  const [innovatorPilId, setInnovatorPilId] = useState('');
  const [regulatorySourceId, setRegulatorySourceId] = useState('');
  const [localMarketFormatId, setLocalMarketFormatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
      
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents', err);
      setError('Failed to load documents. Please refresh the page.');
    }
  };

  const handleStartWorkflow = async () => {
    setError(null);
    
    // Validate document selection
    if (!innovatorPilId || !regulatorySourceId || !localMarketFormatId) {
      setError('Please select all three required documents');
      return;
    }
    
    setLoading(true);
    
    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/workflows/create-draft', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          innovatorPilId,
          regulatorySourceId,
          localMarketFormatId
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Workflow execution failed');
      }
      
      const result = await response.json();
      onWorkflowStart(result);
      
    } catch (err) {
      console.error('Workflow execution failed', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getDocumentsByType = (type) => {
    return documents.filter(doc => doc.type === type);
  };

  const innovatorDocs = getDocumentsByType('innovator_pil');
  const regulatoryDocs = getDocumentsByType('regulatory_source');
  const marketFormatDocs = getDocumentsByType('local_market_pil_format');

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Create PIL Draft Workflow
          </h2>
          <p className="text-gray-600">
            Generate structured draft outline with section alignment, gap analysis, and translation checklist
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <p className="font-semibold text-red-900">Workflow Error</p>
                <p className="text-sm text-red-700 mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Innovator PIL Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              1. Innovator PIL
              <span className="ml-2 text-red-500">*</span>
            </label>
            <select
              value={innovatorPilId}
              onChange={(e) => setInnovatorPilId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
              disabled={loading}
            >
              <option value="">Select Innovator PIL document...</option>
              {innovatorDocs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.productName})
                </option>
              ))}
            </select>
            {innovatorDocs.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠️ No Innovator PIL documents uploaded. Please upload one first.
              </p>
            )}
          </div>

          {/* Regulatory Source Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              2. Regulatory Source
              <span className="ml-2 text-red-500">*</span>
            </label>
            <select
              value={regulatorySourceId}
              onChange={(e) => setRegulatorySourceId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
              disabled={loading}
            >
              <option value="">Select Regulatory Source document...</option>
              {regulatoryDocs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.productName})
                </option>
              ))}
            </select>
            {regulatoryDocs.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠️ No Regulatory Source documents uploaded. Please upload one first.
              </p>
            )}
          </div>

          {/* Local Market PIL Format Selection */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              3. Local Market PIL Format
              <span className="ml-2 text-red-500">*</span>
            </label>
            <select
              value={localMarketFormatId}
              onChange={(e) => setLocalMarketFormatId(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-violet-500 focus:border-violet-500 bg-white"
              disabled={loading}
            >
              <option value="">Select Local Market PIL Format document...</option>
              {marketFormatDocs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.productName})
                </option>
              ))}
            </select>
            {marketFormatDocs.length === 0 && (
              <p className="mt-2 text-sm text-amber-600">
                ⚠️ No Local Market PIL Format documents uploaded. Please upload one first.
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex gap-4">
          <button
            onClick={handleStartWorkflow}
            disabled={loading || !innovatorPilId || !regulatorySourceId || !localMarketFormatId}
            className="flex-1 px-6 py-3 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-700 active:bg-violet-800 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                Processing Workflow...
              </span>
            ) : (
              'Start Workflow'
            )}
          </button>
          
          <button
            onClick={onCancel}
            disabled={loading}
            className="px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 active:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Cancel
          </button>
        </div>

        {/* Workflow Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <span className="text-xl">ℹ️</span>
            <div className="text-sm text-blue-900">
              <p className="font-semibold mb-1">What this workflow does:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>Aligns Innovator PIL sections to target market format</li>
                <li>Identifies missing sections and content gaps</li>
                <li>Generates translation checklist for CJK/Thai content</li>
                <li>Flags dosage tables and chemical formulas for special attention</li>
              </ul>
              <p className="mt-2 text-xs text-blue-700">
                Estimated processing time: 60-90 seconds for typical 15-20 page documents
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}