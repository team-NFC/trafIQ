import React from 'react';
import { VehicleJourney } from '../../types/anpr';
import { Car, Clock, ShieldCheck, AlertTriangle, Route } from 'lucide-react';

interface VehicleDetailsProps {
  journey: VehicleJourney;
}

export const VehicleDetails: React.FC<VehicleDetailsProps> = ({ journey }) => {
  const hasDbMatch = journey.databaseMatch?.isMatched;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
      {/* Header with License Plate Tag */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3.5">
          {/* Indian High-Security Registration Plate Display */}
          <div className="border-2 border-slate-700 bg-white text-black px-3.5 py-1.5 rounded-lg flex items-center gap-2 shadow-md">
            <div className="flex flex-col items-center justify-center border-r border-slate-300 pr-2">
              <span className="text-[8px] font-bold tracking-tighter text-blue-800 leading-none">IND</span>
              <div className="w-2.5 h-2.5 rounded-full border border-blue-800 mt-0.5" />
            </div>
            <span className="font-mono font-black text-lg tracking-widest text-slate-900">
              {journey.plateNumber}
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white">Vehicle Telemetry Profile</h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                {journey.vehicleClass}
              </span>
            </div>
            <span className="text-xs text-slate-400">
              Confirmed cross-camera vehicle identification
            </span>
          </div>
        </div>

        {/* Database Match Status */}
        <div>
          {hasDbMatch ? (
            <div className="px-3 py-1.5 rounded-lg bg-red-950/60 border border-red-500/50 text-red-300 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>DATABASE MATCH FOUND</span>
            </div>
          ) : (
            <div className="px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>CLEAR (NO POLICE ALERTS)</span>
            </div>
          )}
        </div>
      </div>

      {/* Grid of Telemetry KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Vehicle Type</span>
          <div className="flex items-center gap-1.5 font-bold text-slate-200">
            <Car className="w-3.5 h-3.5 text-cyan-400" />
            <span>{journey.vehicleClass}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">OCR Confidence</span>
          <span className="font-mono font-bold text-emerald-400 text-sm">
            {(journey.ocrConfidence * 100).toFixed(1)}%
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Total Detections</span>
          <span className="font-mono font-bold text-white text-sm">
            {journey.observationsCount} reads
          </span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Cameras Detected</span>
          <div className="flex items-center gap-1.5 font-bold text-purple-300 text-sm">
            <Route className="w-3.5 h-3.5 text-purple-400" />
            <span>{journey.uniqueCamerasCount} CAMs</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">First Seen</span>
          <div className="flex items-center gap-1 font-mono font-bold text-slate-200">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>{journey.firstSeen}</span>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Last Seen</span>
          <div className="flex items-center gap-1 font-mono font-bold text-cyan-300">
            <Clock className="w-3.5 h-3.5 text-cyan-500" />
            <span>{journey.lastSeen}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
