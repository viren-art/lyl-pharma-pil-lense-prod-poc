import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function ScaffoldPreview() {
  const [activeTab, setActiveTab] = useState('structure');
  const [selectedFile, setSelectedFile] = useState('package.json');
  const [terminalOutput, setTerminalOutput] = useState([
    { type: 'info', text: '$ npm install' },
    { type: 'success', text: '✓ Dependencies installed' },
    { type: 'info', text: '$ npm run dev' },
    { type: 'success', text: '✓ Server running on port 8080' },
    { type: 'success', text: '✓ Vite dev server running on port 5173' },
  ]);

  const fileStructure = [
    { name: 'package.json', type: 'file', icon: '📦', category: 'config' },
    { name: 'server.js', type: 'file', icon: '⚙️', category: 'backend' },
    { name: 'vite.config.js', type: 'file', icon: '⚡', category: 'config' },
    { name: 'tailwind.config.js', type: 'file', icon: '🎨', category: 'config' },
    { name: 'index.html', type: 'file', icon: '📄', category: 'frontend' },
    { name: 'src/main.jsx', type: 'file', icon: '⚛️', category: 'frontend' },
    { name: 'src/App.jsx', type: 'file', icon: '⚛️', category: 'frontend' },
    { name: 'src/index.css', type: 'file', icon: '💅', category: 'frontend' },
    { name: 'src/pages/Home.jsx', type: 'file', icon: '📱', category: 'frontend' },
    { name: 'src/routes/', type: 'folder', icon: '📁', category: 'backend' },
    { name: 'src/services/', type: 'folder', icon: '📁', category: 'backend' },
    { name: 'src/data/', type: 'folder', icon: '📁', category: 'backend' },
    { name: '.env.example', type: 'file', icon: '🔐', category: 'config' },
  ];

  const features = [
    { name: 'React 18', icon: '⚛️', status: 'active', color: 'bg-blue-500' },
    { name: 'Express Server', icon: '🚀', status: 'active', color: 'bg-green-500' },
    { name: 'Vite Build', icon: '⚡', status: 'active', color: 'bg-purple-500' },
    { name: 'Tailwind CSS', icon: '🎨', status: 'active', color: 'bg-cyan-500' },
    { name: 'React Router', icon: '🛣️', status: 'active', color: 'bg-orange-500' },
    { name: 'Auto Routes', icon: '🔄', status: 'ready', color: 'bg-yellow-500' },
    { name: 'PDF Processing', icon: '📄', status: 'ready', color: 'bg-red-500' },
    { name: 'Document AI', icon: '🤖', status: 'ready', color: 'bg-indigo-500' },
  ];

  const dependencies = [
    { name: 'react', version: '^18.3.1', type: 'core' },
    { name: 'react-dom', version: '^18.3.1', type: 'core' },
    { name: 'react-router-dom', version: '^6.23.1', type: 'core' },
    { name: 'express', version: '^4.19.2', type: 'backend' },
    { name: 'vite', version: '^5.3.1', type: 'dev' },
    { name: 'tailwindcss', version: '^3.4.4', type: 'dev' },
    { name: 'pdf-lib', version: '^1.17.1', type: 'utility' },
    { name: 'puppeteer', version: '^21.0.0', type: 'utility' },
  ];

  const fileContents = {
    'package.json': `{
  "name": "qp-oav7fna3ms",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch server.js",
    "build": "vite build",
    "start": "node server.js"
  },
  "dependencies": {
    "react": "^18.3.1",
    "express": "^4.19.2",
    "pdf-lib": "^1.17.1"
  }
}`,
    'server.js': `import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Auto-load routes
const routesDir = join(__dirname, 'src', 'routes');
// ... route loading logic

const PORT = process.env.PORT || 8080;
app.listen(PORT);`,
    'src/App.jsx': `import { BrowserRouter, Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
}`,
  };

  const runCommand = (cmd) => {
    setTerminalOutput(prev => [...prev, { type: 'info', text: `$ ${cmd}` }]);
    setTimeout(() => {
      setTerminalOutput(prev => [...prev, { type: 'success', text: `✓ ${cmd} completed` }]);
    }, 500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-slate-800 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                <span className="text-3xl">🏗️</span>
                Project Scaffold
              </h1>
              <p className="text-sm text-gray-400 mt-1">Full-stack React + Express starter template</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full text-green-400 text-xs font-medium">
                ● Ready
              </div>
              <div className="px-3 py-1 bg-slate-800 rounded-lg text-xs text-gray-400">
                v0.1.0
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-800 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            {['structure', 'features', 'dependencies', 'terminal'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium capitalize transition-colors relative ${
                  activeTab === tab
                    ? 'text-white'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
                {activeTab === tab && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeTab === 'structure' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* File Tree */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <span>📁</span>
                    Project Files
                  </h3>
                </div>
                <div className="p-2 max-h-[600px] overflow-y-auto">
                  {fileStructure.map((file, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedFile(file.name)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center gap-2 transition-colors ${
                        selectedFile === file.name
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : 'text-gray-300 hover:bg-slate-800'
                      }`}
                    >
                      <span className="text-base">{file.icon}</span>
                      <span className="flex-1 font-mono text-xs">{file.name}</span>
                      {file.type === 'folder' && (
                        <span className="text-xs text-gray-500">dir</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* File Content */}
            <div className="lg:col-span-2">
              <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                  <h3 className="font-semibold text-white font-mono text-sm">{selectedFile}</h3>
                  <button className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-gray-300 transition-colors">
                    Copy
                  </button>
                </div>
                <div className="p-4">
                  <pre className="text-xs text-gray-300 font-mono overflow-x-auto">
                    <code>{fileContents[selectedFile] || '// File content preview...'}</code>
                  </pre>
                </div>
              </div>

              {/* Quick Stats */}
              <div className="grid grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-2xl font-bold text-white">13</div>
                  <div className="text-xs text-gray-400 mt-1">Files</div>
                </div>
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-2xl font-bold text-white">3</div>
                  <div className="text-xs text-gray-400 mt-1">Routes Ready</div>
                </div>
                <div className="bg-slate-900 rounded-lg border border-slate-800 p-4">
                  <div className="text-2xl font-bold text-white">8</div>
                  <div className="text-xs text-gray-400 mt-1">Features</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'features' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-slate-900 rounded-lg border border-slate-800 p-5 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{feature.icon}</span>
                  <div className={`w-2 h-2 rounded-full ${feature.color}`} />
                </div>
                <h3 className="font-semibold text-white mb-1">{feature.name}</h3>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    feature.status === 'active'
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                      : 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20'
                  }`}>
                    {feature.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'dependencies' && (
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50">
              <h3 className="font-semibold text-white">Package Dependencies</h3>
            </div>
            <div className="divide-y divide-slate-800">
              {dependencies.map((dep, idx) => (
                <div key={idx} className="px-4 py-3 flex items-center justify-between hover:bg-slate-800/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      dep.type === 'core' ? 'bg-blue-500' :
                      dep.type === 'backend' ? 'bg-green-500' :
                      dep.type === 'dev' ? 'bg-purple-500' :
                      'bg-orange-500'
                    }`} />
                    <span className="font-mono text-sm text-white">{dep.name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs text-gray-400 font-mono">
                      {dep.version}
                    </span>
                    <span className="px-2 py-1 bg-slate-800 rounded text-xs text-gray-400 capitalize">
                      {dep.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'terminal' && (
          <div className="space-y-4">
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-800 bg-slate-800/50 flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <span>💻</span>
                  Terminal Output
                </h3>
                <button
                  onClick={() => setTerminalOutput([])}
                  className="px-3 py-1 bg-slate-700 hover:bg-slate-600 rounded text-xs text-gray-300 transition-colors"
                >
                  Clear
                </button>
              </div>
              <div className="p-4 font-mono text-sm space-y-2 max-h-96 overflow-y-auto bg-black/30">
                {terminalOutput.map((line, idx) => (
                  <div
                    key={idx}
                    className={`${
                      line.type === 'success' ? 'text-green-400' :
                      line.type === 'error' ? 'text-red-400' :
                      'text-gray-400'
                    }`}
                  >
                    {line.text}
                  </div>
                ))}
                <div className="text-gray-500 animate-pulse">▊</div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {['npm install', 'npm run dev', 'npm run build', 'npm start'].map(cmd => (
                <button
                  key={cmd}
                  onClick={() => runCommand(cmd)}
                  className="px-4 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-sm font-mono text-gray-300 transition-colors"
                >
                  {cmd}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}