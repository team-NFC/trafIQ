import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { cameraService } from '../api/cameras';
import { CameraFeed } from '../types/camera';
import { StatCard } from '../components/common/StatCard';
import { Badge } from '../components/common/Badge';
import { TrafficFlowChart } from '../components/charts/TrafficFlowChart';
import {
  Car,
  Video,
  TrafficCone,
  Siren,
  ScanLine,
  ShieldAlert,
  Activity,
  AlertCircle
} from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [cameras, setCameras] = useState<CameraFeed[]>([]);

  useEffect(() => {
    const fetchCameras = async () => {
      const cRes = await cameraService.getTrafficCameras();
      if (cRes.data) setCameras(cRes.data);
    };

    fetchCameras();
  }, []);

  const onlineCamerasCount = cameras.filter(c => c.status === 'ONLINE' || c.status === 'LIVE').length;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <span>TrafficIQ Overview</span>
          <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-medium">
            RECORDED CCTV
          </span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          AI Traffic Intelligence & Hardware Junction Feeds
        </p>
      </div>

      {/* Top KPI Cards (6 items) - Honest Real Status */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
        <StatCard
          title="Total Vehicles"
          value="--"
          subtitle="Waiting for traffic analysis..."
          icon={Car}
          color="cyan"
        />
        <StatCard
          title="Active Cameras"
          value={cameras.length > 0 ? `${onlineCamerasCount}/${cameras.length}` : '--'}
          subtitle="Junction feeds online"
          icon={Video}
          color="emerald"
        />
        <StatCard
          title="Current Signal"
          value="Unavailable"
          subtitle="Signal state unavailable"
          icon={TrafficCone}
          color="amber"
        />
        <StatCard
          title="Emergency Events"
          value="None"
          subtitle="No active emergency"
          icon={Siren}
          color="rose"
        />
        <StatCard
          title="ANPR Detections"
          value="--"
          subtitle="Awaiting ANPR phase"
          icon={ScanLine}
          color="purple"
        />
        <StatCard
          title="Database Alerts"
          value="0"
          subtitle="No active alerts"
          icon={ShieldAlert}
          color="amber"
        />
      </div>

      {/* Two Column Section: Traffic Activity vs Recent Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Traffic Flow Activity & Trend */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Traffic Flow & Density Dynamics
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-500">Live Junction Metrics</span>
          </div>

          <TrafficFlowChart data={null} />
        </div>

        {/* Right 1 Col: Recent Alerts */}
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3.5 flex flex-col">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-slate-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Recent Critical Alerts
              </h3>
            </div>
            <span className="text-[10px] font-mono bg-slate-800 text-slate-400 px-2 py-0.5 rounded">
              0 ALERTS
            </span>
          </div>

          <div className="py-12 flex flex-col items-center justify-center text-center space-y-1 flex-1">
            <span className="text-xs text-slate-400">No active alerts</span>
            <span className="text-[11px] text-slate-600">
              System events and priority preemption alerts will appear here
            </span>
          </div>
        </div>
      </div>

      {/* Camera Status Grid - Real Filesystem Verified */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3.5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Junction CCTV Camera Feeds (4 Approaches)
            </h3>
            <span className="text-xs text-slate-500">
              Real-time hardware pipeline and video stream connectivity
            </span>
          </div>
          <button
            onClick={() => setCurrentPage('traffic_live')}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
          >
            View Live Feeds ➔
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {cameras.map((cam) => (
            <div
              key={cam.id}
              onClick={() => setCurrentPage('traffic_live')}
              className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 hover:border-slate-700 transition cursor-pointer flex items-center justify-between"
            >
              <div>
                <span className="font-mono font-bold text-sm text-cyan-300 block">
                  {cam.name}
                </span>
                <span className="text-[11px] text-slate-400">{cam.approach}</span>
                <span className="text-[10px] text-slate-500 block font-mono">{cam.sourceType}</span>
              </div>
              <Badge variant={cam.status === 'ONLINE' || cam.status === 'LIVE' ? 'online' : 'offline'}>
                {cam.status}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
