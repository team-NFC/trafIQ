import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../api/client';
import { Settings, Cpu, Server, Shield, CheckCircle2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { isDemoMode, setDemoMode } = useApp();
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());
  const [savedNotice, setSavedNotice] = useState(false);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setBaseUrl(apiUrl);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          <span>SYSTEM CONFIGURATION & HARDWARE SETTINGS</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Backend endpoint bindings, simulation toggles, and workstation telemetry
        </p>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      {/* Demo Mode / Live Backend Toggle */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Telemetry Data Mode</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
              Toggle between offline hackathon demonstration data and live Python FastAPI backend streams.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDemoMode(!isDemoMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-2 ${
              isDemoMode
                ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                : 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-purple-400' : 'bg-emerald-400'} animate-pulse`} />
            <span>{isDemoMode ? 'MODE: DEMO SIMULATION' : 'MODE: LIVE BACKEND API'}</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
          <strong>Data Policy:</strong> TrafficIQ never manufactures synthetic production alerts. When connected to live backend APIs, all values strictly reflect the OpenCV/YOLO inference results from Python.
        </div>
      </div>

      {/* Backend API Endpoint Configuration */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>FastAPI Server Endpoint</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Local or network URL for the TrafficIQ Python service
          </p>
        </div>

        <form onSubmit={handleSaveUrl} className="flex gap-3">
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="flex-1 h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
            placeholder="http://localhost:8000"
          />
          <button
            type="submit"
            className="px-5 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer shadow-md"
          >
            Save URL
          </button>
        </form>
      </div>

      {/* Workstation Hardware Specifications (System Resources) */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3.5">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>System Resources & Host Environment</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Hardware acceleration profiles verified on this workstation
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Inference GPU</span>
            <span className="font-bold text-white text-xs block">NVIDIA RTX 3050 Laptop</span>
            <span className="text-[10px] text-emerald-400 font-mono">CUDA 12.4 • 4GB VRAM</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Host Python</span>
            <span className="font-bold text-white text-xs block">Python 3.12.10</span>
            <span className="text-[10px] text-cyan-400 font-mono">PyTorch 2.6.0+cu124</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Computer Vision</span>
            <span className="font-bold text-white text-xs block">OpenCV 4.10.0</span>
            <span className="text-[10px] text-purple-400 font-mono">DirectShow UVC Capture</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">AI Engine</span>
            <span className="font-bold text-white text-xs block">Ultralytics YOLOv8</span>
            <span className="text-[10px] text-amber-400 font-mono">Custom 5-Class Weights</span>
          </div>
        </div>
      </div>
    </div>
  );
};
