import React, { useState } from 'react';
import { CameraFeed } from '../../types/camera';
import { Badge } from '../common/Badge';
import { Maximize2, VideoOff, Activity, AlertTriangle } from 'lucide-react';

interface CameraCardProps {
  camera: CameraFeed;
  onFocus?: (camId: string) => void;
  isFocused?: boolean;
}

export const CameraCard: React.FC<CameraCardProps> = ({ camera, onFocus, isFocused }) => {
  const [retryKey, setRetryKey] = useState(0);
  const isHardOffline = camera.status === 'OFFLINE';
  const hasAmbulance = camera.hasAmbulance;

  const getBorderClass = () => {
    if (hasAmbulance) return 'emergency-pulse border-red-500/80 bg-red-950/10';
    if (isFocused) return 'border-cyan-500/70 shadow-lg shadow-cyan-950/40';
    return 'border-slate-800/90 hover:border-slate-700/80';
  };

  const streamBase = camera.streamUrl || `http://127.0.0.1:8000/api/video/camera/${camera.id}`;
  const streamSrc = retryKey > 0 ? `${streamBase}?r=${retryKey}` : streamBase;

  const handleStreamError = () => {
    // Schedule a silent retry in 2 seconds without permanently toggling offline
    setTimeout(() => {
      setRetryKey((prev) => prev + 1);
    }, 2000);
  };

  return (
    <div
      className={`rounded-xl border bg-[#0a0f1d] overflow-hidden flex flex-col transition-all duration-200 ${getBorderClass()}`}
    >
      {/* Card Header */}
      <div className="px-4 py-3 bg-[#0d1424] border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="font-mono font-bold text-sm text-cyan-300">
            {camera.name}
          </span>
          <span className="text-slate-400 text-xs">|</span>
          <span className="text-xs font-semibold text-slate-300">
            {camera.approach}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasAmbulance && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-red-600 text-white animate-pulse">
              <AlertTriangle className="w-3 h-3" />
              AMBULANCE
            </span>
          )}

          {/* Honest source labeling: RECORDED CCTV */}
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800/60">
            {camera.sourceType || 'RECORDED CCTV'}
          </span>

          <Badge variant={isHardOffline ? 'offline' : 'online'}>
            {isHardOffline ? 'OFFLINE' : 'ONLINE'}
          </Badge>

          {onFocus && (
            <button
              onClick={() => onFocus(camera.id)}
              className="text-slate-400 hover:text-cyan-300 p-1 rounded hover:bg-slate-800 transition cursor-pointer"
              title={isFocused ? 'Back to Grid View' : 'Focus Camera'}
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Video Viewport: Real OpenCV Streaming Feed */}
      <div className="relative aspect-video bg-[#040711] overflow-hidden flex items-center justify-center">
        {isHardOffline ? (
          <div className="flex flex-col items-center justify-center text-slate-400 p-6 text-center">
            <VideoOff className="w-10 h-10 mb-2 text-slate-500" />
            <span className="text-xs font-bold text-slate-300">CAMERA OFFLINE</span>
            <span className="text-[10px] text-slate-400 mt-0.5">Video stream unavailable</span>
          </div>
        ) : (
          <div className="w-full h-full relative">
            {/* Real Video Stream from FastAPI */}
            <img
              src={streamSrc}
              alt={`${camera.name} CCTV Stream`}
              className="w-full h-full object-cover"
              onError={handleStreamError}
            />

            {/* Corner Viewport HUD Indicators */}
            <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur border border-white/10 text-[10px] font-mono text-cyan-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              <span>REC ● {camera.fps > 0 ? `${camera.fps} FPS` : '24 FPS'}</span>
            </div>

            <div className="absolute bottom-2 left-2 z-20 px-2 py-0.5 rounded bg-black/75 backdrop-blur border border-white/10 text-[10px] font-mono text-slate-300">
              RECORDED CCTV
            </div>

            <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded bg-black/75 backdrop-blur border border-white/10 text-[10px] font-mono text-slate-300">
              {camera.resolution || '1920x1080'}
            </div>
          </div>
        )}
      </div>

      {/* Vehicle Classification Counters - NO FAKE DATA */}
      <div className="p-3 bg-[#080d1a] border-t border-slate-800/80">
        {camera.counts ? (
          <div className="grid grid-cols-4 gap-2 text-center text-xs">
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cars</span>
              <span className="font-mono font-bold text-slate-200 text-sm">{camera.counts.cars}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Bikes</span>
              <span className="font-mono font-bold text-slate-200 text-sm">{camera.counts.motorcycles}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Buses</span>
              <span className="font-mono font-bold text-slate-200 text-sm">{camera.counts.buses}</span>
            </div>
            <div className="p-1.5 rounded bg-slate-900/80 border border-slate-800/60">
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Trucks</span>
              <span className="font-mono font-bold text-slate-200 text-sm">{camera.counts.trucks}</span>
            </div>
          </div>
        ) : (
          <div className="py-1.5 flex items-center justify-center gap-2 text-slate-400 text-xs">
            <Activity className="w-3.5 h-3.5 text-cyan-400/60 animate-pulse" />
            <span className="text-[11px] font-medium text-slate-400">Waiting for traffic analysis...</span>
          </div>
        )}
      </div>

      {/* Traffic Density & Queue Metrics - NO FAKE DATA */}
      <div className="px-4 py-2.5 bg-[#060a14] border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
        <span className="text-[11px] font-medium text-slate-400">Approach Density & Queue</span>
        <span className="font-mono text-[11px] text-slate-400 italic">
          {camera.density !== null && camera.density !== undefined ? `${camera.density}%` : 'Waiting for data'}
        </span>
      </div>
    </div>
  );
};
