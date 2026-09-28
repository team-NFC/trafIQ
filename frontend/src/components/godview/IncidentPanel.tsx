import React from 'react';
import { IncidentsResponse } from '../../api/godview';
import { ShieldAlert, Clock } from 'lucide-react';
import { apiClient } from '../../api/client';

interface IncidentPanelProps {
  incidents: IncidentsResponse | null;
}

export const IncidentPanel: React.FC<IncidentPanelProps> = ({ incidents }) => {
  if (!incidents || !incidents.incidents) return null;

  const baseUrl = apiClient.getBaseUrl();

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#090e1a] p-5 space-y-4 shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-cyan-400" />
          <h3 className="text-sm font-black font-mono tracking-wider uppercase text-white">
            INCIDENT AUDIT & EVIDENCE LOG
          </h3>
        </div>
        <span className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
          {incidents.incidents.length} REAL EVENTS
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {incidents.incidents.map((inc) => {
          const imgUrl = inc.evidence_url ? `${baseUrl}${inc.evidence_url}` : null;
          return (
            <div
              key={inc.id}
              className="p-3.5 rounded-xl border border-slate-800 bg-[#060a12] flex flex-col justify-between space-y-3 hover:border-slate-700 transition"
            >
              <div>
                <div className="flex items-center justify-between text-[11px] font-mono mb-1">
                  <span className="text-cyan-400 font-bold">{inc.id}</span>
                  <span className="text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {inc.timestamp}
                  </span>
                </div>

                <div className="text-xs font-bold text-white font-sans">{inc.title}</div>
                <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {inc.camera} • {inc.plate || inc.vehicle}
                </div>

                <p className="text-[11px] text-slate-400 font-sans mt-2 line-clamp-2 leading-relaxed">
                  {inc.description}
                </p>
              </div>

              {/* Evidence Snapshot Image */}
              {imgUrl && (
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="relative rounded-lg overflow-hidden border border-slate-800 bg-black aspect-video flex items-center justify-center">
                    <img
                      src={imgUrl}
                      alt={inc.title}
                      className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        // Fallback gracefully if image fails
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <span className="absolute bottom-1 right-1 text-[9px] bg-black/80 text-cyan-300 px-1.5 py-0.2 rounded font-mono">
                      CCTV SNAPSHOT
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between text-[10px] font-mono pt-1 text-slate-500">
                <span>Confidence: {(inc.confidence * 100).toFixed(1)}%</span>
                <span className="text-emerald-400 font-bold">{inc.status}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
