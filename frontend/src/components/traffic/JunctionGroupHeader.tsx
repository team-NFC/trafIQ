import React from 'react';
import { JunctionItem, CameraItem } from '../../api/godview';
import { SignalState } from '../../types/signal';
import {
  MapPin,
  Layers,
  Clock
} from 'lucide-react';

interface JunctionGroupHeaderProps {
  junction: JunctionItem;
  associatedCameras: CameraItem[];
  signalState: SignalState | null;
  ambulanceActive: boolean;
  ambulanceCamera?: string;
  onSelectCamera: (cam: CameraItem) => void;
  onClearJunctionFilter: () => void;
}

export const JunctionGroupHeader: React.FC<JunctionGroupHeaderProps> = ({
  junction,
  associatedCameras,
  signalState,
  ambulanceActive,
  ambulanceCamera,
  onSelectCamera,
  onClearJunctionFilter,
}) => {
  const isEmergency = ambulanceActive && associatedCameras.some((c) => c.is_ambulance || c.id === ambulanceCamera);

  return (
    <div
      className={`rounded-xl border p-4 space-y-3.5 transition-all duration-200 backdrop-blur-md ${
        isEmergency
          ? 'border-rose-500/50 bg-[#140a0e]/80 shadow-lg shadow-rose-950/20'
          : 'border-white/[0.08] bg-black/40 shadow-md'
      }`}
    >
      {/* Top Title & Metadata */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-white/[0.06] pb-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/[0.06] text-white flex items-center justify-center border border-white/[0.1]">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white tracking-wide">{junction.name}</h3>
                <span className="px-2 py-0.2 rounded font-mono text-[10px] font-bold bg-white/[0.06] text-neutral-300 border border-white/[0.1]">
                  {associatedCameras.length} CAMERAS
                </span>
                {isEmergency && (
                  <span className="px-2 py-0.2 rounded font-mono text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse">
                    EMERGENCY ACTIVE
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-[11px] text-neutral-400 mt-0.5">
                <MapPin className="w-3 h-3 text-neutral-500" />
                <span className="font-mono text-neutral-300">
                  {junction.latitude.toFixed(6)}° N, {junction.longitude.toFixed(6)}° E
                </span>
                <span className="text-white/20">•</span>
                <span>{junction.description || 'Coordinated Adaptive Arterial Junction'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear filter / Show All */}
        <button
          onClick={onClearJunctionFilter}
          className="self-start md:self-auto px-2.5 py-1 rounded-lg text-xs font-medium text-neutral-400 hover:text-white bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition cursor-pointer"
        >
          View All System Cameras
        </button>
      </div>

      {/* Associated Camera Pills */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-mono text-neutral-400 uppercase">Junction Feeds:</span>
        {associatedCameras.map((cam) => {
          const camEmergency = Boolean(cam.is_ambulance);
          return (
            <button
              key={cam.id}
              onClick={() => onSelectCamera(cam)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 border ${
                camEmergency
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                  : 'bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
              }`}
            >
              {camEmergency && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
              <span>{cam.id}</span>
              <span className="text-[10px] text-neutral-400 font-sans">({cam.direction || 'Approach'})</span>
            </button>
          );
        })}
      </div>

      {/* Real-time Junction Signal & Telemetry Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
        <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">Signal Mode</span>
          <span className={`font-mono font-bold text-xs ${isEmergency ? 'text-rose-400' : 'text-emerald-400'}`}>
            {isEmergency ? 'EVP PREEMPTION ACTIVE' : (signalState?.mode || 'ADAPTIVE CYCLE')}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">Active Phase Approach</span>
          <span className="font-mono font-bold text-xs text-white">
            {signalState?.currentGreenCam || 'CAM 01 (North)'}
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">Phase Clearance Timer</span>
          <span className="font-mono font-bold text-xs text-neutral-200 flex items-center gap-1">
            <Clock className="w-3 h-3 text-neutral-400" />
            {signalState?.remainingSeconds ?? 14}s remaining
          </span>
        </div>

        <div className="p-2.5 rounded-lg bg-black/30 border border-white/[0.04]">
          <span className="text-[10px] font-mono text-neutral-400 uppercase block">Combined Demand</span>
          <span className="font-mono font-bold text-xs text-white">
            {junction.combined_count} veh | {junction.combined_pcu} PCU
          </span>
        </div>
      </div>
    </div>
  );
};
