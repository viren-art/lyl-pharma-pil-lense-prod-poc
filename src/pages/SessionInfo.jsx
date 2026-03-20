import { useState, useEffect } from 'react';

/**
 * Session Information Display Component
 * Shows current session statistics and memory usage
 */
export default function SessionInfo() {
  const [sessionStats, setSessionStats] = useState(null);
  const [healthStatus, setHealthStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSessionData();
    const interval = setInterval(fetchSessionData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      
      // Fetch session stats
      const statsRes = await fetch('/api/session/stats');
      if (!statsRes.ok) throw new Error('Failed to fetch session stats');
      const stats = await statsRes.json();
      
      // Fetch health status
      const healthRes = await fetch('/api/health');
      if (!healthRes.ok) throw new Error('Failed to fetch health status');
      const health = await healthRes.json();
      
      setSessionStats(stats);
      setHealthStatus(health);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSession = async () => {
    if (!confirm('Clear all documents and workflow results from this session?')) {
      return;
    }
    
    try {
      const res = await fetch('/api/session/clear', { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to clear session');
      
      await fetchSessionData();
      alert('Session cleared successfully');
    } catch (err) {
      alert(`Error clearing session: ${err.message}`);
    }
  };

  if (loading && !sessionStats) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading session information...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 max-w-md">
          <div className="text-rose-400 font-semibold mb-2">Error Loading Session</div>
          <div className="text-zinc-400 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  const documentUsagePercent = (sessionStats.documentCount / sessionStats.maxDocuments) * 100;
  const memoryUsagePercent = (healthStatus.memoryUsage.heapUsedMb / healthStatus.memoryUsage.heapTotalMb) * 100;

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Session Information</h1>
            <p className="text-sm text-zinc-400 mt-1">
              Monitor your current session and system health
            </p>
          </div>
          <button
            onClick={handleClearSession}
            className="px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-semibold text-sm transition-colors"
          >
            Clear Session
          </button>
        </div>

        {/* Session Stats Card */}
        <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
          <h2 className="text-lg font-bold text-white mb-4">Session Statistics</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <div className="text-xs text-zinc-500 mb-1">Session ID</div>
              <div className="text-sm text-zinc-300 font-mono">{sessionStats.sessionId.slice(0, 8)}...</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Created</div>
              <div className="text-sm text-zinc-300">
                {new Date(sessionStats.createdAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Last Activity</div>
              <div className="text-sm text-zinc-300">
                {new Date(sessionStats.lastActivity).toLocaleString()}
              </div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">Workflows Executed</div>
              <div className="text-sm text-zinc-300">{sessionStats.workflowCount}</div>
            </div>
          </div>

          {/* Document Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-zinc-400">Document Storage</div>
              <div className="text-sm text-zinc-300">
                {sessionStats.documentCount} / {sessionStats.maxDocuments}
              </div>
            </div>
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  documentUsagePercent > 90 ? 'bg-rose-500' :
                  documentUsagePercent > 70 ? 'bg-amber-500' :
                  'bg-emerald-500'
                }`}
                style={{ width: `${documentUsagePercent}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {sessionStats.documentsRemaining} documents remaining
            </div>
          </div>
        </div>

        {/* Health Status Card */}
        <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">System Health</h2>
            <span className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
              healthStatus.status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
              healthStatus.status === 'degraded' ? 'bg-amber-500/10 text-amber-400' :
              'bg-rose-500/10 text-rose-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                healthStatus.status === 'healthy' ? 'bg-emerald-400' :
                healthStatus.status === 'degraded' ? 'bg-amber-400' :
                'bg-rose-400'
              }`} />
              {healthStatus.status.toUpperCase()}
            </span>
          </div>

          {/* Service Status */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Google Document AI</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                healthStatus.services.googleDocumentAi === 'available' 
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {healthStatus.services.googleDocumentAi}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Claude API</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                healthStatus.services.claudeApi === 'available' 
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {healthStatus.services.claudeApi}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-zinc-400">Puppeteer PDF Engine</div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                healthStatus.services.puppeteer === 'available' 
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-rose-500/10 text-rose-400'
              }`}>
                {healthStatus.services.puppeteer}
              </span>
            </div>
          </div>

          {/* Memory Usage */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-sm text-zinc-400">Memory Usage</div>
              <div className="text-sm text-zinc-300">
                {healthStatus.memoryUsage.heapUsedMb} MB / {healthStatus.memoryUsage.heapTotalMb} MB
              </div>
            </div>
            <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  memoryUsagePercent > 90 ? 'bg-rose-500' :
                  memoryUsagePercent > 70 ? 'bg-amber-500' :
                  'bg-violet-500'
                }`}
                style={{ width: `${memoryUsagePercent}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 mt-1">
              {healthStatus.memoryUsage.documentsInMemory} documents in memory
            </div>
          </div>
        </div>

        {/* Global Stats Card */}
        {healthStatus.sessions && (
          <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
            <h2 className="text-lg font-bold text-white mb-4">Global Statistics</h2>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-zinc-500 mb-1">Active Sessions</div>
                <div className="text-2xl font-bold text-white">{healthStatus.sessions.active}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Total Documents</div>
                <div className="text-2xl font-bold text-white">{healthStatus.sessions.totalDocuments}</div>
              </div>
              <div>
                <div className="text-xs text-zinc-500 mb-1">Total Workflows</div>
                <div className="text-2xl font-bold text-white">{healthStatus.sessions.totalWorkflows}</div>
              </div>
            </div>
          </div>
        )}

        {/* Info Banner */}
        <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="text-2xl">ℹ️</div>
            <div>
              <div className="text-sm font-semibold text-violet-400 mb-1">Session Persistence</div>
              <div className="text-xs text-zinc-400">
                All documents and workflow results are stored in memory only. Data will be cleared when you close your browser or after 1 hour of inactivity.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}