import React from 'react';
import { DatabaseAlertItem } from '../../types/alert';
import { AlertTriangle, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface DatabaseAlertCardProps {
  alert: DatabaseAlertItem;
  onMarkReviewed?: (alertId: string) => void;
}

export const DatabaseAlertCard: React.FC<DatabaseAlertCardProps> = ({ alert, onMarkReviewed }) => {
  const isPending = alert.status === 'PENDING_REVIEW';

  return (
    <div className="rounded-xl border-2 border-amber-500/60 bg-gradient-to-r from-amber-950/40 via-[#0f172a] to-amber-950/40 p-5 shadow-xl space-y-4">
      {/* Alert Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-amber-300 uppercase tracking-wider">
                ⚠ DATABASE MATCH
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                REVIEW REQUIRED
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Automated cross-check with law enforcement and municipal records. Authorized operator verification required.
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div>
          {isPending ? (
            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-500/50 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              STATUS: MATCH FOUND
            </span>
          ) : (
            <span className="px-3 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-950 text-emerald-300 border border-emerald-500/50 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" />
              STATUS: REVIEWED
            </span>
          )}
        </div>
      </div>

      {/* Grid of Alert Attributes */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Registration</span>
          <span className="font-mono font-black text-yellow-300 text-sm">{alert.plate}</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Record Type</span>
          <span className="font-bold text-white text-xs">{alert.recordType}</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Camera Location</span>
          <span className="font-bold text-purple-300 text-xs">{alert.cameraName} ({alert.location})</span>
        </div>

        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Detection Time</span>
          <span className="font-mono font-bold text-cyan-300 text-xs">{alert.detectionTime}</span>
        </div>
      </div>

      {/* Operator Details & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-950/80 border border-slate-800 text-xs">
        <p className="text-slate-300 italic">
          "{alert.details}"
        </p>

        {isPending && onMarkReviewed && (
          <button
            onClick={() => onMarkReviewed(alert.id)}
            className="px-4 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Mark Reviewed</span>
          </button>
        )}
      </div>
    </div>
  );
};
