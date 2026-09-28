import React from 'react';
import { Siren } from 'lucide-react';
import { AmbulanceStateResponse } from '../../api/godview';

interface AmbulanceEVPBannerProps {
  ambulanceState: AmbulanceStateResponse | null;
  activeScenario: string;
}

export const AmbulanceEVPBanner: React.FC<AmbulanceEVPBannerProps> = ({
  ambulanceState,
  activeScenario,
}) => {
  const isEmergency = activeScenario === 'ambulance' || (ambulanceState && ambulanceState.ambulance_detected);

  if (!isEmergency) return null;

  return (
    <div className="rounded-2xl border-2 border-rose-500 bg-gradient-to-r from-rose-950/90 via-red-900/80 to-rose-950/90 p-4 shadow-2xl shadow-rose-950/60 backdrop-blur-xl animate-pulse">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Main Priority Alert Header */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-rose-600 text-white flex items-center justify-center shadow-lg shadow-rose-600/50 shrink-0">
            <Siren className="w-7 h-7 animate-bounce" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black font-mono tracking-wider text-rose-200 uppercase flex items-center gap-1.5">
                🚨 EMERGENCY VEHICLE DETECTED
              </span>
              <span className="px-2 py-0.5 rounded bg-rose-500 text-white font-mono text-[10px] font-black tracking-widest animate-pulse">
                EVP ACTIVE
              </span>
            </div>
            <p className="text-xs text-rose-100/90 mt-0.5 font-sans">
              Optical siren beacon temporally verified over 3+ consecutive CCTV frames. Normal cycle interrupted; exclusive green corridor granted.
            </p>
          </div>
        </div>

        {/* Right: Telemetry Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center shrink-0">
          <div className="px-3 py-2 rounded-xl bg-black/40 border border-rose-500/40">
            <div className="text-[10px] uppercase font-mono text-rose-300">Approach</div>
            <div className="text-sm font-black font-mono text-white">SOUTH</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-black/40 border border-rose-500/40">
            <div className="text-[10px] uppercase font-mono text-rose-300">Camera</div>
            <div className="text-sm font-black font-mono text-white">CAM-03</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-black/40 border border-rose-500/40">
            <div className="text-[10px] uppercase font-mono text-rose-300">Signal Status</div>
            <div className="text-sm font-black font-mono text-green-400">EMERGENCY GREEN</div>
          </div>
          <div className="px-3 py-2 rounded-xl bg-black/40 border border-rose-500/40">
            <div className="text-[10px] uppercase font-mono text-rose-300">Plate Number</div>
            <div className="text-sm font-black font-mono text-amber-300">TN 45 AU 4608</div>
          </div>
        </div>
      </div>
    </div>
  );
};
