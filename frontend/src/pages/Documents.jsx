import { useState, useEffect } from 'react';
import DocumentUpload from '../components/DocumentUpload/DocumentUpload';
import DocumentLibrary from '../components/DocumentLibrary/DocumentLibrary';

export default function Documents() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Generate session ID on mount
  const [sessionId] = useState(() => {
    const stored = sessionStorage.getItem('pil-lens-session-id');
    if (stored) return stored;
    const newId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    sessionStorage.setItem('pil-lens-session-id', newId);
    return newId;
  });

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/documents', {
        headers: {
          'X-Session-Id': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }

      const data = await response.json();
      setDocuments(data.documents);
      setError(null);
    } catch (err) {
      console.error('Error fetching documents:', err);
      setError('Failed to load documents. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadSuccess = (newDocument) => {
    setDocuments(prev => [newDocument, ...prev]);
  };

  const handleDelete = async (documentId) => {
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
        headers: {
          'X-Session-Id': sessionId
        }
      });

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      setDocuments(prev => prev.filter(doc => doc.id !== documentId));
    } catch (err) {
      console.error('Error deleting document:', err);
      alert('Failed to delete document. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Document Library</h1>
          <p className="text-zinc-400">
            Upload pharmaceutical documents for PIL processing workflows
          </p>
        </div>

        {error && (
          <div className="mb-6 bg-rose-500/10 border border-rose-500/20 rounded-xl p-4">
            <p className="text-rose-400 text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <DocumentUpload
              sessionId={sessionId}
              onUploadSuccess={handleUploadSuccess}
              currentDocumentCount={documents.length}
            />
          </div>

          <div className="lg:col-span-2">
            <DocumentLibrary
              documents={documents}
              loading={loading}
              onDelete={handleDelete}
              onRefresh={fetchDocuments}
            />
          </div>
        </div>
      </div>
    </div>
  );
}