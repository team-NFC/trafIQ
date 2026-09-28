import React, { useState, useEffect } from 'react';
import { JunctionItem, CreateCameraPayload, godViewService } from '../../api/godview';
import {
  X,
  Video,
  Crosshair,
  AlertCircle,
  Loader2,
  MapPin
} from 'lucide-react';

interface AddJunctionModalProps {
  isOpen: boolean;
  initialLat?: number | null;
  initialLon?: number | null;
  existingJunctionsCount?: number;
  existingCamerasCount?: number;
  onClose: () => void;
  onJunctionAdded: (junction: JunctionItem) => void;
  onPickOnMap: (targetIndex?: number | 'junction') => void;
}

const FOOTAGE_OPTIONS = [
  // Normal situation cam 1,2,3,4
  { id: 'CAM-01', label: 'CAM-01 • Normal Situation Camera 1', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-02', label: 'CAM-02 • Normal Situation Camera 2', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-03', label: 'CAM-03 • Normal Situation Camera 3', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-04', label: 'CAM-04 • Normal Situation Camera 4', group: 'Normal Traffic (CAM 01–04)' },
  // Ambulance situation cam 1,2,3,4
  { id: 'CAM-05', label: 'CAM-05 • Ambulance Situation Camera 1', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-06', label: 'CAM-06 • Ambulance Situation Camera 2', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-07', label: 'CAM-07 • Ambulance Situation Camera 3', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-08', label: 'CAM-08 • Ambulance Situation Camera 4', group: 'Ambulance & EVP (CAM 05–08)' },
  // ANPR cam 1,2,3,4,5,6,7,8
  { id: 'CAM-09', label: 'CAM-09 • ANPR Camera 1', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-10', label: 'CAM-10 • ANPR Camera 2', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-11', label: 'CAM-11 • ANPR Camera 3', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-12', label: 'CAM-12 • ANPR Camera 4', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-13', label: 'CAM-13 • ANPR Camera 5', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-14', label: 'CAM-14 • ANPR Camera 6', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-15', label: 'CAM-15 • ANPR Camera 7', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-16', label: 'CAM-16 • ANPR Camera 8', group: 'ANPR Tracking (CAM 09–16)' },
];

const DEFAULT_APPROACHES = ['North', 'East', 'South', 'West', 'North-East', 'South-East', 'North-West', 'South-West'];

interface ConfigCamRow {
  id: string;
  name: string;
  direction: string;
  videoSource: string;
  lat: string;
  lon: string;
  cameraType: string;
}

export const AddJunctionModal: React.FC<AddJunctionModalProps> = ({
  isOpen,
  initialLat,
  initialLon,
  existingJunctionsCount = 0,
  existingCamerasCount = 0,
  onClose,
  onJunctionAdded,
  onPickOnMap
}) => {
  const [juncName, setJuncName] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [juncLat, setJuncLat] = useState<string>('');
  const [juncLon, setJuncLon] = useState<string>('');
  const [description, setDescription] = useState<string>('Adaptive Signal Junction');
  const [signalType, setSignalType] = useState<string>('Adaptive');
  const [numCameras, setNumCameras] = useState<number>(4);
  const [cameraRows, setCameraRows] = useState<ConfigCamRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or update junction details & fresh approach cameras
  useEffect(() => {
    if (isOpen) {
      const nextJuncNum = existingJunctionsCount + 1;
      setJuncName(`Junction JUNC-${String(nextJuncNum).padStart(2, '0')}`);
      const curLat = initialLat !== undefined && initialLat !== null ? initialLat : 10.7905;
      const curLon = initialLon !== undefined && initialLon !== null ? initialLon : 78.7047;
      setJuncLat(initialLat !== undefined && initialLat !== null ? initialLat.toFixed(6) : '');
      setJuncLon(initialLon !== undefined && initialLon !== null ? initialLon.toFixed(6) : '');
      setError(null);

      // Generate brand-new isolated camera IDs for this new junction
      const baseCamIndex = Math.max(existingCamerasCount, existingJunctionsCount * 4);
      const rows: ConfigCamRow[] = [];
      for (let i = 0; i < numCameras; i++) {
        const camNum = baseCamIndex + i + 1;
        const defaultDir = DEFAULT_APPROACHES[i % DEFAULT_APPROACHES.length];
        let offsetLat = curLat;
        let offsetLon = curLon;
        if (defaultDir === 'North') offsetLat += 0.00035;
        else if (defaultDir === 'South') offsetLat -= 0.00035;
        else if (defaultDir === 'East') offsetLon += 0.00035;
        else if (defaultDir === 'West') offsetLon -= 0.00035;

        const camId = `CAM-${String(camNum).padStart(2, '0')}`;
        rows.push({
          id: camId,
          name: `Camera ${camId} (${defaultDir} Approach)`,
          direction: defaultDir,
          videoSource: `CAM-${String(((camNum - 1) % 8) + 1).padStart(2, '0')}`,
          lat: initialLat !== undefined && initialLat !== null ? offsetLat.toFixed(6) : '',
          lon: initialLon !== undefined && initialLon !== null ? offsetLon.toFixed(6) : '',
          cameraType: 'CCTV'
        });
      }
      setCameraRows(rows);
    }
  }, [isOpen, initialLat, initialLon, existingJunctionsCount, existingCamerasCount]);

  // When junction coordinates change, update camera approach offsets around the new center
  useEffect(() => {
    if (!isOpen) return;
    const baseLat = parseFloat(juncLat);
    const baseLon = parseFloat(juncLon);
    if (isNaN(baseLat) || isNaN(baseLon)) return;

    setCameraRows(prev =>
      prev.map((row, i) => {
        const defaultDir = row.direction || DEFAULT_APPROACHES[i % DEFAULT_APPROACHES.length];
        let offsetLat = baseLat;
        let offsetLon = baseLon;
        if (defaultDir === 'North') offsetLat += 0.00035;
        else if (defaultDir === 'South') offsetLat -= 0.00035;
        else if (defaultDir === 'East') offsetLon += 0.00035;
        else if (defaultDir === 'West') offsetLon -= 0.00035;

        return {
          ...row,
          lat: offsetLat.toFixed(6),
          lon: offsetLon.toFixed(6)
        };
      })
    );
  }, [juncLat, juncLon, isOpen]);

  if (!isOpen) return null;

  const handleUpdateCamRow = (index: number, field: keyof ConfigCamRow, value: string) => {
    setCameraRows(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!juncLat.trim() || !juncLon.trim()) {
      setError('Junction coordinates required. Enter Latitude & Longitude or click "PICK ON 3D MAP".');
      return;
    }

    const latNum = parseFloat(juncLat);
    const lonNum = parseFloat(juncLon);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Invalid Junction Latitude (-90 to 90)');
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError('Invalid Junction Longitude (-180 to 180)');
      return;
    }
    if (!juncName.trim()) {
      setError('Junction Name is required');
      return;
    }

    // Validate camera rows
    const payloadCameras: CreateCameraPayload[] = [];
    for (let i = 0; i < cameraRows.length; i++) {
      const row = cameraRows[i];
      const cLat = parseFloat(row.lat);
      const cLon = parseFloat(row.lon);

      if (isNaN(cLat) || isNaN(cLon)) {
        setError(`Please provide valid coordinates for ${row.id} (${row.direction} approach).`);
        return;
      }

      payloadCameras.push({
        id: row.id.trim().toUpperCase(),
        name: row.name.trim(),
        type: 'junction_camera',
        latitude: cLat,
        longitude: cLon,
        direction: row.direction,
        camera_type: row.cameraType,
        video_source: row.videoSource,
        status: 'ONLINE'
      });
    }

    setLoading(true);
    try {
      const nextJuncNum = existingJunctionsCount + 1;
      const jId = `JUNC-${String(nextJuncNum).padStart(2, '0')}`;

      const res = await godViewService.addJunction({
        id: jId,
        name: juncName.trim(),
        type: 'signal',
        latitude: latNum,
        longitude: lonNum,
        location: location.trim(),
        signal_type: signalType,
        description: description.trim(),
        cameras: payloadCameras
      });

      if (res.data?.junction) {
        onJunctionAdded(res.data.junction);
        onClose();
      } else {
        setError(res.error || 'Failed to create junction');
      }
    } catch (err: any) {
      setError(err.message || 'Server error while creating junction');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center text-xl shadow-inner">
              🚦
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white tracking-wide">
                  DEPLOY SIGNAL / JUNCTION
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-semibold">
                  PRIMARY OBJECT
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Primary Signal Hub + Synchronized Approach CCTV Cameras
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="bg-rose-950/80 border border-rose-500/40 rounded-xl p-3.5 flex items-start gap-2.5 text-rose-200 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Section 1: Signal / Junction Details */}
          <div className="space-y-3 bg-white/[0.02] p-4 rounded-xl border border-white/[0.06]">
            <div className="text-xs font-mono font-bold text-purple-300 uppercase tracking-wider flex items-center gap-1.5">
              <span>1. SIGNAL JUNCTION SPECIFICATION</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Junction Name *
                </label>
                <input
                  type="text"
                  value={juncName}
                  onChange={(e) => setJuncName(e.target.value)}
                  placeholder="e.g. Trichy Central Junction"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Location / City *
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Trichy, Tamil Nadu"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Description / Notes
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. 4-Way Arterial Corridor with Adaptive Signal Control"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
              />
            </div>

            {/* Junction GPS Coordinates */}
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-purple-400" />
                  <span>Junction Center GPS (Unaltered Source of Truth) *</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onPickOnMap('junction');
                  }}
                  className="text-[11px] font-mono text-purple-400 hover:text-purple-300 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Crosshair className="w-3 h-3" />
                  <span>PICK ON 3D MAP</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  value={juncLat}
                  onChange={(e) => setJuncLat(e.target.value)}
                  placeholder="Latitude (e.g. 10.790500)"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-purple-400"
                  required
                />
                <input
                  type="text"
                  value={juncLon}
                  onChange={(e) => setJuncLon(e.target.value)}
                  placeholder="Longitude (e.g. 78.704700)"
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-purple-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Signal Controller Type
                </label>
                <select
                  value={signalType}
                  onChange={(e) => setSignalType(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                >
                  <option value="Adaptive">Adaptive Dynamic (YOLOv8 + ByteTrack)</option>
                  <option value="Fixed">Fixed Time Cycle</option>
                  <option value="EVP_Actuated">Emergency Vehicle Preemption Actuated</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                  Number of Associated Cameras
                </label>
                <select
                  value={numCameras}
                  onChange={(e) => setNumCameras(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-purple-400"
                >
                  <option value={1}>1 Camera (Single Leg)</option>
                  <option value={2}>2 Cameras (Bi-directional Corridor)</option>
                  <option value={3}>3 Cameras (3-Way T-Junction)</option>
                  <option value={4}>4 Cameras (Standard 4-Way Intersection)</option>
                  <option value={6}>6 Cameras (6-Way Complex)</option>
                  <option value={8}>8 Cameras (Full Dual-Approach Ring)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Associated Cameras Configuration */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-1.5">
                <Video className="w-4 h-4 text-cyan-400" />
                <span>2. CONFIGURE {cameraRows.length} APPROACH CAMERAS</span>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                Each camera has distinct physical GPS coordinates
              </span>
            </div>

            <div className="space-y-3">
              {cameraRows.map((cam, idx) => (
                <div
                  key={idx}
                  className="bg-slate-900/80 rounded-xl p-3.5 border border-white/[0.08] space-y-2.5"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs text-white bg-cyan-950/70 border border-cyan-800 px-2 py-0.5 rounded">
                        {cam.id}
                      </span>
                      <span className="text-xs font-mono text-slate-300">
                        {cam.direction.toUpperCase()} APPROACH
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 border border-purple-800/40 px-2 py-0.5 rounded">
                      Linked to Junction
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-0.5">
                        Direction
                      </label>
                      <select
                        value={cam.direction}
                        onChange={(e) => handleUpdateCamRow(idx, 'direction', e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      >
                        {DEFAULT_APPROACHES.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono text-slate-400 uppercase mb-0.5">
                        Video Footage Source
                      </label>
                      <select
                        value={cam.videoSource}
                        onChange={(e) => handleUpdateCamRow(idx, 'videoSource', e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                      >
                        {FOOTAGE_OPTIONS.map(opt => (
                          <option key={opt.id} value={opt.id}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Camera Physical Coordinates */}
                  <div>
                    <label className="block text-[10px] font-mono text-slate-400 uppercase mb-1">
                      Camera Physical GPS (Latitude, Longitude)
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={cam.lat}
                        onChange={(e) => handleUpdateCamRow(idx, 'lat', e.target.value)}
                        placeholder="Latitude"
                        className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                        required
                      />
                      <input
                        type="text"
                        value={cam.lon}
                        onChange={(e) => handleUpdateCamRow(idx, 'lon', e.target.value)}
                        placeholder="Longitude"
                        className="bg-black/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-mono text-slate-300 hover:text-white hover:bg-white/10 transition cursor-pointer"
            >
              CANCEL
            </button>

            <button
              type="submit"
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>CREATING JUNCTION & CAMERAS...</span>
                </>
              ) : (
                <>
                  <span>DEPLOY SIGNAL JUNCTION (🚦 + {cameraRows.length} CAMS)</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
