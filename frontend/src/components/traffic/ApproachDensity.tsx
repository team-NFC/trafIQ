import React from 'react';
import { ApproachDensityItem } from '../../types/traffic';
import { Compass, Activity } from 'lucide-react';

interface ApproachDensityProps {
  approaches?: ApproachDensityItem[] | null;
}

export const ApproachDensity: React.FC<ApproachDensityProps> = ({ approaches }) => {
  const hasData = approaches && approaches.length > 0;

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-3.5">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Approach Density & Congestion
          </h3>
        </div>
        <span className="text-[10px] text-slate-500 font-mono">4 APPROACHES</span>
      </div>

      {!hasData ? (
        <div className="py-6 flex flex-col items-center justify-center text-center space-y-2">
          <Activity className="w-5 h-5 text-cyan-400/60 animate-pulse" />
          <span className="text-xs font-medium text-slate-400">Waiting for traffic analysis...</span>
          <span className="text-[10px] text-slate-500">Approach density & queue metrics will display when traffic analytics are linked</span>
        </div>
      ) : (
        <div className="space-y-3">
          {approaches.map((item) => (
            <div key={item.cameraId} className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80">
              <div className="flex items-center justify-between text-xs mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-cyan-300">{item.name}</span>
                  <span className="text-slate-400">—</span>
                  <span className="text-slate-200 font-medium">{item.approach}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-mono font-bold text-slate-100">{item.density}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
