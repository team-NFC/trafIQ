import React from 'react';
import { TrajectoriesResponse, TrajectoryScenario } from '../../api/godview';
import { Route, CheckCircle, AlertTriangle, FileCheck } from 'lucide-react';

interface TrajectoryViewerProps {
  trajectories: TrajectoriesResponse | null;
  activeScenario: string;
}

export const TrajectoryViewer: React.FC<TrajectoryViewerProps> = ({
  trajectories,
  activeScenario,
}) => {
  if (!trajectories) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-[#090e1a] p-5 text-center text-slate-400">
        Loading Multi-Camera ANPR Trajectories...
      </div>
    );
  }

  const isMissingNode = activeScenario === 'anpr_missing';
  const scenarioData: TrajectoryScenario = isMissingNode
    ? trajectories.scenarios.missing_node
    : trajectories.scenarios.continuous;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#090e1a] p-5 space-y-5 shadow-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-800/80 gap-2">
        <div>
          <h3 className="text-sm font-black font-mono tracking-wider uppercase text-white flex items-center gap-2">
            <Route className="w-4 h-4 text-cyan-400" />
            <span>MULTI-CAMERA ANPR TRAJECTORY & INTERPOLATION</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-camera vehicle identity tracking via confirmed High-Speed HSRP plate reads
          </p>
        </div>

        {/* Status Badge */}
        <div
          className={`px-3 py-1 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 self-start sm:self-auto border ${
            isMissingNode
              ? 'bg-amber-950/60 text-amber-300 border-amber-800/80'
              : 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80'
          }`}
        >
          {isMissingNode ? <AlertTriangle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
          <span>{scenarioData.overall_status}</span>
        </div>
      </div>

      {/* Target Vehicle Summary Card */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-xs font-mono">
        <div>
          <span className="text-slate-500 block text-[11px]">Primary Plate Identity</span>
          <span className="text-lg font-black text-amber-400 tracking-wider">
            {scenarioData.vehicle}
          </span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Vehicle Class</span>
          <span className="text-white font-bold text-sm uppercase">{scenarioData.vehicle_class}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Confidence Metric</span>
          <span className="text-cyan-400 font-bold text-sm">{scenarioData.confidence_display}</span>
        </div>
        <div>
          <span className="text-slate-500 block text-[11px]">Identity Standard</span>
          <span className="text-emerald-400 font-bold text-sm">HSRP Indian Format ✓</span>
        </div>
      </div>

      {/* Sequential Journey Progression Timeline */}
      <div className="space-y-3">
        <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300 block">
          Sequential Camera Observation Journey:
        </span>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {scenarioData.observed_nodes.map((node, idx) => {
            const isMissing = node.is_missing;
            return (
              <div
                key={idx}
                className={`p-3.5 rounded-xl border relative flex flex-col justify-between space-y-2 ${
                  isMissing
                    ? 'border-amber-500/60 bg-amber-950/30'
                    : 'border-slate-800 bg-[#060a12]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black font-mono text-cyan-400">{node.camera_id}</span>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                      isMissing
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-600/40'
                        : 'bg-emerald-500/20 text-emerald-300 border border-emerald-600/40'
                    }`}
                  >
                    {node.status}
                  </span>
                </div>

                <div>
                  <div className="text-xs text-slate-200 font-semibold">{node.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    Time: {node.time} {node.frame ? `(Frame ${node.frame})` : ''}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono">
                  <span className="text-slate-500">
                    {isMissing ? 'Interpolation Conf:' : 'OCR Confidence:'}
                  </span>
                  <span className={isMissing ? 'text-amber-300 font-bold' : 'text-emerald-300 font-bold'}>
                    {(node.confidence * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reconstructed Path Explanation Box */}
      <div
        className={`p-4 rounded-xl border text-xs leading-relaxed font-sans ${
          isMissingNode
            ? 'border-amber-800/50 bg-amber-950/20 text-amber-100'
            : 'border-emerald-800/50 bg-emerald-950/20 text-emerald-100'
        }`}
      >
        <div className="flex items-center gap-2 font-mono font-bold text-xs mb-1">
          <FileCheck className="w-4 h-4 shrink-0" />
          <span>
            {isMissingNode
              ? 'RECONSTRUCTION AUDIT EVIDENCE:'
              : 'CONTINUOUS OBSERVATION CERTIFICATION:'}
          </span>
        </div>
        <p className="font-sans text-slate-300">{scenarioData.explanation}</p>
      </div>
    </div>
  );
};
