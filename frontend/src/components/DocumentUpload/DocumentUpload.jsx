import { useState, useEffect, useRef } from 'react';

const MAX_DOCUMENTS = 100;
const MAX_FILE_SIZE_MB = 25;

export default function DocumentUpload({ sessionId, onUploadSuccess, currentDocumentCount }) {
  const [products, setProducts] = useState([]);
  const [documentTypes, setDocumentTypes] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedType, setSelectedType] = useState('');
  const [selectedProduct, setSelectedProduct] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Load products and document types on mount
  useEffect(() => {
    loadProducts();
    loadDocumentTypes();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/config/products.json');
      const data = await response.json();
      setProducts(data.products);
    } catch (err) {
      console.error('Failed to load products:', err);
      setError('Failed to load product catalog');
    }
  };

  const loadDocumentTypes = async () => {
    try {
      const response = await fetch('/api/documents/types');
      const data = await response.json();
      setDocumentTypes(data.types);
    } catch (err) {
      console.error('Failed to load document types:', err);
      setError('Failed to load document types');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    setError(null);

    // Validate file type
    const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only PDF and Word (.docx) files are allowed');
      return;
    }

    // Validate file size
    const fileSizeMB = file.size / 1024 / 1024;
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      setError(`File size ${fileSizeMB.toFixed(2)}MB exceeds maximum ${MAX_FILE_SIZE_MB}MB`);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedType || !selectedProduct) {
      setError('Please select a file, document type, and product');
      return;
    }

    if (currentDocumentCount >= MAX_DOCUMENTS) {
      setError(`Session limit reached: maximum ${MAX_DOCUMENTS} documents per session`);
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('type', selectedType);
      formData.append('productName', selectedProduct);

      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: {
          'X-Session-Id': sessionId
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Upload failed');
      }

      const document = await response.json();
      onUploadSuccess(document);

      // Reset form
      setSelectedFile(null);
      setSelectedType('');
      setSelectedProduct('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const formatDocumentType = (type) => {
    return type.split('_').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };

  return (
    <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
      <h2 className="text-xl font-bold text-white mb-6">Upload Document</h2>

      {/* Session limit indicator */}
      <div className="mb-6 bg-zinc-900/50 rounded-xl p-4 border border-white/5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-zinc-400">Session Documents</span>
          <span className="text-sm font-semibold text-white">
            {currentDocumentCount} / {MAX_DOCUMENTS}
          </span>
        </div>
        <div className="w-full bg-zinc-700/50 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              currentDocumentCount >= MAX_DOCUMENTS
                ? 'bg-rose-500'
                : currentDocumentCount >= MAX_DOCUMENTS * 0.8
                ? 'bg-amber-500'
                : 'bg-violet-500'
            }`}
            style={{ width: `${(currentDocumentCount / MAX_DOCUMENTS) * 100}%` }}
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
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx"
          onChange={handleFileInputChange}
          className="hidden"
          id="file-upload"
        />
        
        {selectedFile ? (
          <div className="space-y-2">
            <div className="text-4xl">📄</div>
            <p className="text-white font-medium">{selectedFile.name}</p>
            <p className="text-sm text-zinc-400">
              {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
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
                PDF or Word (.docx) • Max {MAX_FILE_SIZE_MB}MB
              </p>
            </div>
            <label
              htmlFor="file-upload"
              className="inline-block px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-xl font-semibold cursor-pointer transition-colors"
            >
              Choose File
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
            <option key={product.id} value={product.name}>
              {product.name}
            </option>
          ))}
        </select>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-4 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
          <p className="text-rose-400 text-sm">{error}</p>
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || !selectedType || !selectedProduct || uploading || currentDocumentCount >= MAX_DOCUMENTS}
        className="w-full py-3 px-4 bg-violet-500 hover:bg-violet-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-xl font-semibold transition-colors"
      >
        {uploading ? 'Uploading...' : 'Upload Document'}
      </button>
    </div>
  );
}