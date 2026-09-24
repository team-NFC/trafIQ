import React from 'react';
import { ANPRCameraSummary } from '../../types/anpr';
import { Badge } from '../common/Badge';
import { ScanLine, VideoOff, Hash, Clock, CheckCircle } from 'lucide-react';

interface ANPRCameraCardProps {
  camera: ANPRCameraSummary;
  onSelectPlate?: (plate: string) => void;
}

export const ANPRCameraCard: React.FC<ANPRCameraCardProps> = ({ camera, onSelectPlate }) => {
  const isOffline = camera.status === 'OFFLINE';

  return (
    <div
      className={`rounded-xl border bg-[#0a0f1d] overflow-hidden flex flex-col transition-all ${
        isOffline ? 'border-slate-800/60 opacity-80' : 'border-purple-500/20 hover:border-purple-500/40'
      }`}
    >
      {/* Header */}
      <div className="px-4 py-3 bg-[#0d1326] border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="w-4 h-4 text-purple-400" />
          <span className="font-mono font-bold text-sm text-purple-300">
            {camera.name}
          </span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-xs font-medium text-slate-300 truncate max-w-[140px]">
            {camera.location}
          </span>
        </div>

        <Badge variant={camera.status.toLowerCase() as 'online' | 'offline' | 'processing'}>
          {camera.status}
        </Badge>
      </div>

      {/* Video Viewport / Offline Graphic */}
      <div className="relative aspect-video bg-[#050814] flex items-center justify-center overflow-hidden">
        {isOffline ? (
          <div className="flex flex-col items-center justify-center text-slate-400 p-4 text-center">
            <VideoOff className="w-8 h-8 mb-2 text-slate-400" />
            <span className="text-xs font-bold text-slate-400">CAMERA OFFLINE</span>
            <span className="text-[10px] text-slate-400">Video source unavailable</span>
          </div>
        ) : (
          <div className="w-full h-full relative flex items-center justify-center">
            {/* Grid raster */}
            <div
              className="absolute inset-0 opacity-15"
              style={{
                backgroundImage:
                  'linear-gradient(to right, #a855f7 1px, transparent 1px), linear-gradient(to bottom, #a855f7 1px, transparent 1px)',
                backgroundSize: '30px 30px'
              }}
            />

            {/* ANPR OCR Focus Targeting Brackets */}
            <div className="border border-purple-500/40 rounded-lg p-3 bg-purple-950/20 backdrop-blur flex flex-col items-center gap-1.5 shadow-lg shadow-purple-950/50">
              <span className="text-[10px] text-purple-300 uppercase tracking-widest font-mono font-semibold">
                ANPR OCR LOCK
              </span>
              <div
                onClick={() => onSelectPlate && camera.latestPlate !== 'N/A' && onSelectPlate(camera.latestPlate)}
                className="px-3 py-1 rounded bg-black/80 border-2 border-purple-400 font-mono font-black text-sm text-yellow-300 tracking-widest cursor-pointer hover:scale-105 transition"
                title="Click to search plate journey"
              >
                {camera.latestPlate}
              </div>
              <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                {(camera.latestConfidence * 100).toFixed(1)}% OCR CONF
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Footer */}
      <div className="p-3.5 bg-[#070b18] border-t border-slate-800/80 grid grid-cols-2 gap-2 text-xs">
        <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80">
          <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400 mb-0.5">
            <Hash className="w-3 h-3 text-purple-400" />
            <span>Tracked</span>
          </div>
          <span className="font-mono font-bold text-white text-sm">
            {isOffline ? 'N/A' : camera.vehiclesTracked}
          </span>
        </div>

        <div className="p-2 rounded bg-slate-900/90 border border-slate-800/80">
          <div className="flex items-center gap-1 text-[10px] uppercase font-semibold text-slate-400 mb-0.5">
            <Clock className="w-3 h-3 text-cyan-400" />
            <span>Latest Time</span>
          </div>
          <span className="font-mono font-bold text-cyan-300 text-xs">
            {isOffline ? 'N/A' : camera.latestDetectionTime}
          </span>
        </div>
      </div>
    </div>
  );
};
