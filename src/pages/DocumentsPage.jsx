import React, { useState, useEffect, useRef } from 'react';
import productSuggestions from '../data/productSuggestions.json';

const DOCUMENT_TYPES = [
  'innovator_pil',
  'approved_pil',
  'aw_draft',
  'regulatory_source',
  'updated_pil',
  'regulatory_announcement',
  'local_market_pil_format',
  'diecut_specification',
  'stamped_pil',
];

const TYPE_COLORS = {
  innovator_pil: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  approved_pil: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  aw_draft: 'bg-sky-50 text-sky-700 border-sky-200',
  regulatory_source: 'bg-amber-50 text-amber-700 border-amber-200',
  updated_pil: 'bg-blue-50 text-blue-700 border-blue-200',
  regulatory_announcement: 'bg-rose-50 text-rose-700 border-rose-200',
  local_market_pil_format: 'bg-purple-50 text-purple-700 border-purple-200',
  diecut_specification: 'bg-orange-50 text-orange-700 border-orange-200',
  stamped_pil: 'bg-teal-50 text-teal-700 border-teal-200',
};

function formatType(type) {
  return type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatSize(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [productInput, setProductInput] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const suggestionsRef = useRef(null);

  // Fetch documents from backend on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  // Close suggestions on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/documents');
      if (!res.ok) throw new Error('Failed to fetch documents');
      const data = await res.json();
      setDocuments(data.documents || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch documents:', err);
      setError('Failed to load documents');
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || !productInput.trim()) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', selectedType);
      formData.append('productName', productInput.trim());

      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Upload failed');
      }

      setSelectedFile(null);
      setSelectedType('');
      setProductInput('');
      await fetchDocuments();
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
      await fetchDocuments();
    } catch (err) {
      console.error('Delete failed:', err);
      setError('Failed to delete document');
    }
  };

  const filteredSuggestions = productSuggestions.products.filter(p =>
    p.toLowerCase().includes(productInput.toLowerCase()) && p !== productInput
  );

  const filteredDocuments = documents.filter(doc => {
    const matchesType = !filterType || doc.type === filterType;
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (doc.productName && doc.productName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesType && matchesSearch;
  });

  const uniqueTypes = [...new Set(documents.map(d => d.type))];

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-navy-700">Document Library</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload and manage pharmaceutical documents for PIL processing workflows
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-600">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Upload Panel */}
        <div>
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-navy-700 mb-5">Upload Document</h2>

            {/* Session limit */}
            <div className="mb-5 bg-gray-50 rounded-lg p-4 border border-gray-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">Session Documents</span>
                <span className="text-xs font-semibold text-navy-700">{documents.length} / 100</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-navy-700 transition-all"
                  style={{ width: `${(documents.length / 100) * 100}%` }}
                />
              </div>
            </div>

            {/* Drop zone */}
            <div
              className={`mb-5 border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
                dragActive
                  ? 'border-lotus-500 bg-lotus-50'
                  : 'border-gray-300 bg-gray-50 hover:border-gray-400'
              }`}
              onDragEnter={() => setDragActive(true)}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                if (e.dataTransfer.files[0]) setSelectedFile(e.dataTransfer.files[0]);
              }}
              onDragOver={(e) => e.preventDefault()}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-navy-50 flex items-center justify-center">
                    <svg className="w-5 h-5 text-navy-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-xs text-gray-500">{formatSize(selectedFile.size)}</p>
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    className="text-xs text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-10 h-10 mx-auto rounded-lg bg-gray-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Drop file here or click to browse</p>
                    <p className="text-xs text-gray-400 mt-1">PDF or Word (.docx) up to 25 MB</p>
                  </div>
                  <label className="inline-block px-4 py-2 bg-lotus-500 hover:bg-lotus-600 text-white text-sm rounded-lg font-medium cursor-pointer transition-colors">
                    Choose File
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.docx"
                      onChange={(e) => { if (e.target.files[0]) setSelectedFile(e.target.files[0]); }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* Document type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Document Type</label>
              <select
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
              >
                <option value="">Select document type...</option>
                {DOCUMENT_TYPES.map(type => (
                  <option key={type} value={type}>{formatType(type)}</option>
                ))}
              </select>
            </div>

            {/* Product Name - free text with autocomplete */}
            <div className="mb-5 relative" ref={suggestionsRef}>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name</label>
              <input
                type="text"
                value={productInput}
                onChange={(e) => {
                  setProductInput(e.target.value);
                  setShowSuggestions(true);
                }}
                onFocus={() => { if (productInput) setShowSuggestions(true); }}
                placeholder="Type product name..."
                className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
              />
              {showSuggestions && filteredSuggestions.length > 0 && (
                <ul className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {filteredSuggestions.map((product, idx) => (
                    <li
                      key={idx}
                      className="px-3 py-2 text-sm text-gray-700 hover:bg-navy-50 cursor-pointer"
                      onClick={() => {
                        setProductInput(product);
                        setShowSuggestions(false);
                      }}
                    >
                      {product}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedType || !productInput.trim() || uploading}
              className="w-full py-2.5 px-4 bg-lotus-500 hover:bg-lotus-600 disabled:bg-gray-200 disabled:text-gray-400 text-white rounded-lg font-medium text-sm transition-colors"
            >
              {uploading ? 'Uploading...' : 'Upload Document'}
            </button>
          </div>
        </div>

        {/* Document Library */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-navy-700">
                Documents <span className="text-gray-400 font-normal text-sm">({filteredDocuments.length})</span>
              </h2>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
              />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-white border border-gray-300 rounded-lg py-2 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
              >
                <option value="">All Types</option>
                {uniqueTypes.map(type => (
                  <option key={type} value={type}>{formatType(type)}</option>
                ))}
              </select>
            </div>

            {/* Document list */}
            <div className="space-y-3">
              {loading && (
                <div className="text-center py-12 text-gray-400 text-sm">Loading documents...</div>
              )}
              {!loading && filteredDocuments.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-12 h-12 mx-auto rounded-lg bg-gray-100 flex items-center justify-center mb-3">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                  </div>
                  <p className="text-sm text-gray-400">
                    {documents.length === 0 ? 'No documents yet — upload your first document to get started' : 'No documents match your search'}
                  </p>
                </div>
              )}
              {filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  className="rounded-lg border border-gray-100 p-4 hover:border-gray-200 hover:bg-gray-50/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                        <h3 className="text-sm font-medium text-gray-900 truncate">{doc.name}</h3>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${TYPE_COLORS[doc.type] || 'bg-gray-50 text-gray-600 border-gray-200'}`}>
                          {formatType(doc.type)}
                        </span>
                        {doc.productName && <span className="text-xs text-gray-400">{doc.productName}</span>}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{formatSize(doc.fileSize)}</span>
                        {doc.pageCount && <span>{doc.pageCount} pages</span>}
                        <span>{formatDate(doc.uploadDate)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="flex-shrink-0 text-gray-300 hover:text-red-500 transition-colors p-1"
                      title="Delete document"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
