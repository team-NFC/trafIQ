import React, { useState, useEffect } from 'react';
import { cameraService } from '../api/cameras';
import { signalService } from '../api/signals';
import { apiClient } from '../api/client';
import { CameraFeed } from '../types/camera';
import { SignalState } from '../types/signal';
import { CameraCard } from '../components/traffic/CameraCard';
import { TrafficOverview } from '../components/traffic/TrafficOverview';
import { ApproachDensity } from '../components/traffic/ApproachDensity';
import { SignalController } from '../components/traffic/SignalController';
import { AmbulanceBanner } from '../components/traffic/AmbulanceBanner';
import { Grid, AlertCircle, RefreshCw } from 'lucide-react';

export const TrafficDashboard: React.FC = () => {
  const [cameras, setCameras] = useState<CameraFeed[]>([]);
  const [signalState, setSignalState] = useState<SignalState | null>(null);
  const [ambulanceActive, setAmbulanceActive] = useState<boolean>(false);
  const [ambulanceCamera, setAmbulanceCamera] = useState<string>('CAM 03');
  const [activeCamFilter, setActiveCamFilter] = useState<'ALL' | 'CAM 01' | 'CAM 02' | 'CAM 03' | 'CAM 04'>('ALL');
  const [focusedCamId, setFocusedCamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshCameras = async () => {
    setLoading(true);
    const cRes = await cameraService.getTrafficCameras();
    if (cRes.data) {
      setCameras(cRes.data);
    }
    setLoading(false);
  };

  const fetchRealTelemetry = async () => {
    // 1. Real Signal Controller from Python NormalSignalController
    const sRes = await signalService.getSignalState();
    if (sRes.data) {
      setSignalState(sRes.data);
    }

    // 2. Real Ambulance Priority State from Python AmbulancePriorityController
    const aRes = await apiClient.get<Record<string, any>>('/api/ambulance');
    if (aRes.data) {
      setAmbulanceActive(Boolean(aRes.data.is_emergency_active || aRes.data.ambulance_detected));
      if (aRes.data.camera) {
        setAmbulanceCamera(String(aRes.data.camera).toUpperCase().replace('_', ' '));
      }
    }
  };

  useEffect(() => {
    refreshCameras();
    fetchRealTelemetry();

    // Poll live signal progression every 1.5 seconds from real Python backend
    const interval = setInterval(fetchRealTelemetry, 1500);
    return () => clearInterval(interval);
  }, []);

  // Filtered cameras based on top controls
  const displayedCameras = cameras.filter(cam => {
    if (focusedCamId) return cam.id === focusedCamId;
    if (activeCamFilter === 'ALL') return true;
    return cam.name === activeCamFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Camera Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <span>LIVE TRAFFIC DASHBOARD</span>
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            CCTV Junction Cameras (Anna Nagar 4-Way Junction)
          </p>
        </div>

        {/* Camera Selector Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/90 border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => {
              setActiveCamFilter('ALL');
              setFocusedCamId(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center gap-1.5 ${
              activeCamFilter === 'ALL' && !focusedCamId
                ? 'bg-cyan-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>ALL CAMERAS</span>
          </button>

          {['CAM 01', 'CAM 02', 'CAM 03', 'CAM 04'].map((camName) => (
            <button
              key={camName}
              onClick={() => {
                setActiveCamFilter(camName as any);
                setFocusedCamId(null);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer ${
                activeCamFilter === camName && !focusedCamId
                  ? 'bg-cyan-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {camName}
            </button>
          ))}

          <button
            onClick={refreshCameras}
            className="p-1.5 text-slate-400 hover:text-cyan-300 rounded-lg hover:bg-slate-800 transition cursor-pointer"
            title="Refresh Camera Status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Emergency Status Banner: Shows NO ACTIVE EMERGENCY until real backend reports one */}
      <AmbulanceBanner
        active={ambulanceActive}
        cameraName={ambulanceCamera}
        approach="South Approach"
      />

      {/* Main Layout: 2x2 Camera Grid (Left) + Intelligence Panels (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Left 2 Cols: 2x2 CCTV Grid */}
        <div className="xl:col-span-2 space-y-6">
          <div
            className={`grid gap-4.5 ${
              displayedCameras.length === 1
                ? 'grid-cols-1'
                : 'grid-cols-1 md:grid-cols-2'
            }`}
          >
            {displayedCameras.map((cam) => (
              <CameraCard
                key={cam.id}
                camera={cam}
                isFocused={focusedCamId === cam.id}
                onFocus={(id) => setFocusedCamId(focusedCamId === id ? null : id)}
              />
            ))}
          </div>

          {/* Real-time Signal Controller State: Connected to real Python NormalSignalController */}
          <SignalController signalState={signalState} />
        </div>

        {/* Right 1 Col: Operations Overview Panels */}
        <div className="space-y-6">
          {/* Traffic Modal Breakdown: Shows Waiting for traffic analysis... */}
          <TrafficOverview metrics={null} />

          {/* Approach Congestion Density: Shows Waiting for traffic analysis... */}
          <ApproachDensity approaches={null} />

          {/* Recent Operations Alerts: Shows No active alerts */}
          <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-slate-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Recent Alerts
                </h3>
              </div>
              <span className="text-[10px] text-slate-500 font-mono">
                {ambulanceActive ? '1 EMERGENCY' : '0 ACTIVE'}
              </span>
            </div>

            <div className="py-6 flex flex-col items-center justify-center text-center">
              <span className="text-xs text-slate-400">
                {ambulanceActive ? 'Emergency vehicle detected in junction zone' : 'No active alerts'}
              </span>
              <span className="text-[10px] text-slate-600 mt-0.5">
                Real-time incident detection will populate as alerts occur
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
