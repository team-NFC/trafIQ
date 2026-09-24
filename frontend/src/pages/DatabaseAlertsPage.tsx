import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { alertService } from '../api/alerts';
import { DatabaseAlertItem } from '../types/alert';
import { StatCard } from '../components/common/StatCard';
import { ShieldAlert, AlertTriangle, CheckCircle2, Clock, Eye, Check } from 'lucide-react';

export const DatabaseAlertsPage: React.FC = () => {
  const { isDemoMode, setSearchedPlate, setCurrentPage } = useApp();
  const [alerts, setAlerts] = useState<DatabaseAlertItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'REVIEWED'>('ALL');

  useEffect(() => {
    const fetchAlerts = async () => {
      const res = await alertService.getDatabaseWatchlist();
      if (res.data) setAlerts(res.data);
    };
    fetchAlerts();
  }, [isDemoMode]);

  const handleMarkReviewed = (id: string) => {
    setAlerts((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'REVIEWED' } : item))
    );
  };

  const pendingCount = alerts.filter((a) => a.status === 'PENDING_REVIEW').length;
  const reviewedCount = alerts.filter((a) => a.status === 'REVIEWED').length;

  const filteredAlerts = alerts.filter((a) => {
    if (filter === 'PENDING') return a.status === 'PENDING_REVIEW';
    if (filter === 'REVIEWED') return a.status === 'REVIEWED';
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-amber-400" />
          <span>POLICE / FIR DATABASE WATCHLIST MATCHES</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Law enforcement inquiry database integration with strict protocol for authorized verification
        </p>
      </div>

      {/* Safety Notice Banner */}
      <div className="p-3.5 rounded-xl bg-amber-950/20 border border-amber-500/30 flex items-start gap-3 text-xs text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <p>
          <strong className="text-white">Operator Protocol Notice:</strong> A database match signifies that an automated ANPR read corresponds with an entry in stored police inquiry or municipal records. It does NOT establish guilt or legal determination. All notifications require formal verification by a designated desk officer.
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          title="Total Matches"
          value={alerts.length}
          subtitle="All recorded matches"
          icon={ShieldAlert}
          color="purple"
        />
        <StatCard
          title="Pending Review"
          value={pendingCount}
          subtitle="Requires officer sign-off"
          icon={Clock}
          color="amber"
        />
        <StatCard
          title="Verified & Resolved"
          value={reviewedCount}
          subtitle="Action logged"
          icon={CheckCircle2}
          color="emerald"
        />
        <StatCard
          title="Integration Status"
          value="ACTIVE"
          subtitle="Direct FIR Sync v2.4"
          icon={Eye}
          color="cyan"
        />
      </div>

      {/* Filter Tabs & Table */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] overflow-hidden">
        <div className="p-4 bg-[#0d1326] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Database Alert Records
            </h3>
            <span className="text-xs text-slate-500">
              Filtered by verification workflow status
            </span>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-slate-900 border border-slate-800">
            <button
              onClick={() => setFilter('ALL')}
              className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                filter === 'ALL' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({alerts.length})
            </button>
            <button
              onClick={() => setFilter('PENDING')}
              className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                filter === 'PENDING' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Pending ({pendingCount})
            </button>
            <button
              onClick={() => setFilter('REVIEWED')}
              className={`px-3 py-1 rounded text-xs font-semibold transition cursor-pointer ${
                filter === 'REVIEWED' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              Reviewed ({reviewedCount})
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider font-mono">
                <th className="py-3 px-4">Registration</th>
                <th className="py-3 px-4">Record Classification</th>
                <th className="py-3 px-4">Detection Camera</th>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Investigation Details</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Officer Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredAlerts.map((item) => {
                const isPending = item.status === 'PENDING_REVIEW';
                return (
                  <tr key={item.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-4 font-bold text-yellow-300">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        {item.plate}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-200 font-sans font-semibold">
                      {item.recordType}
                    </td>
                    <td className="py-3 px-4 text-purple-300 font-bold">
                      {item.cameraName}
                      <span className="text-[10px] text-slate-500 font-normal block font-sans">
                        {item.location}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-cyan-300">{item.detectionTime}</td>
                    <td className="py-3 px-4 text-slate-400 font-sans max-w-[280px]">
                      {item.details}
                    </td>
                    <td className="py-3 px-4">
                      {isPending ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-300 text-[10px] font-sans font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                          Pending Review
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-sans font-semibold">
                          <Check className="w-3 h-3 text-emerald-400" />
                          Reviewed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-sans">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setSearchedPlate(item.plate);
                            setCurrentPage('anpr_search');
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition cursor-pointer"
                        >
                          Trace
                        </button>
                        {isPending && (
                          <button
                            onClick={() => handleMarkReviewed(item.id)}
                            className="px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold transition cursor-pointer"
                          >
                            Sign Off
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
