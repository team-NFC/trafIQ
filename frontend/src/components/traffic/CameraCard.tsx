import React, { useState } from 'react';
import { CameraItem } from '../../api/godview';
import { apiClient } from '../../api/client';
import {
  Compass,
  MapPin,
  Maximize2,
  VideoOff,
  AlertTriangle,
  Car
} from 'lucide-react';

interface CameraCardProps {
  camera: CameraItem;
  junctionName?: string;
  onSelect: (cam: CameraItem) => void;
  isFocused?: boolean;
}

export const CameraCard: React.FC<CameraCardProps> = ({
  camera,
  junctionName,
  onSelect,
  isFocused
}) => {
  const [streamError, setStreamError] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const baseUrl = apiClient.getVideoBaseUrl();
  const isEmergency = Boolean(camera.is_ambulance);
  const isOffline = camera.status === 'OFFLINE';
  const isMissingNode = camera.status === 'MISSING_NODE' || Boolean(camera.is_missing);

  // Real MJPEG video stream from FastAPI backend
  const streamSrc = `${baseUrl}/api/video/camera/${camera.id}${retryNonce > 0 ? `?r=${retryNonce}` : ''}`;

  const handleStreamError = () => {
    setStreamError(true);
    // Silent automatic reconnect attempt after 3s
    setTimeout(() => {
      setRetryNonce((prev) => prev + 1);
      setStreamError(false);
    }, 3000);
  };

  // Signal badge styling
  const getSignalBadge = (sig: string) => {
    switch (sig?.toUpperCase()) {
      case 'GREEN':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            GREEN
          </span>
        );
      case 'YELLOW':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            YELLOW
          </span>
        );
      case 'RED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            RED
          </span>
        );
      case 'UNMONITORED':
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
            UNMONITORED
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-white/[0.05] text-neutral-300 border border-white/[0.1]">
            {sig || 'STANDBY'}
          </span>
        );
    }
  };

  const getCameraGroup = (c: CameraItem): string => {
    if (c.group) return c.group.toUpperCase();
    const id = c.id.toUpperCase();
    if (['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'].includes(id)) return 'NORMAL';
    if (['CAM-05', 'CAM-06', 'CAM-07', 'CAM-08'].includes(id)) return 'AMBULANCE';
    if (['CAM-09', 'CAM-10', 'CAM-11', 'CAM-12', 'CAM-13', 'CAM-14', 'CAM-15', 'CAM-16'].includes(id)) return 'ANPR';
    if (c.is_ambulance) return 'AMBULANCE';
    if (c.camera_type === 'ANPR') return 'ANPR';
    return 'NORMAL';
  };

  const cameraGroup = getCameraGroup(camera);
  const hasAnalysis = camera.has_analysis === true || (camera.count !== null && camera.count !== undefined && camera.status !== 'ANALYSIS PENDING');

  const getGroupBadge = (grp: string) => {
    switch (grp) {
      case 'NORMAL':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
            NORMAL
          </span>
        );
      case 'AMBULANCE':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-rose-500/15 text-rose-300 border border-rose-500/30 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
            AMBULANCE
          </span>
        );
      case 'ANPR':
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/15 text-purple-300 border border-purple-500/30">
            ANPR
          </span>
        );
      default:
        return (
          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {grp}
          </span>
        );
    }
  };

  return (
    <div
      onClick={() => onSelect(camera)}
      className={`group relative rounded-xl overflow-hidden border transition-all duration-200 cursor-pointer flex flex-col ${
        isEmergency
          ? 'border-rose-500/50 bg-[#12090d] shadow-lg shadow-rose-950/20 ring-1 ring-rose-500/30'
          : isFocused
          ? 'border-white/30 bg-[#0d121c] ring-1 ring-white/20 shadow-xl'
          : 'border-white/[0.08] bg-[#090d16] hover:border-white/[0.18] hover:bg-[#0c111d] shadow-md shadow-black/40'
      }`}
    >
      {/* Top Header Bar */}
      <div className="px-3.5 py-2.5 bg-black/40 border-b border-white/[0.06] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-sm text-white tracking-wide shrink-0">
            {camera.id}
          </span>
          <span className="text-white/20 text-xs shrink-0">|</span>
          <span className="text-xs font-medium text-neutral-300 truncate" title={camera.name}>
            {camera.name}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Group Badge */}
          {getGroupBadge(cameraGroup)}

          {/* Direction Badge */}
          {camera.direction && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold bg-white/[0.04] text-neutral-300 border border-white/[0.08] flex items-center gap-1">
              <Compass className="w-2.5 h-2.5 text-neutral-400" />
              {camera.direction}
            </span>
          )}

          {/* Status Badge */}
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold border ${
              isOffline
                ? 'bg-neutral-800 text-neutral-400 border-neutral-700'
                : isMissingNode
                ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}
          >
            {camera.status || 'ONLINE'}
          </span>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onSelect(camera);
            }}
            className="p-1 rounded text-neutral-400 hover:text-white hover:bg-white/[0.08] transition"
            title="Focus Camera"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Video Stream Viewport */}
      <div className="relative aspect-video bg-[#04060a] overflow-hidden flex items-center justify-center">
        {camera.is_multi_camera && camera.sub_cameras && camera.sub_cameras.length > 0 ? (
          <div className="w-full h-full grid grid-cols-2 gap-1 p-1 bg-black">
            {camera.sub_cameras.map((subCam) => {
              const subStreamUrl = `${baseUrl}/api/video/camera/${subCam.id}${retryNonce > 0 ? `?r=${retryNonce}` : ''}`;
              return (
                <div key={subCam.id} className="relative w-full h-full bg-[#080d16] rounded overflow-hidden border border-white/10 flex flex-col justify-between">
                  {subCam.has_video ? (
                    <img
                      src={subStreamUrl}
                      alt={subCam.name}
                      className="w-full h-full object-cover select-none"
                      onError={handleStreamError}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-neutral-400 p-2 text-center bg-black/60">
                      <VideoOff className="w-5 h-5 text-neutral-600 mb-1" />
                      <span className="text-[9px] font-mono font-bold text-neutral-300">VIDEO UNAVAILABLE</span>
                    </div>
                  )}

                  {/* Top overlay */}
                  <div className="absolute top-1 left-1 right-1 flex items-center justify-between pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-mono font-bold text-white border border-white/15">
                      {subCam.id}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 backdrop-blur-md text-[9px] font-mono font-semibold text-cyan-300 border border-cyan-500/30">
                      {subCam.distance_m}m
                    </span>
                  </div>

                  {/* Bottom overlay */}
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-md text-[9px] font-mono text-neutral-300 border border-white/10 pointer-events-none">
                    <span>Vehicles: <strong className="text-emerald-400 font-bold">{subCam.count}</strong></span>
                    <span>Q: <strong className="text-amber-400 font-bold">{subCam.queue}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : isOffline || streamError ? (
          <div className="flex flex-col items-center justify-center text-neutral-400 p-4 text-center space-y-1">
            <VideoOff className="w-8 h-8 text-neutral-600 mb-1" />
            <span className="text-xs font-mono font-bold text-neutral-300 uppercase tracking-wider">
              {isOffline ? 'CAMERA OFFLINE' : 'VIDEO UNAVAILABLE'}
            </span>
            <span className="text-[10px] text-neutral-500">
              {isOffline ? 'Feed temporarily inactive' : 'Video source file missing or offline'}
            </span>
          </div>
        ) : (
          <div className="w-full h-full relative">
            <img
              src={streamSrc}
              alt={`${camera.name} Live CCTV`}
              className="w-full h-full object-cover select-none"
              onError={handleStreamError}
            />

            {/* Viewport HUD Overlays */}
            <div className="absolute top-2 left-2 z-10 flex items-center gap-1.5 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-neutral-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              <span>REC ● 24 FPS</span>
            </div>

            <div className="absolute bottom-2 left-2 z-10 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-neutral-300">
              RECORDED CCTV
            </div>

            <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 rounded bg-black/75 backdrop-blur-md border border-white/10 text-[10px] font-mono text-neutral-400">
              1920x1080
            </div>

            {/* Subtle Emergency Banner on Video */}
            {isEmergency && (
              <div className="absolute top-2 right-2 z-10 px-2.5 py-0.5 rounded bg-rose-950/85 backdrop-blur-md border border-rose-500/40 text-[10px] font-mono font-bold text-rose-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                <span>Ambulance Detected</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Card Info & Metrics Footer */}
      <div className="p-3 bg-black/30 border-t border-white/[0.06] space-y-2 text-xs">
        {/* Exact Configured GPS Location (Strict Unsnapped Coordinates) */}
        <div className="flex items-center justify-between gap-2 text-neutral-400">
          <div className="flex items-center gap-1.5 min-w-0" title="Configured GPS Location">
            <MapPin className="w-3 h-3 text-neutral-500 shrink-0" />
            <span className="font-mono text-[11px] text-neutral-300 font-semibold tracking-tight">
              {Number(camera.latitude).toFixed(6)}, {Number(camera.longitude).toFixed(6)}
            </span>
          </div>

          <div className="text-[11px] text-neutral-400 truncate max-w-[140px] text-right font-mono" title={junctionName || camera.zone}>
            {junctionName ? junctionName : `Group: ${cameraGroup}`}
          </div>
        </div>

        {/* ANPR Plate & Traffic Counters */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/[0.04]">
          <div className="flex items-center gap-2">
            {camera.plate ? (
              <span className="px-2 py-0.5 rounded font-mono text-[10px] font-bold bg-white/[0.05] text-neutral-200 border border-white/[0.1] flex items-center gap-1">
                <Car className="w-3 h-3 text-neutral-400" />
                {camera.plate}
              </span>
            ) : cameraGroup === 'ANPR' ? (
              <span className="text-[10px] font-mono text-purple-300/80">ANPR ACTIVE</span>
            ) : null}

            {getSignalBadge(camera.signal)}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-400">
            {hasAnalysis ? (
              <>
                <span>
                  Vehicles: <strong className="text-white font-bold">{camera.count}</strong>
                </span>
                <span className="text-white/20">|</span>
                <span>
                  Q: <strong className="text-neutral-300">{camera.queue ?? 0}</strong>
                </span>
                <span className="text-white/20">|</span>
                <span>
                  PCU: <strong className="text-neutral-300">{camera.pcu !== undefined && camera.pcu !== null ? Number(camera.pcu).toFixed(1) : (camera.count ? (camera.count * 1.15).toFixed(1) : '0.0')}</strong>
                </span>
              </>
            ) : (
              <span className="text-neutral-400 italic text-[11px] font-sans">
                Analysis unavailable
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
