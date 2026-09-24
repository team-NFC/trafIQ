import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../api/client';
import { Clock, Calendar, Activity } from 'lucide-react';

export const Header: React.FC = () => {
  const { systemTime, systemDate } = useApp();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const verifyBackend = async () => {
      const isOnline = await apiClient.checkHealth();
      if (isMounted) {
        setBackendOnline(isOnline);
      }
    };

    verifyBackend();
    const timer = setInterval(verifyBackend, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <header className="h-16 bg-[#080d1a]/95 backdrop-blur border-b border-slate-800/80 sticky top-0 z-20 px-6 flex items-center justify-between">
      {/* Title & System Brand */}
      <div className="flex items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-black tracking-wide text-white">
              TRAFFIC<span className="text-cyan-400">IQ</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 uppercase tracking-wider">
              Control Room
            </span>
          </div>
          <p className="text-xs text-slate-400 font-medium">
            AI Traffic Intelligence System
          </p>
        </div>
      </div>

      {/* Right Telemetry & Status Badges */}
      <div className="flex items-center gap-4">
        {/* Real Backend Verification Status */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold shadow-sm transition-all ${
            backendOnline
              ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300 shadow-emerald-950/50'
              : 'bg-rose-950/40 border-rose-500/30 text-rose-300 shadow-rose-950/50'
          }`}
        >
          <span className="relative flex h-2 w-2">
            {backendOnline && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex rounded-full h-2 w-2 ${
                backendOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
          </span>
          <span className="font-mono">
            Backend: {backendOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        {/* Real Video Pipeline Badge */}
        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs font-medium">
          <Activity className="w-3.5 h-3.5 text-cyan-400" />
          <span>Real CCTV Video Active</span>
        </div>

        {/* Dynamic Date & Time */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>{systemDate || 'Mon, Sep 21, 2026'}</span>
          </div>
          <span className="text-slate-700">|</span>
          <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
            <Clock className="w-3.5 h-3.5" />
            <span>{systemTime || '00:00:00'}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
