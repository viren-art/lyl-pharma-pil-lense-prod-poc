import { useState, useEffect } from 'react';

export default function AWGenerator({ onComplete, onError }) {
  const [documents, setDocuments] = useState([]);
  const [approvedPilId, setApprovedPilId] = useState('');
  const [market, setMarket] = useState('taiwan_tfda');
  const [diecutSpecificationId, setDiecutSpecificationId] = useState('');
  const [markets, setMarkets] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocuments();
    fetchMarkets();
  }, []);

  const fetchDocuments = async () => {
    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/documents', {
        headers: { 'x-session-id': sessionId }
      });
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const fetchMarkets = async () => {
    try {
      const response = await fetch('/api/generateAW/markets');
      const data = await response.json();
      setMarkets(data.markets || []);
    } catch (err) {
      console.error('Failed to fetch markets:', err);
      // Fallback to hardcoded markets
      setMarkets([
        { code: 'taiwan_tfda', name: 'Taiwan TFDA', description: 'Taiwan Food and Drug Administration format' },
        { code: 'thailand_fda', name: 'Thailand FDA', description: 'Thailand Food and Drug Administration format' }
      ]);
    }
  };

  const handleGenerate = async () => {
    if (!approvedPilId || !market) {
      setError('Please select an Approved PIL and target market');
      return;
    }

    setGenerating(true);
    setProgress(0);
    setError(null);
    setResult(null);

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 10, 90));
    }, 500);

    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/generateAW/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-id': sessionId
        },
        body: JSON.stringify({
          approvedPilId,
          market,
          diecutSpecificationId: diecutSpecificationId || undefined
        })
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Workflow execution failed');
      }

      const data = await response.json();
      setResult(data);
      
      if (onComplete) {
        onComplete(data);
      }
    } catch (err) {
      clearInterval(progressInterval);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    if (!result || !result.pdfBase64) return;

    // Convert base64 to blob
    const byteCharacters = atob(result.pdfBase64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'application/pdf' });

    // Create download link
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AW-Draft-${result.market}-${new Date().toISOString().split('T')[0]}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const approvedPils = documents.filter(d => d.type === 'approved_pil');
  const diecutSpecs = documents.filter(d => d.type === 'diecut_specification');

  const selectedMarket = markets.find(m => m.code === market);

  return (
    <div className="space-y-6">
      {/* Document Selection */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Select Documents</h2>
        
        <div className="space-y-4">
          {/* Approved PIL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Approved PIL <span className="text-red-500">*</span>
            </label>
            <select
              value={approvedPilId}
              onChange={(e) => setApprovedPilId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={generating}
            >
              <option value="">Select Approved PIL...</option>
              {approvedPils.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name} ({doc.productName})
                </option>
              ))}
            </select>
          </div>

          {/* Target Market */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Target Market <span className="text-red-500">*</span>
            </label>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={generating}
            >
              {markets.map(m => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
            {selectedMarket && (
              <p className="mt-1 text-sm text-gray-500">{selectedMarket.description}</p>
            )}
          </div>

          {/* Diecut Specification (Optional) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Diecut Specification (Optional)
            </label>
            <select
              value={diecutSpecificationId}
              onChange={(e) => setDiecutSpecificationId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={generating}
            >
              <option value="">None (use standard dimensions)</option>
              {diecutSpecs.map(doc => (
                <option key={doc.id} value={doc.id}>
                  {doc.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              Upload a Diecut Specification document to apply custom paper dimensions
            </p>
          </div>
        </div>

        {/* Generate Button */}
        <div className="mt-6">
          <button
            onClick={handleGenerate}
            disabled={generating || !approvedPilId || !market}
            className="w-full bg-violet-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-violet-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {generating ? 'Generating AW Draft...' : 'Generate AW Draft'}
          </button>
        </div>
      </div>

      {/* Progress */}
      {generating && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Generating Artwork PDF</h3>
          <div className="space-y-3">
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-violet-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 text-center">{progress}% complete</p>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <span className="text-2xl mr-3">⚠️</span>
            <div>
              <h3 className="text-sm font-semibold text-red-800">Generation Failed</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">AW Draft Generated</h3>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              ✅ Complete
            </span>
          </div>

          <div className="space-y-3 mb-6">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Market:</span>
              <span className="font-medium text-gray-900">
                {markets.find(m => m.code === result.market)?.name || result.market}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Sections Processed:</span>
              <span className="font-medium text-gray-900">{result.sectionsProcessed}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Diecut Applied:</span>
              <span className="font-medium text-gray-900">{result.diecutApplied ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Generation Time:</span>
              <span className="font-medium text-gray-900">
                {(result.generationTimeMs / 1000).toFixed(1)}s
              </span>
            </div>
          </div>

          {/* PDF Preview */}
          <div className="border border-gray-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-center h-64 bg-gray-50 rounded">
              <div className="text-center">
                <span className="text-6xl">📄</span>
                <p className="mt-2 text-sm text-gray-600">PDF Generated Successfully</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ready for refinement in InDesign
                </p>
              </div>
            </div>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownloadPdf}
            className="w-full bg-violet-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-violet-700 transition-colors"
          >
            📥 Download AW Draft PDF
          </button>

          {/* Info */}
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              💡 This PDF is suitable for refinement in InDesign. It contains all sections from the Approved PIL
              formatted according to {markets.find(m => m.code === result.market)?.name} requirements.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}