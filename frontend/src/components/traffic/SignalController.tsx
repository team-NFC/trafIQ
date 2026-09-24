import React from 'react';
import { SignalState, SignalMode } from '../../types/signal';
import { TrafficCone, AlertTriangle, ShieldCheck, Activity } from 'lucide-react';

interface SignalControllerProps {
  signalState?: SignalState | null;
  onToggleMode?: (mode: SignalMode) => void;
}

export const SignalController: React.FC<SignalControllerProps> = ({
  signalState,
  onToggleMode,
}) => {
  if (!signalState) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-3">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <TrafficCone className="w-4 h-4 text-amber-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Signal Control & Junction Phase
          </h3>
        </div>
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
          <Activity className="w-5 h-5 text-amber-400/60 animate-pulse" />
          <span className="text-xs font-mono font-bold text-slate-300 uppercase">
            Signal state unavailable
          </span>
          <span className="text-[11px] text-slate-500">
            Awaiting connection to real Python signal controller API (Webster / dynamic phase)
          </span>
        </div>
      </div>
    );
  }

  const isAmbulanceMode = signalState.mode === 'AMBULANCE_PRIORITY';

  const getSignalColor = (state: string) => {
    switch (state) {
      case 'GREEN':
        return 'bg-emerald-500 shadow-emerald-500/50 shadow-md text-white';
      case 'YELLOW':
        return 'bg-amber-500 shadow-amber-500/50 shadow-md text-black';
      case 'RED':
      default:
        return 'bg-rose-600 shadow-rose-600/50 shadow-md text-white';
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-4">
      {/* Header & Mode Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div>
          <div className="flex items-center gap-2">
            <TrafficCone className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Signal Control & Junction Phase
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Current Phase: <strong className="text-white font-mono">{signalState.currentGreenCam} (GREEN)</strong> | Remaining: <strong className="text-cyan-400 font-mono">{signalState.remainingSeconds}s</strong>
          </span>
        </div>

        {/* Mode switch */}
        {onToggleMode && (
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => onToggleMode('NORMAL')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                !isAmbulanceMode
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>NORMAL</span>
            </button>

            <button
              onClick={() => onToggleMode('AMBULANCE_PRIORITY')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                isAmbulanceMode
                  ? 'bg-red-600 text-white shadow-md shadow-red-950 animate-pulse'
                  : 'text-slate-400 hover:text-red-400'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>AMBULANCE PRIORITY</span>
            </button>
          </div>
        )}
      </div>

      {/* 4 Approach Signals */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {signalState.approaches.map((app) => (
          <div
            key={app.cameraId}
            className={`p-3.5 rounded-lg border flex flex-col items-center justify-between gap-3 text-center transition-all ${
              app.isPriority
                ? 'border-red-500/80 bg-red-950/20 emergency-pulse'
                : 'border-slate-800 bg-slate-900/60'
            }`}
          >
            <div>
              <span className="font-mono font-bold text-xs text-slate-200 block">
                {app.name}
              </span>
              <span className="text-[11px] text-slate-400">{app.approach}</span>
            </div>

            {/* Traffic Signal Light Fixture */}
            <div className="w-10 py-2.5 px-2 rounded-full bg-[#050811] border border-slate-700/80 flex flex-col items-center gap-2 shadow-inner">
              <div
                className={`w-5 h-5 rounded-full transition-all ${
                  app.state === 'RED'
                    ? 'bg-rose-500 shadow-md shadow-rose-500/80 scale-110'
                    : 'bg-rose-950/40 opacity-30'
                }`}
              />
              <div
                className={`w-5 h-5 rounded-full transition-all ${
                  app.state === 'YELLOW'
                    ? 'bg-amber-400 shadow-md shadow-amber-400/80 scale-110'
                    : 'bg-amber-950/40 opacity-30'
                }`}
              />
              <div
                className={`w-5 h-5 rounded-full transition-all ${
                  app.state === 'GREEN'
                    ? 'bg-emerald-400 shadow-md shadow-emerald-400/80 scale-110'
                    : 'bg-emerald-950/40 opacity-30'
                }`}
              />
            </div>

            <div className="w-full">
              <span
                className={`w-full py-1 rounded text-[11px] font-mono font-bold block ${getSignalColor(
                  app.state
                )}`}
              >
                {app.isPriority ? 'PRIORITY GREEN' : app.state}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
