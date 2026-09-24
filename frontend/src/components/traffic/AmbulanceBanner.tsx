import React from 'react';
import { AlertTriangle, Siren, CheckCircle2, ShieldCheck } from 'lucide-react';

interface AmbulanceBannerProps {
  active: boolean;
  cameraName?: string;
  approach?: string;
  confidence?: number;
  remainingSeconds?: number;
  onClearPriority?: () => void;
}

export const AmbulanceBanner: React.FC<AmbulanceBannerProps> = ({
  active,
  cameraName = 'CAM 03',
  approach = 'South Approach',
  confidence = 0.96,
  remainingSeconds = 24,
  onClearPriority
}) => {
  if (!active) {
    return (
      <div className="rounded-xl border border-slate-800/80 bg-[#0a0f1d] px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span className="text-xs font-mono font-bold tracking-wider text-emerald-300">
            NO ACTIVE EMERGENCY
          </span>
          <span className="text-slate-600 text-xs hidden sm:inline">|</span>
          <span className="text-xs text-slate-400 hidden sm:inline">
            Junction operating under standard cyclic phase coordination
          </span>
        </div>
        <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-950/60 border border-emerald-800/40 text-emerald-300">
          MONITORING
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl border-2 border-red-500/80 bg-gradient-to-r from-red-950/90 via-red-900/50 to-red-950/90 p-4 shadow-xl shadow-red-950/60 emergency-pulse">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-red-600 flex items-center justify-center text-white shadow-lg shadow-red-600/50 shrink-0 animate-bounce">
            <Siren className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-red-300 font-extrabold text-sm sm:text-base tracking-wider uppercase flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                EMERGENCY AMBULANCE DETECTED
              </span>
              <span className="px-2 py-0.5 rounded bg-red-500 text-white font-mono text-[10px] font-bold">
                PRIORITY ACTIVE
              </span>
            </div>

            <p className="text-xs text-red-200 mt-1">
              Approaching on <strong className="text-white font-mono">{cameraName} ({approach})</strong> with{' '}
              <strong className="text-white font-mono">{(confidence * 100).toFixed(0)}% OCR/YOLO confidence</strong>.
              Emergency green corridor engaged.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-2 md:pt-0 border-red-800/60">
          <div className="text-right">
            <span className="text-[10px] text-red-300 uppercase font-semibold block">Clearance Window</span>
            <span className="font-mono text-xl font-extrabold text-white">{remainingSeconds}s</span>
          </div>

          {onClearPriority && (
            <button
              onClick={onClearPriority}
              className="px-3.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition cursor-pointer shadow-md flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Resume Normal Cycle</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
