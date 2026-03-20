import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ExtractionProgress from '../components/ExtractionProgress/ExtractionProgress';
import VerificationUI from '../components/VerificationUI/VerificationUI';

export default function Extraction() {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [selectedDocumentId, setSelectedDocumentId] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/documents', {
        headers: { 'X-Session-Id': sessionId }
      });
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
    }
  };

  const handleStartExtraction = () => {
    if (!selectedDocumentId) {
      setError('Please select a document');
      return;
    }
    setExtracting(true);
    setError(null);
    setExtractionResult(null);
  };

  const handleExtractionComplete = (result) => {
    setExtractionResult(result);
    setExtracting(false);
  };

  const handleExtractionError = (err) => {
    setError(err.message);
    setExtracting(false);
  };

  const selectedDocument = documents.find(d => d.id === selectedDocumentId);

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100 mb-2">
              Document Extraction
            </h1>
            <p className="text-zinc-400">
              Extract structured content from pharmaceutical documents
            </p>
          </div>
          <button
            onClick={() => navigate('/documents')}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm font-semibold transition-colors"
          >
            ← Back to Documents
          </button>
        </div>

        {/* Document selection */}
        {!extracting && !extractionResult && (
          <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-zinc-200 mb-4">
              Select Document to Extract
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Document
                </label>
                <select
                  value={selectedDocumentId}
                  onChange={(e) => setSelectedDocumentId(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-white/10 rounded-xl text-zinc-200 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="">Select a document...</option>
                  {documents.map(doc => (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({doc.type}) - {doc.pageCount} pages
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
                  <p className="text-sm text-rose-400">{error}</p>
                </div>
              )}

              <button
                onClick={handleStartExtraction}
                disabled={!selectedDocumentId}
                className="w-full px-6 py-3 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 disabled:from-zinc-700 disabled:to-zinc-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition-all"
              >
                Start Extraction
              </button>
            </div>
          </div>
        )}

        {/* Extraction progress */}
        {extracting && selectedDocument && (
          <ExtractionProgress
            documentId={selectedDocumentId}
            documentName={selectedDocument.name}
            totalPages={selectedDocument.pageCount}
            onComplete={handleExtractionComplete}
            onError={handleExtractionError}
          />
        )}

        {/* Verification UI */}
        {extractionResult && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-200">
                Extraction Results
              </h2>
              <button
                onClick={() => {
                  setExtractionResult(null);
                  setSelectedDocumentId('');
                }}
                className="px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                Extract Another Document
              </button>
            </div>
            
            <VerificationUI extractionResult={extractionResult} />
          </div>
        )}
      </div>
    </div>
  );
}