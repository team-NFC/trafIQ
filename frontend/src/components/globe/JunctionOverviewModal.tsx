import React, { useEffect, useState } from 'react';
import { JunctionDetailResponse, CameraItem, godViewService } from '../../api/godview';
import { apiClient } from '../../api/client';
import { useApp } from '../../context/AppContext';
import {
  X,
  ShieldAlert,
  Video,
  VideoOff,
  Loader2,
  BarChart3,
  Trash2,
  Clock,
  Radio
} from 'lucide-react';

interface JunctionOverviewModalProps {
  junctionId: string | null;
  onClose: () => void;
  onSelectCamera: (camera: CameraItem) => void;
  onDeleteJunction?: (junctionId: string) => void;
  activeScenario?: string;
}

const TrafficLightWidget: React.FC<{ signal: string }> = ({ signal }) => {
  const isRed = signal === 'RED' || signal === 'ALL RED';
  const isYellow = signal === 'YELLOW';
  const isGreen = signal === 'GREEN';

  return (
    <div className="flex items-center gap-1 bg-black/85 backdrop-blur-sm px-2 py-1 rounded-full border border-white/20 shadow-lg">
      <span
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          isRed ? 'bg-rose-500 shadow-[0_0_8px_#ef4444]' : 'bg-rose-950/60 opacity-40'
        }`}
        title="Red Light"
      />
      <span
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          isYellow ? 'bg-amber-400 shadow-[0_0_8px_#f59e0b]' : 'bg-amber-950/60 opacity-40'
        }`}
        title="Yellow Light"
      />
      <span
        className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
          isGreen ? 'bg-emerald-400 shadow-[0_0_8px_#10b981] animate-pulse' : 'bg-emerald-950/60 opacity-40'
        }`}
        title="Green Light"
      />
    </div>
  );
};

const SignalBadge: React.FC<{ signal?: string; timerSec?: number }> = ({ signal, timerSec }) => {
  switch (signal?.toUpperCase()) {
    case 'GREEN':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(16,185,129,0.3)] animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>GREEN {timerSec !== undefined ? `• ${timerSec}s` : ''}</span>
        </span>
      );
    case 'YELLOW':
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/50 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          <span>YELLOW {timerSec !== undefined ? `• ${timerSec}s` : ''}</span>
        </span>
      );
    case 'RED':
    case 'ALL RED':
    default:
      return (
        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-500/20 text-rose-400 border border-rose-500/40 flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
          <span>RED {timerSec !== undefined ? `• Wait ${timerSec}s` : ''}</span>
        </span>
      );
  }
};

interface JunctionCameraCardProps {
  cam: CameraItem;
  baseUrl: string;
  onSelect: () => void;
}

const JunctionCameraCard: React.FC<JunctionCameraCardProps> = ({ cam, baseUrl, onSelect }) => {
  const [streamFailed, setStreamFailed] = useState(false);
  const [snapshotFailed, setSnapshotFailed] = useState(false);
  const [snapshotNonce, setSnapshotNonce] = useState(0);

  const streamUrl = `${baseUrl}/api/video/camera/${cam.id}`;
  const frameUrl = `${baseUrl}/api/video/frame/${cam.id}?t=${snapshotNonce}`;

  useEffect(() => {
    setStreamFailed(false);
    setSnapshotFailed(false);
  }, [cam.id]);

  useEffect(() => {
    if (!streamFailed || snapshotFailed) return;
    const interval = setInterval(() => {
      setSnapshotNonce(n => n + 1);
    }, 1200);
    return () => clearInterval(interval);
  }, [streamFailed, snapshotFailed, cam.id]);

  const signal = cam.signal || 'RED';
  const timer = cam.timer ?? 0;
  const pcuDisplay = cam.pcu !== undefined ? cam.pcu : (cam.count ? (cam.count * 1.15).toFixed(1) : '0.0');

  return (
    <div
      onClick={onSelect}
      className={`group bg-slate-900/90 rounded-xl border overflow-hidden cursor-pointer transition shadow-md ${
        signal === 'GREEN'
          ? 'border-emerald-500/70 ring-1 ring-emerald-500/40'
          : signal === 'YELLOW'
          ? 'border-amber-400/70 ring-1 ring-amber-400/40'
          : 'border-white/10 hover:border-cyan-400/60'
      }`}
    >
      <div className="px-3 py-2 bg-slate-950 border-b border-white/5 flex items-center justify-between">
        <div className="font-mono font-bold text-xs text-white group-hover:text-cyan-300 transition-colors">
          {cam.id} • {cam.direction?.toUpperCase() || 'APPROACH'}
        </div>
        <SignalBadge signal={signal} timerSec={timer} />
      </div>

      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        {cam.is_multi_camera && cam.sub_cameras && cam.sub_cameras.length > 0 ? (
          <div className="w-full h-full grid grid-cols-2 gap-1 p-1 bg-black">
            {cam.sub_cameras.map((subCam) => {
              const subStreamUrl = `${baseUrl}/api/video/camera/${subCam.id}`;
              return (
                <div key={subCam.id} className="relative w-full h-full bg-slate-950 rounded overflow-hidden border border-white/10 flex flex-col justify-between">
                  {subCam.has_video ? (
                    <img
                      src={subStreamUrl}
                      alt={subCam.name}
                      className="w-full h-full object-cover select-none"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2 text-center bg-black/60">
                      <VideoOff className="w-5 h-5 text-slate-600 mb-1" />
                      <span className="text-[9px] font-mono font-bold text-slate-300">VIDEO UNAVAILABLE</span>
                    </div>
                  )}
                  <div className="absolute top-1 left-1 right-1 flex items-center justify-between pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono font-bold text-white border border-white/15">
                      {subCam.id}
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950/80 text-[9px] font-mono font-semibold text-cyan-300 border border-cyan-500/30">
                      {subCam.distance_m}m
                    </span>
                  </div>
                  <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between px-1.5 py-0.5 rounded bg-black/80 text-[9px] font-mono text-slate-300 border border-white/10 pointer-events-none">
                    <span>V: <strong className="text-emerald-400 font-bold">{subCam.count}</strong></span>
                    <span>Q: <strong className="text-amber-400 font-bold">{subCam.queue}</strong></span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : !streamFailed ? (
          <img
            src={streamUrl}
            alt={cam.name}
            onError={() => setStreamFailed(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="eager"
          />
        ) : !snapshotFailed ? (
          <img
            src={frameUrl}
            alt={cam.name}
            onError={() => setSnapshotFailed(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-1.5 text-slate-500 p-4 text-center">
            <VideoOff className="w-6 h-6 text-slate-600" />
            <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400">
              VIDEO SOURCE NOT AVAILABLE
            </span>
          </div>
        )}

        {/* Real-time 3-lamp traffic light widget on top-left */}
        <div className="absolute top-2 left-2 z-10">
          <TrafficLightWidget signal={signal} />
        </div>

        {/* Large Digital Countdown Badge */}
        <div
          className={`absolute top-2 right-2 z-10 px-2.5 py-0.5 rounded-lg font-mono text-xs font-bold border shadow-lg ${
            signal === 'GREEN'
              ? 'bg-emerald-950/90 border-emerald-400 text-emerald-300 animate-pulse'
              : signal === 'YELLOW'
              ? 'bg-amber-950/90 border-amber-400 text-amber-300'
              : 'bg-black/85 border-rose-500/40 text-rose-300'
          }`}
        >
          {signal === 'GREEN' ? `🟢 ${timer}s` : signal === 'YELLOW' ? `🟡 ${timer}s` : `🔴 Wait ${timer}s`}
        </div>

        {/* Vehicle Count & Queue overlay - strictly per camera */}
        <div className="absolute bottom-2 left-2 pointer-events-none bg-black/85 backdrop-blur-sm px-2.5 py-1 rounded font-mono text-[10px] text-slate-300 border border-white/10 flex items-center gap-2">
          <span>Vehicles: <strong className="text-cyan-300">{cam.count ?? 'ANALYZING...'}</strong></span>
          <span>•</span>
          <span>Queue: <strong className="text-amber-300">{cam.queue ?? 0}</strong></span>
          <span>•</span>
          <span>PCU: <strong className="text-emerald-300">{pcuDisplay}</strong></span>
        </div>
      </div>

      <div className="px-3 py-1.5 bg-slate-950/70 flex items-center justify-between text-[10px] font-mono text-slate-400">
        <span>GPS: {cam.latitude.toFixed(5)}°, {cam.longitude.toFixed(5)}°</span>
        <span className="text-cyan-400 group-hover:underline">Inspect Camera →</span>
      </div>
    </div>
  );
};

export const JunctionOverviewModal: React.FC<JunctionOverviewModalProps> = ({
  junctionId,
  onClose,
  onSelectCamera,
  onDeleteJunction,
  activeScenario
}) => {
  const { setCurrentPage, setSelectedJunctionId } = useApp();
  const [data, setData] = useState<JunctionDetailResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const baseUrl = apiClient.getVideoBaseUrl();

  const [activeCamId, setActiveCamId] = useState<string | null>(null);
  const [countdown, setCountdown] = useState<number>(25);

  const fetchJunction = () => {
    if (!junctionId) return;
    godViewService.getJunctionDetail(junctionId)
      .then(res => {
        if (res.data) {
          setData(res.data);
          if (res.data.signal_control) {
            if (res.data.signal_control.active_camera_id) {
              setActiveCamId(res.data.signal_control.active_camera_id);
            }
            if (typeof res.data.signal_control.remaining_time === 'number') {
              setCountdown(res.data.signal_control.remaining_time);
            }
          }
        }
      })
      .catch(err => {
        console.error('Failed to load junction detail:', err);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    if (!junctionId) return;
    setLoading(true);
    fetchJunction();
    const interval = setInterval(fetchJunction, 1000);
    return () => clearInterval(interval);
  }, [junctionId, activeScenario]);

  // Smooth local second countdown between API updates
  useEffect(() => {
    const isEmergency = data?.ambulance_status?.active || activeScenario === 'ambulance';
    if (isEmergency) return;

    const timer = setInterval(() => {
      setCountdown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [activeScenario, data?.ambulance_status?.active]);

  if (!junctionId) return null;

  const isEmergency = data?.ambulance_status?.active || activeScenario === 'ambulance';
  const cameras = data?.cameras || [];

  // Group or identify directional approach cameras
  const getCameraByDir = (dir: string) => {
    return cameras.find(c => c.direction?.toLowerCase() === dir.toLowerCase()) || null;
  };

  const northCam = getCameraByDir('North') || cameras[0] || null;
  const eastCam = getCameraByDir('East') || cameras[1] || null;
  const southCam = getCameraByDir('South') || cameras[2] || null;
  const westCam = getCameraByDir('West') || cameras[3] || null;

  const sigCtrl = data?.signal_control;
  const activeCameraObj = cameras.find(c => c.id === (sigCtrl?.active_camera_id || activeCamId)) || northCam;
  const currentActiveSignal = sigCtrl?.current_signal || (isEmergency ? 'GREEN' : 'RED');
  const currentPhaseName = sigCtrl?.current_phase || (isEmergency
    ? 'EMERGENCY VEHICLE PREEMPTION (EVP HOLD)'
    : (activeCameraObj
        ? `${activeCameraObj.id} (${activeCameraObj.direction?.toUpperCase() || 'APPROACH'}) ${currentActiveSignal}`
        : 'SEQUENTIAL ADAPTIVE OPTIMIZATION'));

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete junction ${junctionId} and all associated approach cameras?`)) return;
    try {
      await godViewService.deleteJunction(junctionId);
      if (onDeleteJunction) onDeleteJunction(junctionId);
      onClose();
    } catch (err: any) {
      alert(`Could not delete junction: ${err.message || 'Server error'}`);
    }
  };

  return (
    <div className="liquid-glass absolute top-16 right-4 z-40 w-96 sm:w-[500px] max-h-[calc(100vh-130px)] rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 animate-in fade-in slide-in-from-right duration-200 pointer-events-auto font-sans">
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-white/[0.08] bg-white/[0.03] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xl shadow-inner">
            🚦
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold text-base text-white">
                {data?.junction?.name || junctionId}
              </span>
              <span className="px-2 py-0.5 rounded-full font-mono text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                SIGNAL CONTROL
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
              <span>{junctionId}</span>
              <span>•</span>
              <span>{data?.junction?.latitude.toFixed(5)}° N, {data?.junction?.longitude.toFixed(5)}° E</span>
              {data?.junction?.location && (
                <>
                  <span>•</span>
                  <span>{data?.junction?.location}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {onDeleteJunction && (
            <button
              onClick={handleDelete}
              title="Delete this junction and associated cameras"
              className="text-slate-400 hover:text-rose-400 p-2 rounded-xl hover:bg-rose-500/10 transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Emergency Preemption Banner if Active */}
      {isEmergency && (
        <div className="bg-rose-950/80 border-b border-rose-500/40 px-5 py-2.5 flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold">
            <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
            <span>🚨 AMBULANCE EMERGENCY PREEMPTION (EVP) ACTIVE</span>
          </div>
          <span className="text-[10px] font-mono text-rose-200 bg-rose-900/80 px-2 py-0.5 rounded border border-rose-700">
            HOLD GREEN
          </span>
        </div>
      )}

      {/* Scrollable Body */}
      {loading && !data ? (
        <div className="flex-1 flex flex-col items-center justify-center p-16 gap-3">
          <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
          <span className="font-mono text-xs text-slate-400">Loading synchronized junction telemetry...</span>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* 1. Junction Directional Approach Layout Diagram */}
          <div className="bg-slate-900/80 rounded-xl p-3.5 border border-white/5 space-y-2">
            <div className="text-[10px] font-mono text-slate-400 uppercase font-semibold text-center flex items-center justify-center gap-2">
              <span>SYNCHRONIZED APPROACH TOPOLOGY</span>
              <span className="text-emerald-400">• ACTIVE: {sigCtrl?.active_camera_id || activeCamId || 'NONE'}</span>
            </div>

            <div className="flex flex-col items-center justify-center py-2 space-y-2 select-none">
              {/* Top: North Camera */}
              {northCam ? (
                <div
                  onClick={() => onSelectCamera(northCam)}
                  className={`border px-3 py-1.5 rounded-xl text-center cursor-pointer transition text-xs font-mono shadow-md ${
                    northCam.signal === 'GREEN'
                      ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-950/40'
                      : northCam.signal === 'YELLOW'
                      ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/40'
                      : 'border-white/10 hover:border-white/30 bg-black/60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white font-bold">{northCam.id} (NORTH)</span>
                    <SignalBadge signal={northCam.signal} timerSec={northCam.timer} />
                  </div>
                  <div className="text-[10px] text-cyan-300 mt-0.5">
                    🚗 Vehicles: {northCam.count ?? 'ANALYZING...'} • Queue: {northCam.queue ?? 0}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-500">No North Camera</div>
              )}

              {/* Middle Row: West -> [SIGNAL] <- East */}
              <div className="flex items-center justify-center gap-3 w-full">
                {westCam ? (
                  <div
                    onClick={() => onSelectCamera(westCam)}
                    className={`border px-3 py-1.5 rounded-xl text-center cursor-pointer transition text-xs font-mono shadow-md flex-1 ${
                      westCam.signal === 'GREEN'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-950/40'
                        : westCam.signal === 'YELLOW'
                        ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/40'
                        : 'border-white/10 hover:border-white/30 bg-black/60'
                    }`}
                  >
                    <div className="text-white font-bold">{westCam.id} (WEST)</div>
                    <div className="mt-0.5"><SignalBadge signal={westCam.signal} timerSec={westCam.timer} /></div>
                    <div className="text-[9px] text-cyan-300 mt-0.5">🚗 {westCam.count ?? 0} veh</div>
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-slate-500 flex-1 text-center">No West Cam</div>
                )}

                {/* Center Signal Hub */}
                <div className="bg-purple-950/90 border-2 border-purple-500/70 rounded-xl px-4 py-2.5 text-center shadow-xl shrink-0">
                  <div className="text-xl">🚦</div>
                  <div className="text-[10px] font-mono font-bold text-purple-200 mt-0.5">
                    {sigCtrl?.active_camera_id ? `ACTIVE: ${sigCtrl.active_camera_id}` : 'SIGNAL HUB'}
                  </div>
                  <div className="text-xs font-mono text-emerald-400 font-bold mt-0.5 flex items-center justify-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{countdown}s remaining</span>
                  </div>
                </div>

                {eastCam ? (
                  <div
                    onClick={() => onSelectCamera(eastCam)}
                    className={`border px-3 py-1.5 rounded-xl text-center cursor-pointer transition text-xs font-mono shadow-md flex-1 ${
                      eastCam.signal === 'GREEN'
                        ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-950/40'
                        : eastCam.signal === 'YELLOW'
                        ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/40'
                        : 'border-white/10 hover:border-white/30 bg-black/60'
                    }`}
                  >
                    <div className="text-white font-bold">{eastCam.id} (EAST)</div>
                    <div className="mt-0.5"><SignalBadge signal={eastCam.signal} timerSec={eastCam.timer} /></div>
                    <div className="text-[9px] text-cyan-300 mt-0.5">🚗 {eastCam.count ?? 0} veh</div>
                  </div>
                ) : (
                  <div className="text-[10px] font-mono text-slate-500 flex-1 text-center">No East Cam</div>
                )}
              </div>

              {/* Bottom: South Camera */}
              {southCam ? (
                <div
                  onClick={() => onSelectCamera(southCam)}
                  className={`border px-3 py-1.5 rounded-xl text-center cursor-pointer transition text-xs font-mono shadow-md ${
                    southCam.signal === 'GREEN'
                      ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)] bg-emerald-950/40'
                      : southCam.signal === 'YELLOW'
                      ? 'border-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.3)] bg-amber-950/40'
                      : 'border-white/10 hover:border-white/30 bg-black/60'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-white font-bold">{southCam.id} (SOUTH)</span>
                    <SignalBadge signal={southCam.signal} timerSec={southCam.timer} />
                  </div>
                  <div className="text-[10px] text-cyan-300 mt-0.5">
                    🚗 Vehicles: {southCam.count ?? 'ANALYZING...'} • Queue: {southCam.queue ?? 0}
                  </div>
                </div>
              ) : (
                <div className="text-[10px] font-mono text-slate-500">No South Camera</div>
              )}
            </div>
          </div>

          {/* 2. Real-Time Signal Control Section */}
          <div className="bg-slate-900/60 p-4 rounded-xl border border-white/5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-3.5 h-3.5 text-purple-400" />
                <span>SEQUENTIAL ADAPTIVE CONTROLLER</span>
              </span>
              <SignalBadge signal={currentActiveSignal} timerSec={countdown} />
            </div>

            {/* Current Phase & Countdown */}
            <div className="bg-black/50 p-3 rounded-lg border border-white/5 space-y-2 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Right-of-Way:</span>
                <span className="font-bold text-white text-right truncate max-w-[260px] text-emerald-400">
                  {currentPhaseName}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
                <div className="bg-slate-900/60 p-2 rounded border border-white/5">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Radio className="w-3 h-3 text-cyan-400" />
                    <span>Active Approach</span>
                  </div>
                  <div className="font-bold text-white text-sm mt-0.5 truncate">
                    {sigCtrl?.active_camera_id || 'STANDBY'}
                  </div>
                </div>

                <div className="bg-slate-900/60 p-2 rounded border border-white/5">
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>Countdown</span>
                  </div>
                  <div className="font-bold text-emerald-300 text-base mt-0.5 animate-pulse">
                    {countdown}s
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                <span className="text-slate-400">Adaptive State:</span>
                <span className="text-cyan-400 font-semibold truncate">
                  {sigCtrl?.adaptive_state || 'Sequential Dynamic Handover (YOLOv8 Demand)'}
                </span>
              </div>
            </div>

            {/* Total Demand, Queue, PCU metrics - exact sums */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Traffic Demand</div>
                <div className="text-lg font-bold font-mono text-cyan-400 mt-0.5">
                  {data?.combined_count ?? 0}
                </div>
                <div className="text-[9px] text-slate-500">Vehicles</div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase">Stopline Queue</div>
                <div className="text-lg font-bold font-mono text-amber-400 mt-0.5">
                  {data?.combined_queue ?? 0}
                </div>
                <div className="text-[9px] text-slate-500">Queued</div>
              </div>

              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-white/5 text-center">
                <div className="text-[10px] text-slate-400 font-mono uppercase">PCU Units</div>
                <div className="text-lg font-bold font-mono text-emerald-400 mt-0.5">
                  {data?.combined_pcu ?? 0}
                </div>
                <div className="text-[9px] text-slate-500">Weighted</div>
              </div>
            </div>
          </div>

          {/* 3. All Associated Cameras Grid */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-xs text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-cyan-400" />
                <span>ASSOCIATED CAMERAS ({cameras.length})</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">Click to inspect single camera</span>
            </div>

            {cameras.length === 0 ? (
              <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 text-center text-xs font-mono text-slate-500">
                No cameras linked to this junction.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cameras.map((cam) => (
                  <JunctionCameraCard
                    key={cam.id}
                    cam={cam}
                    baseUrl={baseUrl}
                    onSelect={() => onSelectCamera(cam)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Action Buttons: Traffic Analysis + Delete */}
          <div className="pt-2 space-y-2">
            <button
              onClick={() => {
                if (junctionId) setSelectedJunctionId(junctionId);
                setCurrentPage('traffic_analysis');
                onClose();
              }}
              className="w-full bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.12] py-2.5 rounded-xl font-mono text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <BarChart3 className="w-3.5 h-3.5 text-neutral-300" />
              <span>VIEW APPROACH TRAFFIC ANALYSIS →</span>
            </button>

            {onDeleteJunction && (
              <button
                onClick={handleDelete}
                className="w-full bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/40 py-2 rounded-xl font-mono text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>DELETE JUNCTION ({junctionId})</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
