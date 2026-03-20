import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function F1Preview() {
  const [documents, setDocuments] = React.useState([
    {
      id: '1',
      name: 'Zenora_PIL_Taiwan_v2.3.pdf',
      type: 'approved_pil',
      productName: 'Zenora (Abiraterone Acetate) 250mg',
      fileSize: 2457600,
      pageCount: 12,
      uploadDate: '2024-01-15T14:30:00Z'
    },
    {
      id: '2',
      name: 'Innovator_Reference_Zytiga.pdf',
      type: 'innovator_pil',
      productName: 'Zenora (Abiraterone Acetate) 250mg',
      fileSize: 3145728,
      pageCount: 18,
      uploadDate: '2024-01-15T14:25:00Z'
    },
    {
      id: '3',
      name: 'Thailand_FDA_Format_Template.docx',
      type: 'local_market_pil_format',
      productName: 'Lenalidomide 25mg',
      fileSize: 1048576,
      pageCount: null,
      uploadDate: '2024-01-15T13:45:00Z'
    },
    {
      id: '4',
      name: 'AW_Draft_Lenalidomide_TH_v1.pdf',
      type: 'aw_draft',
      productName: 'Lenalidomide 25mg',
      fileSize: 4194304,
      pageCount: 24,
      uploadDate: '2024-01-15T12:15:00Z'
    }
  ]);

  const [selectedFile, setSelectedFile] = React.useState(null);
  const [selectedType, setSelectedType] = React.useState('');
  const [selectedProduct, setSelectedProduct] = React.useState('');
  const [dragActive, setDragActive] = React.useState(false);
  const [filterType, setFilterType] = React.useState('');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [uploading, setUploading] = React.useState(false);

  const documentTypes = [
    'innovator_pil',
    'approved_pil',
    'aw_draft',
    'regulatory_source',
    'updated_pil',
    'regulatory_announcement',
    'local_market_pil_format',
    'diecut_specification',
    'stamped_pil'
  ];

  const products = [
    'Zenora (Abiraterone Acetate) 250mg',
    'Lenalidomide 25mg',
    'Ibrutinib 140mg',
    'Pomalidomide 4mg',
    'Venetoclax 100mg'
  ];

  const formatDocumentType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    const mb = bytes / 1024 / 1024;
    return `${mb.toFixed(2)} MB`;
  };

  const getTypeColor = (type) => {
    const colors = {
      innovator_pil: 'bg-violet-500/20 text-violet-400 border-violet-500/30',
      approved_pil: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      aw_draft: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
      regulatory_source: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      updated_pil: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      regulatory_announcement: 'bg-rose-500/20 text-rose-400 border-rose-500/30',
      local_market_pil_format: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      diecut_specification: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      stamped_pil: 'bg-green-500/20 text-green-400 border-green-500/30'
    };
    return colors[type] || 'bg-zinc-500/20 text-zinc-400 border-zinc-500/30';
  };

  const handleFileSelect = (file) => {
    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (!selectedFile || !selectedType || !selectedProduct) return;
    
    setUploading(true);
    setTimeout(() => {
      const newDoc = {
        id: String(documents.length + 1),
        name: selectedFile.name,
        type: selectedType,
        productName: selectedProduct,
        fileSize: selectedFile.size,
        pageCount: Math.floor(Math.random() * 20) + 5,
        uploadDate: new Date().toISOString()
      };
      setDocuments([newDoc, ...documents]);
      setSelectedFile(null);
      setSelectedType('');
      setSelectedProduct('');
      setUploading(false);
    }, 1500);
  };

  const handleDelete = (id) => {
    setDocuments(documents.filter(doc => doc.id !== id));
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesType = !filterType || doc.type === filterType;
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.productName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const uniqueTypes = [...new Set(documents.map(doc => doc.type))];

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Document Library</h1>
          <p className="text-zinc-400">
            Upload pharmaceutical documents for PIL processing workflows
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Panel */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-xl font-bold text-white mb-6">Upload Document</h2>

              {/* Session limit indicator */}
              <div className="mb-6 bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-zinc-400">Session Documents</span>
                  <span className="text-sm font-semibold text-white">
                    {documents.length} / 100
                  </span>
                </div>
                <div className="w-full bg-zinc-700/50 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-violet-500 transition-all"
                    style={{ width: `${(documents.length / 100) * 100}%` }}
                  />
                </div>
              </div>

              {/* File drop zone */}
              <div
                className={`mb-6 border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-white/10 bg-zinc-900/30'
                }`}
                onDragEnter={() => setDragActive(true)}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files[0]) {
                    handleFileSelect(e.dataTransfer.files[0]);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
              >
                {selectedFile ? (
                  <div className="space-y-2">
                    <div className="text-4xl">📄</div>
                    <p className="text-white font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-zinc-400">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                    <button
                      onClick={() => setSelectedFile(null)}
                      className="text-sm text-violet-400 hover:text-violet-300"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="text-4xl">📁</div>
                    <div>
                      <p className="text-white font-medium mb-1">
                        Drop file here or click to browse
                      </p>
                      <p className="text-sm text-zinc-400">
                        PDF or Word (.docx) • Max 25MB
                      </p>
                    </div>
                    <label className="inline-block px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-semibold cursor-pointer transition-colors">
                      Choose File
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx"
                        onChange={(e) => {
                          if (e.target.files[0]) {
                            handleFileSelect(e.target.files[0]);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Document type selector */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Document Type
                </label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none"
                >
                  <option value="">Select document type...</option>
                  {documentTypes.map(type => (
                    <option key={type} value={type}>
                      {formatDocumentType(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Product selector */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  Product Name
                </label>
                <select
                  value={selectedProduct}
                  onChange={(e) => setSelectedProduct(e.target.value)}
                  className="w-full bg-zinc-900 border border-white/10 rounded-xl py-3 px-4 text-white focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none"
                >
                  <option value="">Select product...</option>
                  {products.map(product => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>

              {/* Upload button */}
              <button
                onClick={handleUpload}
                disabled={!selectedFile || !selectedType || !selectedProduct || uploading}
                className="w-full py-3 px-4 bg-violet-500 hover:bg-violet-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-semibold transition-colors"
              >
                {uploading ? 'Uploading...' : 'Upload Document'}
              </button>
            </div>
          </div>

          {/* Document Library */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  Documents ({filteredDocuments.length})
                </h2>
                <button className="text-sm text-violet-400 hover:text-violet-300 transition-colors">
                  🔄 Refresh
                </button>
              </div>

              {/* Filters */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <input
                  type="text"
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl py-2 px-4 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none"
                />
                
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl py-2 px-4 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none"
                >
                  <option value="">All Types</option>
                  {uniqueTypes.map(type => (
                    <option key={type} value={type}>
                      {formatDocumentType(type)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Document list */}
              <div className="space-y-3">
                {filteredDocuments.map(doc => (
                  <div
                    key={doc.id}
                    className="bg-zinc-900/50 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="text-2xl">📄</span>
                          <h3 className="text-white font-medium truncate">{doc.name}</h3>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getTypeColor(doc.type)}`}>
                            {formatDocumentType(doc.type)}
                          </span>
                          <span className="text-xs text-zinc-500">•</span>
                          <span className="text-xs text-zinc-400">{doc.productName}</span>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-zinc-500">
                          <span>{formatFileSize(doc.fileSize)}</span>
                          {doc.pageCount && (
                            <>
                              <span>•</span>
                              <span>{doc.pageCount} pages</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDate(doc.uploadDate)}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDelete(doc.id)}
                        className="flex-shrink-0 text-rose-400 hover:text-rose-300 transition-colors p-2"
                        title="Delete document"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}