import { useState, useEffect } from 'react';

export default function F2Preview() {
  const [activeTab, setActiveTab] = useState('deployment');
  const [deploymentStatus, setDeploymentStatus] = useState('deploying');
  const [healthData, setHealthData] = useState(null);
  const [sessionData, setSessionData] = useState(null);

  useEffect(() => {
    // Simulate deployment progress
    const timer = setTimeout(() => {
      setDeploymentStatus('healthy');
      setHealthData({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          googleDocumentAi: 'available',
          claudeApi: 'available',
          puppeteer: 'available',
        },
        memoryUsage: {
          heapUsedMb: 1247,
          heapTotalMb: 4096,
          documentsInMemory: 23,
        },
        sessions: {
          active: 3,
          totalDocuments: 23,
          totalWorkflows: 8,
        },
      });
      setSessionData({
        sessionId: 'a7f3c2e1-4b9d-4a8c-9f2e-1d3c5b7a9e4f',
        documentCount: 8,
        workflowCount: 3,
        maxDocuments: 100,
        documentsRemaining: 92,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
        lastActivity: new Date().toISOString(),
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  const memoryPercent = healthData ? (healthData.memoryUsage.heapUsedMb / healthData.memoryUsage.heapTotalMb) * 100 : 0;
  const documentPercent = sessionData ? (sessionData.documentCount / sessionData.maxDocuments) * 100 : 0;

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-xl bg-zinc-900/80 border-b border-white/5 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg">
                P
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">PIL Lens</h1>
                <p className="text-xs text-zinc-500">GCP Cloud Run Deployment</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium ${
                deploymentStatus === 'healthy' ? 'bg-emerald-500/10 text-emerald-400' :
                deploymentStatus === 'deploying' ? 'bg-amber-500/10 text-amber-400' :
                'bg-rose-500/10 text-rose-400'
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  deploymentStatus === 'healthy' ? 'bg-emerald-400 animate-pulse' :
                  deploymentStatus === 'deploying' ? 'bg-amber-400 animate-pulse' :
                  'bg-rose-400'
                }`} />
                {deploymentStatus === 'healthy' ? 'HEALTHY' : 'DEPLOYING'}
              </span>
              <div className="text-xs text-zinc-500">asia-southeast1</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        <div className="flex gap-2 border-b border-white/5">
          {['deployment', 'health', 'sessions', 'secrets'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-800/50 text-white border-b-2 border-violet-500'
                  : 'text-zinc-400 hover:text-zinc-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === 'deployment' && (
          <div className="space-y-6">
            {/* Deployment Info */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Cloud Run Service</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Service Name</div>
                  <div className="text-sm text-zinc-300 font-mono">pil-lens</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Region</div>
                  <div className="text-sm text-zinc-300">asia-southeast1 (Singapore)</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">CPU</div>
                  <div className="text-sm text-zinc-300">2 vCPU</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Memory</div>
                  <div className="text-sm text-zinc-300">4 GB</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Min Instances</div>
                  <div className="text-sm text-zinc-300">0 (serverless)</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Max Instances</div>
                  <div className="text-sm text-zinc-300">10</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Concurrency</div>
                  <div className="text-sm text-zinc-300">80 requests</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Timeout</div>
                  <div className="text-sm text-zinc-300">300 seconds</div>
                </div>
              </div>
            </div>

            {/* Container Info */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Container Configuration</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Base Image</div>
                  <div className="text-sm text-zinc-300 font-mono">node:18-bullseye-slim</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Chromium</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    Installed
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">CJK Fonts</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    Noto Sans CJK
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Thai Fonts</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    Thai TLWG
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">HTTPS</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    Managed TLS
                  </span>
                </div>
              </div>
            </div>

            {/* Deployment Timeline */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Deployment Timeline</h2>
              <div className="space-y-4">
                {[
                  { step: 'Build Docker image', status: 'complete', time: '2m 34s' },
                  { step: 'Push to Artifact Registry', status: 'complete', time: '1m 12s' },
                  { step: 'Deploy to Cloud Run', status: 'complete', time: '45s' },
                  { step: 'Health check verification', status: deploymentStatus === 'healthy' ? 'complete' : 'running', time: deploymentStatus === 'healthy' ? '8s' : '...' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      item.status === 'complete' ? 'bg-emerald-500/10 text-emerald-400' :
                      item.status === 'running' ? 'bg-amber-500/10 text-amber-400' :
                      'bg-zinc-700 text-zinc-500'
                    }`}>
                      {item.status === 'complete' ? '✓' : item.status === 'running' ? '⋯' : idx + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm text-zinc-300">{item.step}</div>
                      <div className="text-xs text-zinc-500">{item.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'health' && healthData && (
          <div className="space-y-6">
            {/* System Health */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">System Health</h2>
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  HEALTHY
                </span>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Google Document AI</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    available
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Claude API</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    available
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Puppeteer PDF Engine</div>
                  <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                    available
                  </span>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Memory Usage</h2>
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-zinc-400">Heap Memory</div>
                <div className="text-sm text-zinc-300">
                  {healthData.memoryUsage.heapUsedMb} MB / {healthData.memoryUsage.heapTotalMb} MB
                </div>
              </div>
              <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all"
                  style={{ width: `${memoryPercent}%` }}
                />
              </div>
              <div className="text-xs text-zinc-500 mt-2">
                {healthData.memoryUsage.documentsInMemory} documents in memory
              </div>
            </div>

            {/* Global Stats */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Global Statistics</h2>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Active Sessions</div>
                  <div className="text-3xl font-bold text-white">{healthData.sessions.active}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Total Documents</div>
                  <div className="text-3xl font-bold text-white">{healthData.sessions.totalDocuments}</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Total Workflows</div>
                  <div className="text-3xl font-bold text-white">{healthData.sessions.totalWorkflows}</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'sessions' && sessionData && (
          <div className="space-y-6">
            {/* Session Info */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Current Session</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Session ID</div>
                  <div className="text-sm text-zinc-300 font-mono">{sessionData.sessionId.slice(0, 8)}...</div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Created</div>
                  <div className="text-sm text-zinc-300">
                    {new Date(sessionData.createdAt).toLocaleTimeString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Last Activity</div>
                  <div className="text-sm text-zinc-300">
                    {new Date(sessionData.lastActivity).toLocaleTimeString()}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-zinc-500 mb-1">Workflows Executed</div>
                  <div className="text-sm text-zinc-300">{sessionData.workflowCount}</div>
                </div>
              </div>

              {/* Document Usage */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="text-sm text-zinc-400">Document Storage</div>
                  <div className="text-sm text-zinc-300">
                    {sessionData.documentCount} / {sessionData.maxDocuments}
                  </div>
                </div>
                <div className="h-3 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all"
                    style={{ width: `${documentPercent}%` }}
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-2">
                  {sessionData.documentsRemaining} documents remaining
                </div>
              </div>
            </div>

            {/* Session Persistence Warning */}
            <div className="bg-violet-500/10 border border-violet-500/20 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">ℹ️</div>
                <div>
                  <div className="text-sm font-semibold text-violet-400 mb-1">In-Memory Storage</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    All documents and workflow results are stored in memory only. Data will be cleared when you close your browser or after 1 hour of inactivity. This ensures zero data persistence beyond your active session.
                  </div>
                </div>
              </div>
            </div>

            {/* Session Actions */}
            <div className="flex gap-3">
              <button className="flex-1 py-3 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl font-semibold text-sm transition-colors">
                Clear Session Data
              </button>
              <button className="flex-1 py-3 px-4 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-semibold text-sm transition-colors">
                Export Session Report
              </button>
            </div>
          </div>
        )}

        {activeTab === 'secrets' && (
          <div className="space-y-6">
            {/* Secret Manager */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Secret Manager Configuration</h2>
              <div className="space-y-4">
                {[
                  { name: 'google-docai-api-key', status: 'active', version: 'latest', region: 'asia-southeast1' },
                  { name: 'claude-api-key', status: 'active', version: 'latest', region: 'asia-southeast1' },
                ].map((secret, idx) => (
                  <div key={idx} className="bg-zinc-900/50 rounded-xl p-4 border border-white/5">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-semibold text-white font-mono">{secret.name}</div>
                      <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-medium">
                        {secret.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-zinc-500">Version</div>
                        <div className="text-zinc-300">{secret.version}</div>
                      </div>
                      <div>
                        <div className="text-zinc-500">Region</div>
                        <div className="text-zinc-300">{secret.region}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Service Account */}
            <div className="bg-zinc-800/50 rounded-2xl p-6 border border-white/[0.06] shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-4">Service Account</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Account ID</div>
                  <div className="text-sm text-zinc-300 font-mono">pil-lens-sa</div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Email</div>
                  <div className="text-sm text-zinc-300 font-mono text-xs">
                    pil-lens-sa@project.iam.gserviceaccount.com
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-zinc-400">Roles</div>
                  <div className="flex gap-2">
                    <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 text-xs font-medium">
                      Secret Accessor
                    </span>
                    <span className="px-2 py-1 rounded bg-violet-500/10 text-violet-400 text-xs font-medium">
                      Run Invoker
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Security Notice */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="text-2xl">🔒</div>
                <div>
                  <div className="text-sm font-semibold text-amber-400 mb-1">Secure Credential Management</div>
                  <div className="text-xs text-zinc-400 leading-relaxed">
                    API credentials are stored in GCP Secret Manager and injected as environment variables at runtime. Secrets are never logged or exposed in application code.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}