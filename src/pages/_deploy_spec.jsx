import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function DeploySpecPreview() {
  const [selectedService, setSelectedService] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [isDeploying, setIsDeploying] = useState(false);
  const [deployProgress, setDeployProgress] = useState(0);

  const deploySpec = {
    version: 2,
    services: [
      {
        name: "web",
        type: "static",
        framework: "react-vite",
        root: "frontend",
        build: {
          cmd: "npm run build",
          output: "dist",
          runtime: "node:20"
        },
        serve: {
          cmd: "",
          port: 8080,
          runtime: "nginx"
        },
        status: "running",
        lastDeploy: "2024-01-15T10:30:00Z",
        url: "https://web.example.com"
      },
      {
        name: "api",
        type: "service",
        framework: "express",
        root: "backend",
        build: {
          cmd: "npm install --omit=dev",
          runtime: "node:20"
        },
        serve: {
          cmd: "node server.js",
          port: 8080
        },
        status: "running",
        lastDeploy: "2024-01-15T10:28:00Z",
        url: "https://api.example.com"
      }
    ]
  };

  const deployLogs = [
    { time: "10:30:15", level: "info", message: "Starting deployment for web service" },
    { time: "10:30:16", level: "info", message: "Installing dependencies..." },
    { time: "10:30:45", level: "success", message: "Dependencies installed successfully" },
    { time: "10:30:46", level: "info", message: "Running build command: npm run build" },
    { time: "10:31:20", level: "success", message: "Build completed successfully" },
    { time: "10:31:21", level: "info", message: "Deploying to nginx runtime" },
    { time: "10:31:25", level: "success", message: "Deployment successful" }
  ];

  const handleDeploy = useCallback(() => {
    setIsDeploying(true);
    setDeployProgress(0);
    
    const interval = setInterval(() => {
      setDeployProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => setIsDeploying(false), 500);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  }, []);

  const service = deploySpec.services[selectedService];

  const getStatusColor = (status) => {
    switch(status) {
      case 'running': return 'bg-emerald-500';
      case 'stopped': return 'bg-red-500';
      case 'deploying': return 'bg-yellow-500';
      default: return 'bg-gray-500';
    }
  };

  const getLogColor = (level) => {
    switch(level) {
      case 'success': return 'text-emerald-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      default: return 'text-slate-400';
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-white">Deploy Configuration</h1>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-lg border border-slate-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-slate-300">Version {deploySpec.version}</span>
            </div>
          </div>
          <p className="text-slate-400">Manage and deploy your services</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - Services List */}
          <div className="lg:col-span-1">
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800">
                <h2 className="font-semibold text-white">Services</h2>
              </div>
              <div className="p-2">
                {deploySpec.services.map((svc, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedService(idx)}
                    className={`w-full text-left p-3 rounded-lg mb-2 transition-all ${
                      selectedService === idx
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium">{svc.name}</span>
                      <div className={`w-2 h-2 rounded-full ${getStatusColor(svc.status)}`}></div>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className={`px-2 py-0.5 rounded ${
                        selectedService === idx ? 'bg-blue-700' : 'bg-slate-700'
                      }`}>
                        {svc.type}
                      </span>
                      <span className="text-slate-400">{svc.framework}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
              <h3 className="font-semibold text-white mb-3">Quick Actions</h3>
              <button
                onClick={handleDeploy}
                disabled={isDeploying}
                className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-700 disabled:text-slate-500 text-white px-4 py-2 rounded-lg font-medium transition-colors mb-2"
              >
                {isDeploying ? 'Deploying...' : 'Deploy Service'}
              </button>
              <button className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-lg font-medium transition-colors">
                View Logs
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {/* Tabs */}
            <div className="flex gap-2 mb-4 border-b border-slate-800">
              {['overview', 'build', 'serve', 'logs'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 font-medium capitalize transition-colors ${
                    activeTab === tab
                      ? 'text-blue-400 border-b-2 border-blue-400'
                      : 'text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Deploy Progress */}
            {isDeploying && (
              <div className="mb-4 bg-slate-900 rounded-xl border border-slate-800 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">Deploying {service.name}...</span>
                  <span className="text-sm text-slate-400">{deployProgress}%</span>
                </div>
                <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{ width: `${deployProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-2">{service.name}</h2>
                      <div className="flex items-center gap-3">
                        <span className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300">
                          {service.type}
                        </span>
                        <span className="px-3 py-1 bg-slate-800 rounded-lg text-sm text-slate-300">
                          {service.framework}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(service.status)}`}></div>
                          <span className="text-sm text-slate-400 capitalize">{service.status}</span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={service.url}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                    >
                      <span>Visit</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-1">Root Directory</div>
                      <div className="text-white font-mono">{service.root}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-1">Last Deploy</div>
                      <div className="text-white">{new Date(service.lastDeploy).toLocaleString()}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-1">Port</div>
                      <div className="text-white font-mono">{service.serve.port}</div>
                    </div>
                    <div className="bg-slate-800 rounded-lg p-4">
                      <div className="text-sm text-slate-400 mb-1">URL</div>
                      <div className="text-blue-400 font-mono text-sm truncate">{service.url}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Build Tab */}
            {activeTab === 'build' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Build Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Build Command</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                      {service.build.cmd || '(none)'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Runtime</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                      {service.build.runtime}
                    </div>
                  </div>
                  {service.build.output && (
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Output Directory</label>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                        {service.build.output}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Serve Tab */}
            {activeTab === 'serve' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Serve Configuration</h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Start Command</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                      {service.serve.cmd || '(handled by runtime)'}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm text-slate-400 mb-2 block">Port</label>
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                      {service.serve.port}
                    </div>
                  </div>
                  {service.serve.runtime && (
                    <div>
                      <label className="text-sm text-slate-400 mb-2 block">Runtime</label>
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 font-mono text-sm text-slate-300">
                        {service.serve.runtime}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Logs Tab */}
            {activeTab === 'logs' && (
              <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">Deployment Logs</h3>
                  <button className="text-sm text-slate-400 hover:text-slate-300">
                    Clear
                  </button>
                </div>
                <div className="bg-slate-950 p-4 font-mono text-sm max-h-96 overflow-y-auto">
                  {deployLogs.map((log, idx) => (
                    <div key={idx} className="mb-2 flex gap-3">
                      <span className="text-slate-600">{log.time}</span>
                      <span className={getLogColor(log.level)}>[{log.level.toUpperCase()}]</span>
                      <span className="text-slate-300">{log.message}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}