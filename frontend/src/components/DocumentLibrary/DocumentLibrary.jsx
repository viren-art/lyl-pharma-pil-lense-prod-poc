import { useState } from 'react';

export default function DocumentLibrary({ documents, loading, onDelete, onRefresh }) {
  const [filterType, setFilterType] = useState('');
  const [filterProduct, setFilterProduct] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const formatDocumentType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
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

  // Get unique types and products for filters
  const uniqueTypes = [...new Set(documents.map(doc => doc.type))];
  const uniqueProducts = [...new Set(documents.map(doc => doc.productName))];

  // Filter documents
  const filteredDocuments = documents.filter(doc => {
    const matchesType = !filterType || doc.type === filterType;
    const matchesProduct = !filterProduct || doc.productName === filterProduct;
    const matchesSearch = !searchQuery || 
      doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.productName.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesType && matchesProduct && matchesSearch;
  });

  if (loading) {
    return (
      <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
        <div className="flex items-center justify-center py-12">
          <div className="text-zinc-400">Loading documents...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">
          Documents ({filteredDocuments.length})
        </h2>
        <button
          onClick={onRefresh}
          className="text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          🔄 Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
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

        <select
          value={filterProduct}
          onChange={(e) => setFilterProduct(e.target.value)}
          className="bg-zinc-900 border border-white/10 rounded-xl py-2 px-4 text-white text-sm focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 outline-none"
        >
          <option value="">All Products</option>
          {uniqueProducts.map(product => (
            <option key={product} value={product}>
              {product}
            </option>
          ))}
        </select>
      </div>

      {/* Document list */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">📋</div>
          <p className="text-zinc-400 mb-2">No documents found</p>
          <p className="text-sm text-zinc-500">
            {documents.length === 0
              ? 'Upload your first document to get started'
              : 'Try adjusting your filters'}
          </p>
        </div>
      ) : (
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
                  onClick={() => {
                    if (confirm(`Delete "${doc.name}"?`)) {
                      onDelete(doc.id);
                    }
                  }}
                  className="flex-shrink-0 text-rose-400 hover:text-rose-300 transition-colors p-2"
                  title="Delete document"
                >
                  🗑️
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}