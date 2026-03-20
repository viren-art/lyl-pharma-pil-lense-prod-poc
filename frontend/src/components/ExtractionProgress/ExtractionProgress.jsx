import { useState, useEffect } from 'react';

export default function ExtractionProgress({ 
  documentId, 
  documentName, 
  totalPages,
  onComplete,
  onError 
}) {
  const [status, setStatus] = useState('initializing'); // initializing, extracting, complete, error
  const [currentPage, setCurrentPage] = useState(0);
  const [extractedSections, setExtractedSections] = useState([]);
  const [provider, setProvider] = useState('');
  const [fallbackUsed, setFallbackUsed] = useState(false);
  const [startTime] = useState(Date.now());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => {
    let interval;
    if (status === 'extracting') {
      interval = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [status, startTime]);

  useEffect(() => {
    if (!documentId) return;
    
    performExtraction();
  }, [documentId]);

  const performExtraction = async () => {
    try {
      setStatus('extracting');
      
      const sessionId = sessionStorage.getItem('pil-lens-session-id');
      const response = await fetch('/api/extraction/extract', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Session-Id': sessionId
        },
        body: JSON.stringify({ documentId })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Extraction failed');
      }

      const result = await response.json();
      
      setProvider(result.provider);
      setFallbackUsed(result.fallbackUsed);
      setExtractedSections(result.sections);
      setCurrentPage(result.pageImages.length);
      setStatus('complete');
      
      if (onComplete) {
        onComplete(result);
      }
      
    } catch (err) {
      console.error('Extraction error:', err);
      setError(err.message);
      setStatus('error');
      
      if (onError) {
        onError(err);
      }
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const getProviderName = (provider) => {
    return provider === 'google_docai' ? 'Google Document AI' : 'Claude Vision';
  };

  if (status === 'error') {
    return (
      <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">⚠️</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-rose-400 mb-2">
              Extraction Failed
            </h3>
            <p className="text-sm text-zinc-400 mb-4">
              {error}
            </p>
            <button
              onClick={performExtraction}
              className="px-4 py-2 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Retry Extraction
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'complete') {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="text-3xl">✅</div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-emerald-400 mb-2">
              Extraction Complete
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-zinc-500 mb-1">Provider</div>
                <div className="text-zinc-200 font-medium">
                  {getProviderName(provider)}
                  {fallbackUsed && (
                    <span className="ml-2 text-xs text-amber-400">(Fallback)</span>
                  )}
                </div>
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Processing Time</div>
                <div className="text-zinc-200 font-medium">{formatTime(elapsedTime)}</div>
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Pages Processed</div>
                <div className="text-zinc-200 font-medium">{currentPage}</div>
              </div>
              <div>
                <div className="text-zinc-500 mb-1">Sections Extracted</div>
                <div className="text-zinc-200 font-medium">{extractedSections.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const progress = totalPages > 0 ? (currentPage / totalPages) * 100 : 0;

  return (
    <div className="bg-zinc-800/50 border border-white/[0.06] rounded-2xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="animate-spin text-2xl">⚙️</div>
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-zinc-200">
            Extracting Document Content
          </h3>
          <p className="text-sm text-zinc-400">{documentName}</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-violet-400">
            {Math.round(progress)}%
          </div>
          <div className="text-xs text-zinc-500">{formatTime(elapsedTime)}</div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-zinc-700/50 rounded-full overflow-hidden mb-4">
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-violet-500 to-cyan-400 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Status details */}
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-zinc-500 mb-1">Status</div>
          <div className="text-zinc-200 font-medium capitalize">{status}</div>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">Pages</div>
          <div className="text-zinc-200 font-medium">
            {currentPage} / {totalPages || '?'}
          </div>
        </div>
        <div>
          <div className="text-zinc-500 mb-1">Sections Found</div>
          <div className="text-zinc-200 font-medium">{extractedSections.length}</div>
        </div>
      </div>

      {/* Provider info */}
      {provider && (
        <div className="mt-4 pt-4 border-t border-white/[0.06]">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>Using {getProviderName(provider)}</span>
            {fallbackUsed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-full">
                <span>⚠️</span>
                <span>Fallback Provider</span>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}