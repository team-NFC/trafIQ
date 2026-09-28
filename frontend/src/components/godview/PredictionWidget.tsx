import React from 'react';
import { PredictionData } from '../../api/godview';
import { TrendingUp, Sparkles } from 'lucide-react';

interface PredictionWidgetProps {
  prediction: PredictionData | null;
}

export const PredictionWidget: React.FC<PredictionWidgetProps> = ({ prediction }) => {
  if (!prediction) return null;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#090e1a] p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-400" />
          <h3 className="text-sm font-black font-mono tracking-wider uppercase text-white">
            15-MIN DEMAND FORECAST & PREDICTION
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-purple-950 text-purple-300 border border-purple-800/60 px-2 py-0.5 rounded font-bold">
          {prediction.trend_pct} {prediction.overall_trend}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        {Object.entries(prediction.approach_forecast).map(([app, data], idx) => (
          <div key={idx} className="p-3 rounded-xl border border-slate-800 bg-[#060a12] space-y-1 font-mono text-xs">
            <span className="text-slate-400 block text-[11px] truncate">{app}</span>
            <div className="flex items-baseline justify-between">
              <span className="text-base font-black text-white">{data.predicted_pcu} PCU</span>
              <span className="text-[10px] text-purple-400 font-bold">{data.delta}</span>
            </div>
            <div className="text-[10px] text-slate-500">Current: {data.current_pcu} PCU</div>
          </div>
        ))}
      </div>

      <div className="p-3 rounded-xl border border-purple-800/40 bg-purple-950/20 text-xs text-purple-200 flex items-start gap-2.5">
        <Sparkles className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
        <span className="font-sans leading-relaxed">
          <strong className="font-mono text-white">Recommended Cycle Pre-adjustment: </strong>
          {prediction.recommended_adjustment} (Model Confidence: {(prediction.confidence * 100).toFixed(1)}%)
        </span>
      </div>
    </div>
  );
};
