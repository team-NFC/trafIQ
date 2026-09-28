import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../api/client';
import {
  Settings,
  Cpu,
  Server,
  Shield,
  CheckCircle2,
  FileText,
  UploadCloud,
  Plus,
  Download,
  AlertTriangle,
  Loader2,
  ShieldAlert
} from 'lucide-react';

interface FIRCaseItem {
  id: string;
  plate: string;
  fir_number: string;
  police_station: string;
  ipc_sections: string;
  case_status: string;
  vehicle_class: string;
  vehicle_model: string;
  severity: string;
  investigating_officer: string;
  flagged_date: string;
  description: string;
}

export const SettingsPage: React.FC = () => {
  const { isDemoMode, setDemoMode, setCurrentPage } = useApp();
  const [apiUrl, setApiUrl] = useState(apiClient.getBaseUrl());
  const [savedNotice, setSavedNotice] = useState(false);

  // FIR Registration State
  const [firActiveTab, setFirActiveTab] = useState<'form' | 'upload'>('form');
  const [plate, setPlate] = useState('');
  const [firNumber, setFirNumber] = useState('');
  const [policeStation, setPoliceStation] = useState('Trichy West Police Station');
  const [ipcSections, setIpcSections] = useState('IPC 379 (Vehicle Theft) / BNS 303');
  const [vehicleClass, setVehicleClass] = useState('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [severity, setSeverity] = useState('HIGH');
  const [officer, setOfficer] = useState('Insp. R. Sundaram (Badge #TN-4521)');
  const [description, setDescription] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firSuccess, setFirSuccess] = useState<string | null>(null);
  const [firError, setFirError] = useState<string | null>(null);
  const [totalCases, setTotalCases] = useState<number>(0);

  // Batch file upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fetchCasesCount = async () => {
    try {
      const res = await apiClient.get<FIRCaseItem[]>('/api/database/cases');
      if (res.data) {
        setTotalCases(res.data.length);
      }
    } catch (e) {
      // Fallback
    }
  };

  useEffect(() => {
    fetchCasesCount();
  }, []);

  const handleSaveUrl = (e: React.FormEvent) => {
    e.preventDefault();
    apiClient.setBaseUrl(apiUrl);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleRegisterFIR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plate.trim() || !firNumber.trim()) {
      setFirError('License Plate and FIR Reference Number are required.');
      return;
    }

    setIsSubmitting(true);
    setFirError(null);
    setFirSuccess(null);

    try {
      const res = await apiClient.post<any>('/api/database/cases', {
        plate: plate.trim().toUpperCase(),
        fir_number: firNumber.trim(),
        police_station: policeStation.trim(),
        ipc_sections: ipcSections.trim(),
        case_status: 'ACTIVE CASE',
        vehicle_class: vehicleClass,
        vehicle_model: vehicleModel.trim() || 'Passenger Vehicle',
        severity: severity,
        investigating_officer: officer.trim(),
        description: description.trim() || 'Warrant registered via System Settings'
      });

      if (res.data && res.data.status === 'success') {
        setFirSuccess(`✓ FIR Case ${firNumber} registered successfully for plate ${plate.toUpperCase()}! Optical ANPR matching is now active.`);
        setPlate('');
        setFirNumber('');
        setVehicleModel('');
        setDescription('');
        fetchCasesCount();
        setTimeout(() => setFirSuccess(null), 6000);
      } else {
        setFirError(res.error || 'Failed to register FIR case');
      }
    } catch (err: any) {
      setFirError(err.message || 'Error communicating with database');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setFirError('Please select a CSV or JSON file to upload.');
      return;
    }

    setIsUploading(true);
    setFirError(null);
    setFirSuccess(null);

    try {
      const formData = new FormData();
      formData.append('file', uploadFile);

      const response = await fetch(`${apiClient.getBaseUrl()}/api/database/cases/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setFirSuccess(`✓ ${data.message || `Imported ${data.imported} cases successfully!`}`);
        setUploadFile(null);
        fetchCasesCount();
        setTimeout(() => setFirSuccess(null), 6000);
      } else {
        setFirError(data.detail || data.message || 'Upload failed');
      }
    } catch (err: any) {
      setFirError(err.message || 'File upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const downloadSampleCSV = () => {
    const csvContent = "data:text/csv;charset=utf-8," + 
      "plate,fir_number,police_station,ipc_sections,vehicle_model,severity,investigating_officer,description\n" +
      "TN 45 BB 7890,FIR #482/2026,Trichy West Police Station,IPC 379 (Vehicle Theft),Maruti Suzuki Swift (White),HIGH,Insp. R. Sundaram,Stolen white hatchback reported in commercial zone\n" +
      "TN 45 XX 1234,FIR #319/2026,Trichy Central Crime Branch,IPC 420 / 468,Hyundai Creta (Dark Grey),HIGH,SI K. Manickam,Duplicate chassis stamp and fraudulent registration\n" +
      "TN 45 CC 9999,FIR #510/2026,Cantonment Police Station,IPC 279 / 338,Tata Nexon (Silver),CRITICAL,Insp. M. Balan,Hit and run investigation flagged by traffic division\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "fir_cases_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 max-w-4xl pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <Settings className="w-5 h-5 text-slate-400" />
          <span>SYSTEM CONFIGURATION & FIR REGISTRATION</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Backend endpoint bindings, police FIR warrant uploads, and workstation telemetry
        </p>
      </div>

      {savedNotice && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Configuration saved successfully.</span>
        </div>
      )}

      {/* =========================================================================
          FEATURE 5: LAW ENFORCEMENT FIR CASE REGISTRATION & UPLOAD
          ========================================================================= */}
      <div className="rounded-xl border border-purple-500/30 bg-[#0d1222] p-5 space-y-4 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-purple-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                LAW ENFORCEMENT FIR CASE REGISTRATION & UPLOAD
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                ANPR MATCHING ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-xl">
              Register targeted vehicles and criminal warrants. TrafficIQ will trigger immediate optical ANPR alerts whenever any camera spots a matching license plate.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-right">
              <span className="text-[10px] uppercase font-mono text-slate-400 block">Registered Cases</span>
              <span className="text-sm font-bold font-mono text-purple-300">{totalCases} Active</span>
            </div>
            <button
              onClick={() => setCurrentPage('database_alerts')}
              className="text-xs font-mono text-purple-400 hover:text-purple-300 transition cursor-pointer underline"
            >
              View Registry →
            </button>
          </div>
        </div>

        {/* Tab Controls: Manual Entry vs Batch Upload */}
        <div className="flex gap-2 border-b border-white/[0.06] pb-2 font-mono text-xs">
          <button
            type="button"
            onClick={() => setFirActiveTab('form')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              firActiveTab === 'form'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Manual Case Entry</span>
          </button>
          <button
            type="button"
            onClick={() => setFirActiveTab('upload')}
            className={`px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1.5 ${
              firActiveTab === 'upload'
                ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span>Batch Upload (CSV / JSON)</span>
          </button>
        </div>

        {/* Notifications */}
        {firSuccess && (
          <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-200 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{firSuccess}</span>
          </div>
        )}
        {firError && (
          <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{firError}</span>
          </div>
        )}

        {/* VIEW 1: MANUAL ENTRY FORM */}
        {firActiveTab === 'form' && (
          <form onSubmit={handleRegisterFIR} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  TARGET LICENSE PLATE *
                </label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="e.g. TN 45 BB 7890"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-purple-200 uppercase font-bold tracking-wider focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1 font-semibold">
                  FIR REFERENCE NUMBER *
                </label>
                <input
                  type="text"
                  value={firNumber}
                  onChange={(e) => setFirNumber(e.target.value)}
                  placeholder="e.g. FIR #482/2026"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                  required
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  POLICE STATION / JURISDICTION
                </label>
                <input
                  type="text"
                  value={policeStation}
                  onChange={(e) => setPoliceStation(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  IPC / BNS SECTIONS & CHARGES
                </label>
                <input
                  type="text"
                  value={ipcSections}
                  onChange={(e) => setIpcSections(e.target.value)}
                  placeholder="e.g. IPC 379 (Vehicle Theft)"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  VEHICLE MAKE, MODEL & COLOR
                </label>
                <input
                  type="text"
                  value={vehicleModel}
                  onChange={(e) => setVehicleModel(e.target.value)}
                  placeholder="e.g. Maruti Suzuki Swift (White)"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  VEHICLE CLASSIFICATION
                </label>
                <select
                  value={vehicleClass}
                  onChange={(e) => setVehicleClass(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="car">Car / Sedan / Hatchback / SUV</option>
                  <option value="motorcycle">Motorcycle / Two-Wheeler</option>
                  <option value="bus">Bus / Heavy Passenger Transit</option>
                  <option value="truck">Truck / Commercial Hauler</option>
                  <option value="ambulance">Emergency Ambulance / First Responder</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  SEVERITY / WARRANT LEVEL
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  <option value="CRITICAL">CRITICAL (Immediate Arrest & Interception)</option>
                  <option value="HIGH">HIGH (Felony / Vehicle Theft)</option>
                  <option value="MEDIUM">MEDIUM (Verification / Duplicate Plate)</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  INVESTIGATING OFFICER & BADGE
                </label>
                <input
                  type="text"
                  value={officer}
                  onChange={(e) => setOfficer(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 block mb-1">
                  INCIDENT SUMMARY / CASE NOTES
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Stolen from Cantonment Commercial Zone parking"
                  className="w-full h-10 px-3 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 h-10 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs font-mono transition cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Registering Case...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="w-4 h-4" />
                    <span>Commit Case to FIR Registry</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* VIEW 2: BATCH CSV / JSON FILE UPLOAD */}
        {firActiveTab === 'upload' && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-dashed border-white/20 bg-white/[0.02] flex flex-col items-center justify-center text-center space-y-2">
              <UploadCloud className="w-8 h-8 text-purple-400" />
              <div className="text-xs text-slate-300 font-semibold">
                Upload Police Registry File (CSV or JSON)
              </div>
              <p className="text-[11px] text-slate-400 max-w-md">
                Files must contain license plate numbers. Columns supported: <code>plate</code>, <code>fir_number</code>, <code>police_station</code>, <code>ipc_sections</code>, <code>vehicle_model</code>, <code>severity</code>.
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3 justify-center">
                <input
                  type="file"
                  accept=".csv,.json"
                  onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  className="text-xs text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-purple-500/40 file:text-xs file:font-mono file:bg-purple-900/30 file:text-purple-200 hover:file:bg-purple-900/50 cursor-pointer"
                />
                <button
                  type="button"
                  onClick={downloadSampleCSV}
                  className="px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.04] text-[11px] font-mono text-slate-300 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download Template CSV</span>
                </button>
              </div>
            </div>

            {uploadFile && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-purple-950/40 border border-purple-500/30 text-xs font-mono">
                <div className="flex items-center gap-2 text-purple-300">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Selected: <strong>{uploadFile.name}</strong> ({(uploadFile.size / 1024).toFixed(1)} KB)</span>
                </div>
                <button
                  onClick={handleFileUpload}
                  disabled={isUploading}
                  className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Importing...</span>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>Start Batch Import</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Demo Mode / Live Backend Toggle */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Telemetry Data Mode</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 max-w-lg">
              Toggle between offline hackathon demonstration data and live Python FastAPI backend streams.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setDemoMode(!isDemoMode)}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer border flex items-center gap-2 ${
              isDemoMode
                ? 'bg-purple-900/60 border-purple-500 text-purple-200'
                : 'bg-emerald-900/60 border-emerald-500 text-emerald-200'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isDemoMode ? 'bg-purple-400' : 'bg-emerald-400'} animate-pulse`} />
            <span>{isDemoMode ? 'MODE: DEMO SIMULATION' : 'MODE: LIVE BACKEND API'}</span>
          </button>
        </div>

        <div className="text-xs text-slate-400 bg-slate-950 p-3.5 rounded-lg border border-slate-800">
          <strong>Data Policy:</strong> TrafficIQ never manufactures synthetic production alerts. When connected to live backend APIs, all values strictly reflect the OpenCV/YOLO inference results from Python.
        </div>
      </div>

      {/* Backend API Endpoint Configuration */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-4 h-4 text-cyan-400" />
            <span>FastAPI Server Endpoint</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Local or network URL for the TrafficIQ Python service
          </p>
        </div>

        <form onSubmit={handleSaveUrl} className="flex gap-3">
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            className="flex-1 h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-200 font-mono text-xs focus:outline-none focus:border-cyan-500"
            placeholder="http://localhost:8000"
          />
          <button
            type="submit"
            className="px-5 h-11 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer shadow-md"
          >
            Save URL
          </button>
        </form>
      </div>

      {/* Workstation Hardware Specifications (System Resources) */}
      <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3.5">
        <div className="border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span>System Resources & Host Environment</span>
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Hardware acceleration profiles verified on this workstation
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Inference GPU</span>
            <span className="font-bold text-white text-xs block">NVIDIA RTX 3050 Laptop</span>
            <span className="text-[10px] text-emerald-400 font-mono">CUDA 12.4 • 4GB VRAM</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Host Python</span>
            <span className="font-bold text-white text-xs block">Python 3.12.10</span>
            <span className="text-[10px] text-cyan-400 font-mono">PyTorch 2.6.0+cu124</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">Computer Vision</span>
            <span className="font-bold text-white text-xs block">OpenCV 4.10.0</span>
            <span className="text-[10px] text-purple-400 font-mono">DirectShow UVC Capture</span>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">AI Engine</span>
            <span className="font-bold text-white text-xs block">Ultralytics YOLOv8</span>
            <span className="text-[10px] text-amber-400 font-mono">Custom 5-Class Weights</span>
          </div>
        </div>
      </div>
    </div>
  );
};
