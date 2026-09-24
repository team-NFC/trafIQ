import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { signalService } from '../api/signals';
import { SignalState } from '../types/signal';
import { SignalController } from '../components/traffic/SignalController';
import { AmbulanceBanner } from '../components/traffic/AmbulanceBanner';
import { TrafficCone, ShieldCheck, AlertTriangle, RefreshCw } from 'lucide-react';

export const SignalControlPage: React.FC = () => {
  const { isDemoMode, signalMode, setSignalMode } = useApp();
  const [signalState, setSignalState] = useState<SignalState | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchSignals = async () => {
    setLoading(true);
    const res = await signalService.getSignalState(signalMode);
    if (res.data) setSignalState(res.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchSignals();
  }, [isDemoMode, signalMode]);

  const isAmbulanceActive = signalMode === 'AMBULANCE_PRIORITY';

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <TrafficCone className="w-5 h-5 text-amber-400" />
            <span>SIGNAL CONTROL & INTERSECTION PREEMPTION</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Phase coordination and emergency vehicle preemption (EVP) green corridor manager
          </p>
        </div>

        <button
          onClick={fetchSignals}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync State</span>
        </button>
      </div>

      {/* Emergency Ambulance Preemption Alert Banner */}
      <AmbulanceBanner
        active={isAmbulanceActive}
        cameraName="CAM 03"
        approach="South Approach"
        confidence={0.96}
        remainingSeconds={signalState?.remainingSeconds || 24}
        onClearPriority={() => setSignalMode('NORMAL')}
      />

      {/* Main Signal Display */}
      {signalState && (
        <SignalController
          signalState={signalState}
          onToggleMode={(mode) => setSignalMode(mode)}
        />
      )}

      {/* Situation Detail Comparative Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Situation 1: Normal Signal Card */}
        <div
          className={`p-5 rounded-xl border transition-all ${
            !isAmbulanceActive
              ? 'border-cyan-500/50 bg-[#0a1226] shadow-lg shadow-cyan-950/40'
              : 'border-slate-800 bg-[#0a0f1d] opacity-75'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Situation 1: Normal Fixed Cycle
              </h3>
            </div>
            {!isAmbulanceActive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                ACTIVE PHASE
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            Under normal conditions, traffic cycles continuously through all four approaches in an equal, fixed-time sequence.
            Enforces a guaranteed 4.0-second yellow transition buffer to eliminate dilemma zones.
          </p>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">Active Sequence:</span>
              <span className="text-cyan-300 font-bold">CAM01 ➔ CAM02 ➔ CAM03 ➔ CAM04</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">Green Window per Approach:</span>
              <span className="text-white">25.0 seconds</span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">All-Red Safety Clearance:</span>
              <span className="text-white">2.0 seconds</span>
            </div>
          </div>
        </div>

        {/* Situation 2: Ambulance Priority Card */}
        <div
          className={`p-5 rounded-xl border transition-all ${
            isAmbulanceActive
              ? 'border-red-500/80 bg-red-950/20 emergency-pulse shadow-xl shadow-red-950/50'
              : 'border-slate-800 bg-[#0a0f1d] opacity-75'
          }`}
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Situation 2: Ambulance Priority (EVP)
              </h3>
            </div>
            {isAmbulanceActive && (
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600 text-white animate-pulse">
                EMERGENCY OVERRIDE
              </span>
            )}
          </div>

          <p className="text-xs text-slate-300 leading-relaxed mb-4">
            When YOLO detects an emergency vehicle approaching, the controller suspends the normal fixed cycle.
            It safely terminates the current green with a controlled yellow clearance and engages a Priority Green Corridor on the ambulance approach.
          </p>

          <div className="space-y-2 font-mono text-xs">
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">Corridor Status:</span>
              <span className={isAmbulanceActive ? 'text-red-400 font-bold' : 'text-slate-500'}>
                {isAmbulanceActive ? 'CAM 03 (SOUTH) GREEN CORRIDOR' : 'Standby (No Emergency)'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">Cross-Traffic Approaches:</span>
              <span className={isAmbulanceActive ? 'text-rose-400 font-bold' : 'text-slate-500'}>
                {isAmbulanceActive ? 'HELD AT RED' : 'Normal Rotation'}
              </span>
            </div>
            <div className="p-2.5 rounded bg-slate-950/80 border border-slate-800 flex items-center justify-between">
              <span className="text-slate-400 font-sans">Recovery Protocol:</span>
              <span className="text-white font-sans">Seamless transition to next pending phase</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
