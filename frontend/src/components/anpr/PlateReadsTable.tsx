import React, { useState } from 'react';
import { PlateObservation } from '../../types/anpr';
import { Search, Filter, ShieldCheck, AlertTriangle } from 'lucide-react';

interface PlateReadsTableProps {
  observations: PlateObservation[];
  onSelectPlate?: (plate: string) => void;
}

export const PlateReadsTable: React.FC<PlateReadsTableProps> = ({
  observations,
  onSelectPlate
}) => {
  const [filterText, setFilterText] = useState('');
  const [cameraFilter, setCameraFilter] = useState('ALL');

  const filtered = observations.filter((obs) => {
    const matchesQuery =
      obs.vehicleClass.toLowerCase().includes(filterText.toLowerCase()) ||
      obs.location.toLowerCase().includes(filterText.toLowerCase()) ||
      obs.cameraName.toLowerCase().includes(filterText.toLowerCase());

    const matchesCam = cameraFilter === 'ALL' || obs.cameraName === cameraFilter;

    return matchesQuery && matchesCam;
  });

  return (
    <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] overflow-hidden flex flex-col">
      {/* Table Controls */}
      <div className="p-4 bg-[#0d1326] border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Latest Plate Reads & Observation Log
          </h3>
          <span className="text-xs text-slate-400">
            Live sequential OCR plate localization and verification stream
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick search */}
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter location / class..."
              className="h-8 pl-8 pr-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-500"
            />
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          </div>

          {/* Camera filter */}
          <div className="flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={cameraFilter}
              onChange={(e) => setCameraFilter(e.target.value)}
              className="h-8 px-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All CAMs</option>
              <option value="CAM 01">CAM 01</option>
              <option value="CAM 02">CAM 02</option>
              <option value="CAM 03">CAM 03</option>
              <option value="CAM 04">CAM 04</option>
              <option value="CAM 05">CAM 05</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase text-[10px] tracking-wider">
              <th className="py-3 px-4">Plate Number</th>
              <th className="py-3 px-4">Vehicle Class</th>
              <th className="py-3 px-4">Camera</th>
              <th className="py-3 px-4">Location</th>
              <th className="py-3 px-4">Timestamp</th>
              <th className="py-3 px-4">OCR Confidence</th>
              <th className="py-3 px-4 text-right">Watchlist Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400 font-sans text-xs">
                  No plate reads matching current filter criteria.
                </td>
              </tr>
            ) : (
              filtered.map((obs, idx) => {
                const isWatchlist = obs.cameraId === 'cam04' && obs.vehicleClass === 'Car';
                return (
                  <tr
                    key={idx}
                    className="hover:bg-slate-900/50 transition cursor-pointer"
                    onClick={() => onSelectPlate && onSelectPlate('TN45BB7890')}
                  >
                    <td className="py-3 px-4 font-bold text-yellow-300">
                      <span className="bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                        TN45BB7890
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-300 font-sans">{obs.vehicleClass}</td>
                    <td className="py-3 px-4 text-purple-300 font-bold">{obs.cameraName}</td>
                    <td className="py-3 px-4 text-slate-400 font-sans max-w-[200px] truncate">
                      {obs.location}
                    </td>
                    <td className="py-3 px-4 text-cyan-300">{obs.timestamp}</td>
                    <td className="py-3 px-4 text-emerald-400 font-bold">
                      {(obs.confidence * 100).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4 text-right">
                      {isWatchlist ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-950/70 border border-red-500/40 text-red-300 text-[10px] font-sans font-bold">
                          <AlertTriangle className="w-3 h-3 text-red-400" />
                          DATABASE MATCH
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-[10px] font-sans font-semibold">
                          <ShieldCheck className="w-3 h-3 text-emerald-400" />
                          Clear
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
