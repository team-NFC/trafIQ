import React from 'react';
import { VehicleJourney } from '../../types/anpr';
import { Clock, MapPin, CheckCircle, ArrowDown } from 'lucide-react';

interface JourneyTimelineProps {
  journey: VehicleJourney;
}

export const JourneyTimeline: React.FC<JourneyTimelineProps> = ({ journey }) => {
  // Ensure observations are strictly sorted by timestamp / seconds
  const sortedObservations = [...journey.observations].sort(
    (a, b) => a.timestampSeconds - b.timestampSeconds
  );

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Chronological Vehicle Journey Timeline
          </h3>
          <span className="text-xs text-slate-400">
            Multi-Camera Spatio-Temporal Reconstruction (Chronological Order)
          </span>
        </div>

        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-slate-400">
            Total Journey: <strong className="text-cyan-400">{journey.totalDurationMinutes} minutes</strong>
          </span>
          <span className="text-slate-700">|</span>
          <span className="text-slate-400">
            Hops: <strong className="text-purple-400">{sortedObservations.length} checkpoints</strong>
          </span>
        </div>
      </div>

      {/* Visual Timeline Stream */}
      <div className="relative pl-6 py-2 space-y-6 before:absolute before:left-3 before:top-4 before:bottom-4 before:w-0.5 before:bg-gradient-to-b before:from-cyan-500 before:via-purple-500 before:to-emerald-500">
        {sortedObservations.map((obs, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === sortedObservations.length - 1;

          // Calculate travel time from previous node
          let travelDelta = '';
          if (idx > 0) {
            const diffSec = obs.timestampSeconds - sortedObservations[idx - 1].timestampSeconds;
            const mins = Math.floor(diffSec / 60);
            const secs = diffSec % 60;
            travelDelta = `+${mins}m ${secs.toString().padStart(2, '0')}s`;
          }

          return (
            <div key={idx} className="relative group">
              {/* Timeline Node Icon / Dot */}
              <div
                className={`absolute -left-6 top-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                  isLast
                    ? 'border-emerald-400 bg-emerald-950 text-emerald-300 shadow-md shadow-emerald-500/40'
                    : isFirst
                    ? 'border-cyan-400 bg-cyan-950 text-cyan-300 shadow-md shadow-cyan-500/40'
                    : 'border-purple-400 bg-purple-950 text-purple-300'
                }`}
              >
                <span className="text-[10px] font-mono font-bold">{idx + 1}</span>
              </div>

              {/* Travel Time Delta Badge between hops */}
              {travelDelta && (
                <div className="absolute -top-4 left-4 text-[10px] font-mono font-semibold text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded border border-purple-800/60 flex items-center gap-1 shadow-sm">
                  <ArrowDown className="w-3 h-3 text-purple-400" />
                  <span>Travel time: {travelDelta}</span>
                </div>
              )}

              {/* Node Card */}
              <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/90 hover:border-slate-700 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-white">
                      {obs.cameraName}
                    </span>
                    <span className="text-slate-500">•</span>
                    <div className="flex items-center gap-1 text-xs text-slate-300">
                      <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{obs.location}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1 font-mono text-cyan-300 font-medium">
                      <Clock className="w-3 h-3 text-cyan-500" />
                      {obs.timestamp}
                    </span>
                    <span>•</span>
                    <span>Speed est: <strong className="text-slate-200">{obs.speedEstimateKmh || 45} km/h</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  <div className="px-2.5 py-1 rounded bg-slate-950 border border-slate-800 text-right">
                    <span className="text-[9px] uppercase text-slate-400 block font-semibold">OCR Confidence</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 flex items-center justify-end gap-1">
                      <CheckCircle className="w-3 h-3" />
                      {(obs.confidence * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
