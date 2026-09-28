import React, { useState, useEffect } from 'react';
import { CameraItem, godViewService } from '../../api/godview';
import {
  X,
  MapPin,
  Compass,
  Video,
  Crosshair,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AddCameraModalProps {
  isOpen: boolean;
  initialLat?: number | null;
  initialLon?: number | null;
  initialLocationName?: string;
  existingCamerasCount?: number;
  existingCameraIds?: string[];
  onClose: () => void;
  onCameraAdded: (camera: CameraItem) => void;
  onPickOnMap: () => void;
}

const CAMERA_PRESETS = [
  // Normal situation cam 1,2,3,4
  { id: 'CAM-01', name: 'CAM-01 (Normal Situation Camera 1)', dir: 'North', type: 'CCTV', lat: 10.791500, lon: 78.704700, desc: 'Normal traffic flow - North Approach', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-02', name: 'CAM-02 (Normal Situation Camera 2)', dir: 'East', type: 'CCTV', lat: 10.790500, lon: 78.705700, desc: 'Normal traffic flow - East Approach', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-03', name: 'CAM-03 (Normal Situation Camera 3)', dir: 'South', type: 'CCTV', lat: 10.789500, lon: 78.704700, desc: 'Normal traffic flow - South Approach', group: 'Normal Traffic (CAM 01–04)' },
  { id: 'CAM-04', name: 'CAM-04 (Normal Situation Camera 4)', dir: 'West', type: 'CCTV', lat: 10.790500, lon: 78.703700, desc: 'Normal traffic flow - West Approach', group: 'Normal Traffic (CAM 01–04)' },
  // Ambulance situation cam 1,2,3,4
  { id: 'CAM-05', name: 'CAM-05 (Ambulance Situation Camera 1)', dir: 'North', type: 'CCTV', lat: 10.782000, lon: 78.692000, desc: 'Ambulance priority monitoring 1', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-06', name: 'CAM-06 (Ambulance Situation Camera 2)', dir: 'East', type: 'CCTV', lat: 10.783000, lon: 78.693000, desc: 'Ambulance priority monitoring 2', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-07', name: 'CAM-07 (Ambulance Situation Camera 3)', dir: 'South', type: 'CCTV', lat: 10.781000, lon: 78.691000, desc: 'Ambulance priority monitoring 3', group: 'Ambulance & EVP (CAM 05–08)' },
  { id: 'CAM-08', name: 'CAM-08 (Ambulance Situation Camera 4)', dir: 'West', type: 'CCTV', lat: 10.780000, lon: 78.690000, desc: 'Ambulance priority monitoring 4', group: 'Ambulance & EVP (CAM 05–08)' },
  // ANPR cam 1,2,3,4,5,6,7,8
  { id: 'CAM-09', name: 'CAM-09 (ANPR Camera 1)', dir: 'North', type: 'ANPR', lat: 10.795000, lon: 78.685000, desc: 'ANPR plate detection & tracking 1', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-10', name: 'CAM-10 (ANPR Camera 2)', dir: 'East', type: 'ANPR', lat: 10.796000, lon: 78.686000, desc: 'ANPR plate detection & tracking 2', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-11', name: 'CAM-11 (ANPR Camera 3)', dir: 'South', type: 'ANPR', lat: 10.794000, lon: 78.684000, desc: 'ANPR plate detection & tracking 3', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-12', name: 'CAM-12 (ANPR Camera 4)', dir: 'West', type: 'ANPR', lat: 10.793000, lon: 78.683000, desc: 'ANPR plate detection & tracking 4', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-13', name: 'CAM-13 (ANPR Camera 5)', dir: 'North', type: 'ANPR', lat: 10.788000, lon: 78.698000, desc: 'ANPR plate detection & tracking 5', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-14', name: 'CAM-14 (ANPR Camera 6)', dir: 'East', type: 'ANPR', lat: 10.789000, lon: 78.699000, desc: 'ANPR plate detection & tracking 6', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-15', name: 'CAM-15 (ANPR Camera 7)', dir: 'South', type: 'ANPR', lat: 10.787000, lon: 78.697000, desc: 'ANPR plate detection & tracking 7', group: 'ANPR Tracking (CAM 09–16)' },
  { id: 'CAM-16', name: 'CAM-16 (ANPR Camera 8)', dir: 'West', type: 'ANPR', lat: 10.786000, lon: 78.696000, desc: 'ANPR plate detection & tracking 8', group: 'ANPR Tracking (CAM 09–16)' },
];

export const AddCameraModal: React.FC<AddCameraModalProps> = ({
  isOpen,
  initialLat,
  initialLon,
  initialLocationName,
  existingCamerasCount = 0,
  existingCameraIds = [],
  onClose,
  onCameraAdded,
  onPickOnMap
}) => {
  // Helper to determine the next available camera ID (e.g. CAM-17)
  const getNextAvailableId = (): string => {
    const existing = new Set((existingCameraIds || []).map(id => id.toUpperCase()));
    let maxNum = 0;
    existing.forEach(id => {
      const match = id.match(/^CAM-(\d+)$/i);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > maxNum) maxNum = n;
      }
    });
    let nextNum = maxNum > 0 ? maxNum + 1 : (existingCamerasCount || 0) + 1;
    let nextId = `CAM-${String(nextNum).padStart(2, '0')}`;
    while (existing.has(nextId)) {
      nextNum++;
      nextId = `CAM-${String(nextNum).padStart(2, '0')}`;
    }
    return nextId;
  };

  const [selectedPreset, setSelectedPreset] = useState<string>('new');
  const [camId, setCamId] = useState<string>('CAM-17');
  const [name, setName] = useState<string>('Camera CAM-17');
  const [lat, setLat] = useState<string>('10.801500');
  const [lon, setLon] = useState<string>('78.690000');
  const [location, setLocation] = useState<string>('Trichy City Corridor');
  const [direction, setDirection] = useState<string>('North');
  const [videoSource, setVideoSource] = useState<string>('CAM-01');
  const [cameraType, setCameraType] = useState<string>('CCTV');
  const [description, setDescription] = useState<string>('Standalone traffic monitoring camera');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize defaults when modal opens or coordinates change
  useEffect(() => {
    if (isOpen) {
      const nextId = getNextAvailableId();
      setSelectedPreset('new');
      setCamId(nextId);
      setName(`Camera ${nextId}`);
      setDescription('Standalone traffic monitoring camera');
      setDirection('North');
      setCameraType('CCTV');
      setVideoSource('CAM-01');

      if (initialLat !== undefined && initialLat !== null) {
        setLat(initialLat.toFixed(6));
      } else {
        setLat('10.801500');
      }
      if (initialLon !== undefined && initialLon !== null) {
        setLon(initialLon.toFixed(6));
      } else {
        setLon('78.690000');
      }
      if (initialLocationName && initialLocationName.trim()) {
        setLocation(initialLocationName.trim());
      } else {
        setLocation('Trichy Traffic Corridor');
      }
      setError(null);
    }
  }, [isOpen, initialLat, initialLon, initialLocationName]);

  const handlePresetChange = (presetId: string) => {
    setSelectedPreset(presetId);
    if (presetId === 'new') {
      const nextId = getNextAvailableId();
      setCamId(nextId);
      setName(`Camera ${nextId}`);
      setDescription('Standalone traffic monitoring camera');
      setCameraType('CCTV');
      setDirection('North');
      setVideoSource('CAM-01');
      return;
    }
    if (presetId === 'custom') {
      const nextId = getNextAvailableId();
      setCamId(nextId);
      setName(`Camera ${nextId}`);
      return;
    }
    const preset = CAMERA_PRESETS.find(p => p.id === presetId);
    if (preset) {
      setCamId(preset.id);
      setName(preset.name);
      setDirection(preset.dir);
      setCameraType(preset.type);
      setVideoSource(preset.id);
      setDescription(preset.desc);
      if (!initialLat && !initialLon) {
        setLat(preset.lat.toFixed(6));
        setLon(preset.lon.toFixed(6));
      }
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!lat.trim() || !lon.trim()) {
      setError('Coordinates required. Please enter latitude & longitude, or click "PICK ON 3D MAP".');
      return;
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    if (isNaN(latNum) || latNum < -90 || latNum > 90) {
      setError('Latitude must be a valid number between -90 and 90');
      return;
    }
    if (isNaN(lonNum) || lonNum < -180 || lonNum > 180) {
      setError('Longitude must be a valid number between -180 and 180');
      return;
    }
    if (!camId.trim()) {
      setError('Camera ID cannot be empty');
      return;
    }

    setLoading(true);
    try {
      const res = await godViewService.addCamera({
        id: camId.trim().toUpperCase(),
        name: name.trim() || `Camera ${camId.trim()}`,
        type: 'normal',
        latitude: latNum,
        longitude: lonNum,
        location: location.trim(),
        junction_id: undefined, // Normal camera has NO junction parent
        direction: direction || 'North',
        camera_type: cameraType || 'CCTV',
        video_source: videoSource || 'CAM-01',
        description: description.trim(),
        status: 'ONLINE'
      });

      if (res.data?.camera) {
        onCameraAdded(res.data.camera);
        onClose();
      } else {
        setError(res.error || 'Failed to save camera');
      }
    } catch (err: any) {
      setError(err.message || 'Server error while adding camera');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0f19] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 bg-white/[0.03] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center text-xl shadow-inner">
              📷
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-mono font-bold text-base text-white tracking-wide">
                  DEPLOY NORMAL CAMERA
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 font-semibold">
                  STANDALONE
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Single Camera • Independent Telemetry & ANPR
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-rose-950/80 border border-rose-500/40 rounded-xl p-3 flex items-start gap-2.5 text-rose-200 text-xs font-mono">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Preset Selector for CAM 01-16 */}
          <div>
            <label className="block text-[11px] font-mono text-cyan-400 uppercase mb-1 font-bold flex items-center justify-between">
              <span>SELECT CAMERA STREAM / PRESET (1–16)</span>
              <span className="text-[10px] text-slate-400 font-normal">AUTO-FILLS METRICS & ID</span>
            </label>
            <select
              value={selectedPreset}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="w-full bg-slate-900 border border-cyan-500/40 rounded-lg px-3 py-2 text-xs font-mono text-cyan-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="new">✨ + NEW STANDALONE CAMERA (Auto ID)</option>
              <optgroup label="Normal Traffic Approaches (CAM 01–04)">
                <option value="CAM-01">CAM-01 • Normal Situation Camera 1 (North Approach)</option>
                <option value="CAM-02">CAM-02 • Normal Situation Camera 2 (East Approach)</option>
                <option value="CAM-03">CAM-03 • Normal Situation Camera 3 (South Approach)</option>
                <option value="CAM-04">CAM-04 • Normal Situation Camera 4 (West Approach)</option>
              </optgroup>
              <optgroup label="Ambulance & Priority Corridors (CAM 05–08)">
                <option value="CAM-05">CAM-05 • Ambulance Situation Camera 1 (North Corridor)</option>
                <option value="CAM-06">CAM-06 • Ambulance Situation Camera 2 (East Corridor)</option>
                <option value="CAM-07">CAM-07 • Ambulance Situation Camera 3 (South Corridor)</option>
                <option value="CAM-08">CAM-08 • Ambulance Situation Camera 4 (West Corridor)</option>
              </optgroup>
              <optgroup label="ANPR & Tracking Nodes (CAM 09–16)">
                <option value="CAM-09">CAM-09 • ANPR Camera 1 (North)</option>
                <option value="CAM-10">CAM-10 • ANPR Camera 2 (East)</option>
                <option value="CAM-11">CAM-11 • ANPR Camera 3 (South)</option>
                <option value="CAM-12">CAM-12 • ANPR Camera 4 (West)</option>
                <option value="CAM-13">CAM-13 • ANPR Camera 5 (North)</option>
                <option value="CAM-14">CAM-14 • ANPR Camera 6 (East)</option>
                <option value="CAM-15">CAM-15 • ANPR Camera 7 (South)</option>
                <option value="CAM-16">CAM-16 • ANPR Camera 8 (West)</option>
              </optgroup>
              <optgroup label="Custom / Manual Entry">
                <option value="custom">Custom Camera ID...</option>
              </optgroup>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Camera ID *
              </label>
              <input
                type="text"
                value={camId}
                onChange={(e) => setCamId(e.target.value)}
                placeholder="CAM-01"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Camera Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Camera Name"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Location / Road Name
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="e.g. Kallur Bypass Road, Trichy"
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Exact Coordinates */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-mono text-slate-400 uppercase flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>Exact GPS Coordinates *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onPickOnMap();
                }}
                className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Crosshair className="w-3 h-3" />
                <span>PICK ON 3D MAP</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="Latitude (e.g. 10.790500)"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                required
              />
              <input
                type="text"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="Longitude (e.g. 78.704700)"
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
                <Compass className="w-3 h-3 text-cyan-400" />
                <span>Viewing Direction</span>
              </label>
              <select
                value={direction}
                onChange={(e) => setDirection(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="North">North (0°)</option>
                <option value="East">East (90°)</option>
                <option value="South">South (180°)</option>
                <option value="West">West (270°)</option>
                <option value="North-East">North-East (45°)</option>
                <option value="South-East">South-East (135°)</option>
                <option value="South-West">South-West (225°)</option>
                <option value="North-West">North-West (315°)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
                Camera Type
              </label>
              <select
                value={cameraType}
                onChange={(e) => setCameraType(e.target.value)}
                className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="CCTV">CCTV (Fixed Focal)</option>
                <option value="ANPR">ANPR (High-Res Plate Capture)</option>
                <option value="PTZ">PTZ Dome (Pan-Tilt-Zoom)</option>
                <option value="Speed Dome">Speed Enforcement Dome</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1 flex items-center gap-1">
              <Video className="w-3 h-3 text-cyan-400" />
              <span>Video Footage Source</span>
            </label>
            <select
              value={videoSource}
              onChange={(e) => setVideoSource(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            >
              {CAMERA_PRESETS.map(opt => (
                <option key={opt.id} value={opt.id}>{opt.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-mono text-slate-400 uppercase mb-1">
              Description / Notes
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Monitored arterial bypass camera"
              className="w-full bg-slate-900 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

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
              className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-bold px-5 py-2.5 rounded-xl shadow-lg transition-all cursor-pointer flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <span>DEPLOY NORMAL CAMERA (📷)</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
