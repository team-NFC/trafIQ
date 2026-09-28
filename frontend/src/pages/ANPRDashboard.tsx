import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { anprService, CityWideCorrelationSummary } from '../api/anpr';
import { ANPRCameraSummary, PlateObservation } from '../types/anpr';
import { ANPRCameraCard } from '../components/anpr/ANPRCameraCard';
import { PlateSearchBox } from '../components/anpr/PlateSearchBox';
import { PlateReadsTable } from '../components/anpr/PlateReadsTable';
import { StatCard } from '../components/common/StatCard';
import { ScanLine, Layers, Route, Eye, RefreshCw, UploadCloud, CheckCircle2 } from 'lucide-react';
import { apiClient } from '../api/client';

export const ANPRDashboard: React.FC = () => {
  const { isDemoMode, setCurrentPage, setSearchedPlate } = useApp();
  const [cameras, setCameras] = useState<ANPRCameraSummary[]>([]);
  const [recentReads, setRecentReads] = useState<PlateObservation[]>([]);
  const [summary, setSummary] = useState<CityWideCorrelationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleSelectPlateForTracking = (plate: string) => {
    setSearchedPlate(plate);
    setCurrentPage('camera_tracking');
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiClient.getBaseUrl()}/api/anpr/upload-csv`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadMsg(`✓ Successfully imported ${data.imported ?? data.total_cases ?? 0} authorized vehicle records from CSV`);
        fetchANPRData();
      } else {
        setUploadMsg(`⚠ Upload failed: ${data.detail || 'Invalid CSV format'}`);
      }
    } catch (err: any) {
      setUploadMsg(`⚠ Upload error: ${err.message}`);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setTimeout(() => setUploadMsg(null), 6000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hidden CSV File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        onChange={handleFileUpload}
        className="hidden"
      />

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

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 rounded-lg bg-purple-900/40 border border-purple-500/40 text-xs text-purple-200 hover:bg-purple-800/50 hover:text-white flex items-center gap-1.5 cursor-pointer transition disabled:opacity-50"
            title="Upload CSV to match detected plates against authorized database"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>{uploading ? 'Importing CSV...' : 'Upload Database CSV'}</span>
          </button>

          <button
            onClick={fetchANPRData}
            className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Sync ANPR</span>
          </button>
        </div>
      </div>

      {/* Upload Confirmation Alert Banner */}
      {uploadMsg && (
        <div className={`p-3 rounded-xl border text-xs font-mono flex items-center justify-between transition-all ${
          uploadMsg.startsWith('✓')
            ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
        }`}>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{uploadMsg}</span>
          </div>
          <button
            onClick={() => setUploadMsg(null)}
            className="text-xs opacity-60 hover:opacity-100 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Top Search Box */}
      <PlateSearchBox onSearch={handleSelectPlateForTracking} isLoading={loading} />

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
              onSelectPlate={handleSelectPlateForTracking}
            />
          ))}
        </div>
      </div>

      {/* Latest Plate Reads Table */}
      <PlateReadsTable
        observations={recentReads}
        onSelectPlate={handleSelectPlateForTracking}
      />
    </div>
  );
};
