import React from 'react';
import { TrafficMetrics } from '../../types/traffic';
import { Car, Bike, Bus, Truck, Ambulance, Layers, Activity } from 'lucide-react';

interface TrafficOverviewProps {
  metrics?: TrafficMetrics | null;
}

export const TrafficOverview: React.FC<TrafficOverviewProps> = ({ metrics }) => {
  const hasRealData = metrics !== null && metrics !== undefined;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Traffic Overview
          </h3>
          <span className="text-[11px] text-slate-500 font-medium">
            Junction Modal Breakdown
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-cyan-950/60 border border-cyan-800/40 text-cyan-300 font-mono text-xs font-bold">
          <Layers className="w-3.5 h-3.5" />
          <span>{hasRealData ? `${metrics.totalVehicles} TOTAL` : '-- TOTAL'}</span>
        </div>
      </div>

      {!hasRealData ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
          <Activity className="w-5 h-5 text-cyan-400/60 animate-pulse" />
          <span className="text-xs font-medium text-slate-400">Waiting for traffic analysis...</span>
          <span className="text-[10px] text-slate-500">Real-time vehicle counting will be populated once YOLO analytics are connected</span>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-3">
          {/* Cars */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="p-2 rounded-md bg-blue-500/10 text-blue-400">
              <Car className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Cars</span>
              <span className="text-base font-bold font-mono text-white">{metrics.cars}</span>
            </div>
          </div>

          {/* Motorcycles */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="p-2 rounded-md bg-amber-500/10 text-amber-400">
              <Bike className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Bikes</span>
              <span className="text-base font-bold font-mono text-white">{metrics.motorcycles}</span>
            </div>
          </div>

          {/* Buses */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="p-2 rounded-md bg-purple-500/10 text-purple-400">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Buses</span>
              <span className="text-base font-bold font-mono text-white">{metrics.buses}</span>
            </div>
          </div>

          {/* Trucks */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="p-2 rounded-md bg-orange-500/10 text-orange-400">
              <Truck className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Trucks</span>
              <span className="text-base font-bold font-mono text-white">{metrics.trucks}</span>
            </div>
          </div>

          {/* Ambulances */}
          <div className="p-3 rounded-lg bg-slate-900/90 border border-slate-800/80 flex items-center gap-3">
            <div className="p-2 rounded-md bg-rose-500/10 text-rose-400">
              <Ambulance className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-semibold text-slate-400 block">Ambulance</span>
              <span className="text-base font-bold font-mono text-rose-300">{metrics.ambulances}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
