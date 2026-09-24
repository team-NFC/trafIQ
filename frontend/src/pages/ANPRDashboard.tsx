import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { anprService, CityWideCorrelationSummary } from '../api/anpr';
import { ANPRCameraSummary, PlateObservation } from '../types/anpr';
import { ANPRCameraCard } from '../components/anpr/ANPRCameraCard';
import { PlateSearchBox } from '../components/anpr/PlateSearchBox';
import { PlateReadsTable } from '../components/anpr/PlateReadsTable';
import { StatCard } from '../components/common/StatCard';
import { ScanLine, Layers, Route, Eye, RefreshCw } from 'lucide-react';

export const ANPRDashboard: React.FC = () => {
  const { isDemoMode, setCurrentPage, setSearchedPlate } = useApp();
  const [cameras, setCameras] = useState<ANPRCameraSummary[]>([]);
  const [recentReads, setRecentReads] = useState<PlateObservation[]>([]);
  const [summary, setSummary] = useState<CityWideCorrelationSummary | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchANPRData = async () => {
    setLoading(true);
    const [cRes, rRes, sRes] = await Promise.all([
      anprService.getANPRCameras(),
      anprService.getRecentPlateReads(),
      anprService.getCityWideSummary(),
    ]);

    if (cRes.data) setCameras(cRes.data);
    if (rRes.data) setRecentReads(rRes.data);
    if (sRes.data) setSummary(sRes.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchANPRData();
  }, [isDemoMode]);

  const handleSearch = (plate: string) => {
    setSearchedPlate(plate);
    setCurrentPage('anpr_search');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-purple-400" />
            <span>ANPR / CITY-WIDE VEHICLE INTELLIGENCE</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Automatic Number Plate Recognition, temporal confirmation & multi-camera vehicle tracking
          </p>
        </div>

        <button
          onClick={fetchANPRData}
          className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync ANPR</span>
        </button>
      </div>

      {/* Top Search Box */}
      <PlateSearchBox onSearch={handleSearch} isLoading={loading} />

      {/* ANPR Telemetry Summary KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <StatCard
          title="Unique Vehicles"
          value={summary ? summary.uniqueVehiclesCount : '--'}
          subtitle="Identified today"
          icon={Layers}
          color="purple"
        />
        <StatCard
          title="Multi-Camera Trips"
          value={summary ? summary.multiCameraTripsCount : '--'}
          subtitle="Correlated journeys"
          icon={Route}
          color="cyan"
        />
        <StatCard
          title="Single-Camera Reads"
          value={summary ? summary.singleCameraObservationsCount : '--'}
          subtitle="Isolated checkpoint visits"
          icon={Eye}
          color="blue"
        />
        <StatCard
          title="Active ANPR Feeds"
          value={cameras.length > 0 ? `${cameras.filter(c => c.status !== 'OFFLINE').length}/${cameras.length}` : '--'}
          subtitle="Surveillance nodes online"
          icon={ScanLine}
          color="emerald"
        />
      </div>

      {/* Dynamic Camera Grid (CAM 01 - CAM 05+) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            City-Wide Surveillance Nodes ({cameras.length} Cameras Configured)
          </h3>
          <span className="text-[10px] text-purple-300 font-mono">
            DYNAMIC EXPANSION READY
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {cameras.map((cam) => (
            <ANPRCameraCard
              key={cam.cameraId}
              camera={cam}
              onSelectPlate={handleSearch}
            />
          ))}
        </div>
      </div>

      {/* Latest Plate Reads Table */}
      <PlateReadsTable
        observations={recentReads}
        onSelectPlate={handleSearch}
      />
    </div>
  );
};
