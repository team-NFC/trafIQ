import React from 'react';
import { CameraTelemetry } from '../../types/telemetry';

interface BottomTelemetryProps {
  telemetry: CameraTelemetry;
  is3D: boolean;
}

export const BottomTelemetry: React.FC<BottomTelemetryProps> = ({ telemetry, is3D }) => {
  const formatCoord = (val: number, posChar: string, negChar: string) => {
    const dir = val >= 0 ? posChar : negChar;
    return `${Math.abs(val).toFixed(5)}° ${dir}`;
  };

  const formatAlt = (km: number) => {
    if (km < 2.0) {
      return `${(km * 1000).toFixed(0)} M`;
    }
    return `${km.toFixed(2)} KM`;
  };

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-20 pointer-events-auto select-none">
      <div className="bg-[#0c0f16]/90 backdrop-blur-xl px-4 py-1.5 rounded-lg flex items-center gap-4 font-mono text-[10px] text-slate-300 shadow-xl border border-white/[0.08]">
        <div className="flex items-center gap-1.5">
          <span className="text-slate-500 text-[8.5px]">LAT</span>
          <span className="font-bold text-slate-100">{formatCoord(telemetry.latitude, 'N', 'S')}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
          <span className="text-slate-500 text-[8.5px]">LON</span>
          <span className="font-bold text-slate-100">{formatCoord(telemetry.longitude, 'E', 'W')}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
          <span className="text-slate-500 text-[8.5px]">ALTITUDE</span>
          <span className="font-bold text-slate-200">{formatAlt(telemetry.altitudeKm)}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
          <span className="text-slate-500 text-[8.5px]">HEADING</span>
          <span className="text-slate-300">{telemetry.headingDeg.toFixed(0)}°</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
          <span className="text-slate-500 text-[8.5px]">VIEW</span>
          <span className="text-slate-200 font-bold">{is3D ? '3D AERIAL' : '2D SATELLITE'}</span>
        </div>

        <div className="flex items-center gap-1.5 border-l border-white/[0.08] pl-3">
          <span className="text-slate-500 text-[8.5px]">SURVEILLANCE</span>
          <span className="text-emerald-400 font-semibold">TRICHY, TN</span>
        </div>
      </div>
    </div>
  );
};
