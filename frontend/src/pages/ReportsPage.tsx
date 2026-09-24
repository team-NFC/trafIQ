import React, { useState } from 'react';
import { FileText, Download, Printer, ShieldCheck, CheckCircle2 } from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const [selectedReport, setSelectedReport] = useState('TRAFFIC_AUDIT');
  const [notification, setNotification] = useState<string | null>(null);

  const reportTypes = [
    { id: 'TRAFFIC_AUDIT', name: 'Junction Traffic Volume & Queue Audit', category: 'Traffic' },
    { id: 'AMBULANCE_LOG', name: 'Emergency Vehicle Preemption (EVP) Action Log', category: 'Emergency' },
    { id: 'ANPR_SUMMARY', name: 'City-Wide Multi-Camera Plate Surveillance Log', category: 'ANPR' },
    { id: 'JOURNEY_TRACE', name: 'Cross-Camera Vehicle Correlation & Trajectory Report', category: 'ANPR' },
    { id: 'DATABASE_MATCHES', name: 'Law Enforcement Watchlist Inquiries & Sign-Offs', category: 'Security' },
    { id: 'SIGNAL_EVENTS', name: 'Phase Cycle Transition & Safety Clearance Audit', category: 'Signals' },
  ];

  const handleExport = (format: 'CSV' | 'JSON') => {
    setNotification(`Report generated as ${format}. Saved to system audit vault.`);
    setTimeout(() => setNotification(null), 4000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <FileText className="w-5 h-5 text-slate-400" />
          <span>SYSTEM AUDIT REPORTS & DATA EXPORTS</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Generate tamper-evident logs for municipal traffic authorities, emergency services, and smart-city operators
        </p>
      </div>

      {notification && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Grid: Selector Left, Preview Right */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report Types */}
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-4.5 space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-2.5">
            Select Report Template
          </h3>

          <div className="space-y-2">
            {reportTypes.map((rep) => (
              <div
                key={rep.id}
                onClick={() => setSelectedReport(rep.id)}
                className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                  selectedReport === rep.id
                    ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase font-semibold font-mono text-cyan-400">
                    {rep.category}
                  </span>
                  {selectedReport === rep.id && (
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  )}
                </div>
                <div className="font-semibold text-slate-200">{rep.name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Document Preview */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-[#0a0f1d] p-6 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono font-bold text-cyan-400">
                  DOCUMENT PREVIEW
                </span>
                <h3 className="text-base font-bold text-white">
                  {reportTypes.find((r) => r.id === selectedReport)?.name}
                </h3>
                <span className="text-xs text-slate-500 font-mono">
                  Generated: {new Date().toISOString()} | Ref: TRQ-2026-X84
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('CSV')}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-white flex items-center gap-1.5 transition cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
                <button
                  onClick={() => handleExport('JSON')}
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-xs text-white font-semibold flex items-center gap-1.5 transition cursor-pointer shadow-md"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Export JSON</span>
                </button>
              </div>
            </div>

            {/* Mock Report Content */}
            <div className="p-4 rounded-lg bg-[#060a14] border border-slate-800 font-mono text-xs text-slate-300 space-y-2 overflow-x-auto">
              <div className="text-slate-500">// TrafficIQ Autonomous Telemetry Snapshot</div>
              <div>OPERATOR: AI Analyst (Operations Desk 01)</div>
              <div>JUNCTION: Anna Nagar 4-Way Complex (Lat: 13.0827, Lon: 80.2707)</div>
              <div>PERIOD: 2026-09-21 00:00:00 to 2026-09-21 23:59:59</div>
              <div>VERIFIED CAMERAS: CAM01 (North), CAM02 (East), CAM03 (South), CAM04 (West), CAM05 (Surveillance)</div>
              <div className="text-slate-500">------------------------------------------------------------</div>
              <div>CUMULATIVE VEHICLES LOGGED : 1,420</div>
              <div>EMERGENCY PREEMPTION EVENTS: 3 (Cleared with zero conflict)</div>
              <div>PLATE OBSERVATION RECORDS  : 184 unique plates (93.8% mean OCR confidence)</div>
              <div>WATCHLIST NOTIFICATIONS    : 1 (Marked pending officer sign-off)</div>
              <div className="text-slate-500">------------------------------------------------------------</div>
              <div className="text-emerald-400">INTEGRITY HASH: SHA256-e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              Cryptographically verified audit trail compliant with smart-city standards
            </span>
            <span className="font-mono text-[11px] text-cyan-400 font-bold">STATUS: READY</span>
          </div>
        </div>
      </div>
    </div>
  );
};
