import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
export default function F7Preview() {
  const [selectedPil, setSelectedPil] = React.useState('');
  const [selectedMarket, setSelectedMarket] = React.useState('taiwan_tfda');
  const [selectedDiecut, setSelectedDiecut] = React.useState('');
  const [generating, setGenerating] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [showResult, setShowResult] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState('setup');

  const approvedPils = [
    { id: '1', name: 'Zenora_Approved_PIL_TW_v2.3.pdf', product: 'Zenora (Abiraterone Acetate) 250mg', pages: 12 },
    { id: '2', name: 'Lenalidomide_Approved_PIL_TH_v1.8.pdf', product: 'Lenalidomide 25mg', pages: 8 },
    { id: '3', name: 'Ibrutinib_Approved_PIL_TW_v3.1.pdf', product: 'Ibrutinib 140mg', pages: 15 }
  ];

  const markets = [
    { code: 'taiwan_tfda', name: 'Taiwan TFDA', desc: 'Taiwan Food and Drug Administration format', flag: '🇹🇼' },
    { code: 'thailand_fda', name: 'Thailand FDA', desc: 'Thailand Food and Drug Administration format', flag: '🇹🇭' }
  ];

  const diecutSpecs = [
    { id: '1', name: 'Diecut_210x297_z-fold.pdf', dims: '210mm × 297mm', fold: 'Z-Fold' },
    { id: '2', name: 'Diecut_200x280_c-fold.pdf', dims: '200mm × 280mm', fold: 'C-Fold' }
  ];

  const handleGenerate = () => {
    setGenerating(true);
    setProgress(0);
    setActiveTab('progress');
    
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setGenerating(false);
          setShowResult(true);
          setActiveTab('result');
          return 100;
        }
        return prev + 8;
      });
    }, 200);
  };

  const handleDownload = () => {
    alert('📥 Downloading AW-Draft-taiwan_tfda-2024-01-15.pdf');
  };

  const selectedMarketData = markets.find(m => m.code === selectedMarket);
  const selectedPilData = approvedPils.find(p => p.id === selectedPil);
  const selectedDiecutData = diecutSpecs.find(d => d.id === selectedDiecut);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950">
      {/* Header */}
      <div className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/80 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl">
                📄
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Generate AW Draft</h1>
                <p className="text-xs text-slate-400">Market-specific artwork PDF generation</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Session: PIL-2024-001</span>
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Info Banner */}
        <div className="mb-6 rounded-2xl bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-400/20 p-5">
          <div className="flex items-start gap-3">
            <span className="text-2xl">ℹ️</span>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-blue-300 mb-1">Workflow Overview</h3>
              <p className="text-xs text-blue-200/80 leading-relaxed">
                Generate formatted artwork PDF from Approved PIL using Taiwan TFDA or Thailand Thai FDA templates. 
                Includes correct section ordering, fonts, regulatory disclaimers, and emergency contacts. 
                <strong className="text-blue-100"> Eliminates 7-10 days of manual creation.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'setup', label: 'Setup', icon: '⚙️' },
            { id: 'progress', label: 'Progress', icon: '⏳' },
            { id: 'result', label: 'Result', icon: '✅' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 rounded-xl py-3 px-4 font-semibold text-sm transition-all ${
                activeTab === tab.id
                  ? 'bg-violet-500 text-white shadow-lg shadow-violet-500/30'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Setup Tab */}
        {activeTab === 'setup' && (
          <div className="space-y-5">
            {/* Document Selection */}
            <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-6 shadow-lg shadow-black/20">
              <h2 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                <span>📋</span>
                Document Selection
              </h2>

              <div className="space-y-4">
                {/* Approved PIL */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Approved PIL <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={selectedPil}
                    onChange={(e) => setSelectedPil(e.target.value)}
                    className="w-full rounded-xl bg-slate-900/80 border border-white/10 text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  >
                    <option value="">Select Approved PIL...</option>
                    {approvedPils.map(pil => (
                      <option key={pil.id} value={pil.id}>
                        {pil.name} — {pil.product} ({pil.pages} pages)
                      </option>
                    ))}
                  </select>
                </div>

                {/* Target Market */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Target Market <span className="text-rose-400">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {markets.map(market => (
                      <button
                        key={market.code}
                        onClick={() => setSelectedMarket(market.code)}
                        className={`rounded-xl p-4 border-2 transition-all text-left ${
                          selectedMarket === market.code
                            ? 'border-violet-500 bg-violet-500/10'
                            : 'border-white/10 bg-slate-900/50 hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl">{market.flag}</span>
                          <span className="font-semibold text-white text-sm">{market.name}</span>
                        </div>
                        <p className="text-xs text-slate-400">{market.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Diecut Specification */}
                <div>
                  <label className="block text-sm font-semibold text-slate-300 mb-2">
                    Diecut Specification <span className="text-slate-500">(Optional)</span>
                  </label>
                  <select
                    value={selectedDiecut}
                    onChange={(e) => setSelectedDiecut(e.target.value)}
                    className="w-full rounded-xl bg-slate-900/80 border border-white/10 text-white py-3 px-4 focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition-all"
                  >
                    <option value="">None (use standard dimensions)</option>
                    {diecutSpecs.map(spec => (
                      <option key={spec.id} value={spec.id}>
                        {spec.name} — {spec.dims} — {spec.fold}
                      </option>
                    ))}
                  </select>
                  <p className="mt-2 text-xs text-slate-500">
                    Apply custom paper dimensions and fold type from supplier specification
                  </p>
                </div>
              </div>
            </div>

            {/* Template Preview */}
            {selectedMarket && (
              <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-6 shadow-lg shadow-black/20">
                <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                  <span>🎨</span>
                  Template Configuration
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="rounded-lg bg-slate-900/50 p-3 border border-white/5">
                    <div className="text-slate-400 mb-1">Section Ordering</div>
                    <div className="text-white font-medium">
                      {selectedMarket === 'taiwan_tfda' ? '12 sections (TFDA)' : '13 sections (Thai FDA)'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3 border border-white/5">
                    <div className="text-slate-400 mb-1">Font Family</div>
                    <div className="text-white font-medium">
                      {selectedMarket === 'taiwan_tfda' ? 'Noto Sans TC' : 'Noto Sans Thai'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3 border border-white/5">
                    <div className="text-slate-400 mb-1">Paper Size</div>
                    <div className="text-white font-medium">
                      {selectedDiecut ? selectedDiecutData?.dims : '210mm × 297mm (A4)'}
                    </div>
                  </div>
                  <div className="rounded-lg bg-slate-900/50 p-3 border border-white/5">
                    <div className="text-slate-400 mb-1">Regulatory Text</div>
                    <div className="text-white font-medium">
                      {selectedMarket === 'taiwan_tfda' ? '本藥須由醫師處方使用' : 'ยานี้ต้องใช้ตามใบสั่งแพทย์'}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Generate Button */}
            <button
              onClick={handleGenerate}
              disabled={!selectedPil || !selectedMarket || generating}
              className="w-full rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white py-4 px-6 font-bold text-lg hover:from-violet-600 hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
            >
              {generating ? '⏳ Generating...' : '🚀 Generate AW Draft PDF'}
            </button>
          </div>
        )}

        {/* Progress Tab */}
        {activeTab === 'progress' && (
          <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-8 shadow-lg shadow-black/20">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-violet-500/20 mb-4">
                <span className="text-4xl animate-pulse">⚙️</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
Generating Artwork PDF
              </h2>
              <p className="text-slate-400">Processing {selectedPilData?.name}</p>
            </div>

            {/* Progress Bar */}
            <div className="mb-8">
              <div className="flex justify-between text-sm text-slate-400 mb-2">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-900/80 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-violet-500 to-purple-600 transition-all duration-300 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Steps */}
            <div className="space-y-3">
              {[
                { label: 'Extracting PIL content', done: progress > 20 },
                { label: 'Loading market template', done: progress > 40 },
                { label: 'Applying section ordering', done: progress > 60 },
                { label: 'Rendering PDF layout', done: progress > 80 },
                { label: 'Finalizing artwork', done: progress >= 100 }
              ].map((step, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    step.done ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400'
                  }`}>
                    {step.done ? '✓' : idx + 1}
                  </div>
                  <span className={`text-sm ${step.done ? 'text-white font-medium' : 'text-slate-400'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Stats */}
            <div className="mt-8 grid grid-cols-3 gap-4">
              <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5 text-center">
                <div className="text-2xl font-bold text-violet-400">{selectedPilData?.pages || 12}</div>
                <div className="text-xs text-slate-400 mt-1">Pages</div>
              </div>
              <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5 text-center">
                <div className="text-2xl font-bold text-cyan-400">{Math.floor(progress / 8)}</div>
                <div className="text-xs text-slate-400 mt-1">Sections</div>
              </div>
              <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5 text-center">
                <div className="text-2xl font-bold text-amber-400">{(progress * 0.05).toFixed(1)}s</div>
                <div className="text-xs text-slate-400 mt-1">Elapsed</div>
              </div>
            </div>
          </div>
        )}

        {/* Result Tab */}
        {activeTab === 'result' && showResult && (
          <div className="space-y-5">
            {/* Success Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-400/20 p-5">
              <div className="flex items-start gap-3">
                <span className="text-3xl">✅</span>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-emerald-300 mb-1">AW Draft Generated Successfully</h3>
                  <p className="text-sm text-emerald-200/80">
                    Your artwork PDF is ready for refinement in InDesign. All sections have been formatted according to {selectedMarketData?.name} requirements.
                  </p>
                </div>
              </div>
            </div>

            {/* Metadata */}
            <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-6 shadow-lg shadow-black/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📊</span>
                Generation Summary
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Target Market</div>
                  <div className="text-white font-semibold flex items-center gap-2">
                    <span>{selectedMarketData?.flag}</span>
                    {selectedMarketData?.name}
                  </div>
                </div>
                <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Sections Processed</div>
                  <div className="text-white font-semibold">12 sections</div>
                </div>
                <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Diecut Applied</div>
                  <div className="text-white font-semibold">{selectedDiecut ? 'Yes' : 'No'}</div>
                </div>
                <div className="rounded-xl bg-slate-900/50 p-4 border border-white/5">
                  <div className="text-xs text-slate-400 mb-1">Generation Time</div>
                  <div className="text-white font-semibold">4.8s</div>
                </div>
              </div>
            </div>

            {/* PDF Preview */}
            <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-6 shadow-lg shadow-black/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span>📄</span>
                PDF Preview
              </h3>
              <div className="rounded-xl bg-slate-900/80 border border-white/10 p-8">
                <div className="flex flex-col items-center justify-center h-80">
                  <div className="w-48 h-64 rounded-lg bg-white shadow-2xl shadow-black/40 mb-4 flex items-center justify-center">
                    <div className="text-center p-6">
                      <div className="text-4xl mb-2">{selectedMarketData?.flag}</div>
                      <div className="text-xs text-slate-600 font-semibold mb-1">{selectedPilData?.product}</div>
                      <div className="text-[8px] text-slate-400">Patient Information Leaflet</div>
                      <div className="mt-4 space-y-1">
                        {[...Array(8)].map((_, i) => (
                          <div key={i} className="h-1 bg-slate-200 rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="text-center">
                    <p className="text-sm text-slate-300 font-medium">AW-Draft-{selectedMarket}-2024-01-15.pdf</p>
                    <p className="text-xs text-slate-500 mt-1">Ready for InDesign refinement</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Template Details */}
            <div className="rounded-2xl bg-slate-800/50 border border-white/[0.06] p-6 shadow-lg shadow-black/20">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <span>🎨</span>
                Applied Template Configuration
              </h3>
              <div className="space-y-3 text-xs">
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Section Ordering</span>
                  <span className="text-white font-medium">
                    {selectedMarket === 'taiwan_tfda' ? 'TFDA Standard (12 sections)' : 'Thai FDA Standard (13 sections)'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Font Family</span>
                  <span className="text-white font-medium">
                    {selectedMarket === 'taiwan_tfda' ? 'Noto Sans TC' : 'Noto Sans Thai'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Paper Dimensions</span>
                  <span className="text-white font-medium">
                    {selectedDiecut ? selectedDiecutData?.dims : '210mm × 297mm (A4)'}
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-slate-400">Regulatory Disclaimer</span>
                  <span className="text-white font-medium">
                    {selectedMarket === 'taiwan_tfda' ? '本藥須由醫師處方使用' : 'ยานี้ต้องใช้ตามใบสั่งแพทย์'}
                  </span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-slate-400">Emergency Contact</span>
                  <span className="text-white font-medium">
                    {selectedMarket === 'taiwan_tfda' ? '+886-2-1234-5678' : '+66-2-123-4567'}
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={handleDownload}
                className="rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white py-4 px-6 font-bold hover:from-violet-600 hover:to-purple-700 transition-all shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
              >
                📥 Download PDF
              </button>
              <button
                onClick={() => {
                  setActiveTab('setup');
                  setShowResult(false);
                  setProgress(0);
                }}
                className="rounded-xl bg-slate-700 text-white py-4 px-6 font-bold hover:bg-slate-600 transition-all"
              >
                🔄 Generate Another
              </button>
            </div>

            {/* Info */}
            <div className="rounded-xl bg-blue-500/10 border border-blue-400/20 p-4">
              <p className="text-xs text-blue-200/80 leading-relaxed">
                💡 <strong className="text-blue-100">Next Steps:</strong> Download the PDF and open it in Adobe InDesign for final refinement. 
                The generated artwork includes all mandatory sections, regulatory text, and emergency contacts formatted according to {selectedMarketData?.name} requirements. 
                AW Technicians can now focus on typography fine-tuning and spot color separation instead of manual layout creation.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}