import React, { useState } from 'react';

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

const PRODUCTS = [
  'Zenora (Abiraterone Acetate) 250mg',
  'Lenalidomide 25mg',
  'Ibrutinib 140mg',
  'Pomalidomide 4mg',
  'Venetoclax 100mg',
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

const SEED_DOCUMENTS = [
  {
    id: '1',
    name: 'Zenora_PIL_Taiwan_v2.3.pdf',
    type: 'approved_pil',
    productName: 'Zenora (Abiraterone Acetate) 250mg',
    fileSize: 2457600,
    pageCount: 12,
    uploadDate: '2024-01-15T14:30:00Z',
  },
  {
    id: '2',
    name: 'Innovator_Reference_Zytiga.pdf',
    type: 'innovator_pil',
    productName: 'Zenora (Abiraterone Acetate) 250mg',
    fileSize: 3145728,
    pageCount: 18,
    uploadDate: '2024-01-15T14:25:00Z',
  },
  {
    id: '3',
    name: 'Thailand_FDA_Format_Template.docx',
    type: 'local_market_pil_format',
    productName: 'Lenalidomide 25mg',
    fileSize: 1048576,
    pageCount: null,
    uploadDate: '2024-01-15T13:45:00Z',
  },
  {
    id: '4',
    name: 'AW_Draft_Lenalidomide_TH_v1.pdf',
    type: 'aw_draft',
    productName: 'Lenalidomide 25mg',
    fileSize: 4194304,
    pageCount: 24,
    uploadDate: '2024-01-15T12:15:00Z',
  },
];

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
  const [documents, setDocuments] = useState(SEED_DOCUMENTS);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [filterType, setFilterType] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    if (!selectedFile || !selectedType || !selectedProduct) return;
    setUploading(true);
    setTimeout(() => {
      const newDoc = {
        id: String(Date.now()),
        name: selectedFile.name,
        type: selectedType,
        productName: selectedProduct,
        fileSize: selectedFile.size,
        pageCount: Math.floor(Math.random() * 20) + 5,
        uploadDate: new Date().toISOString(),
      };
      setDocuments([newDoc, ...documents]);
      setSelectedFile(null);
      setSelectedType('');
      setSelectedProduct('');
      setUploading(false);
    }, 1500);
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesType = !filterType || doc.type === filterType;
    const matchesSearch =
      !searchQuery ||
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.productName.toLowerCase().includes(searchQuery.toLowerCase());
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

            {/* Product */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Product Name</label>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="w-full bg-white border border-gray-300 rounded-lg py-2.5 px-3 text-sm text-gray-900 focus:ring-2 focus:ring-navy-200 focus:border-navy-500 outline-none"
              >
                <option value="">Select product...</option>
                {PRODUCTS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Upload button */}
            <button
              onClick={handleUpload}
              disabled={!selectedFile || !selectedType || !selectedProduct || uploading}
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
              {filteredDocuments.length === 0 && (
                <div className="text-center py-12 text-gray-400 text-sm">No documents found</div>
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
                        <span className="text-xs text-gray-400">{doc.productName}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        <span>{formatSize(doc.fileSize)}</span>
                        {doc.pageCount && <span>{doc.pageCount} pages</span>}
                        <span>{formatDate(doc.uploadDate)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDocuments(documents.filter(d => d.id !== doc.id))}
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
