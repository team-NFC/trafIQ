import React, { useState, useEffect, useRef } from 'react';
import { godViewService, CameraItem, JunctionItem } from '../api/godview';
import { signalService } from '../api/signals';
import { SignalState } from '../types/signal';
import { apiClient } from '../api/client';
import { CameraCard } from '../components/traffic/CameraCard';
import { SingleCameraFocusView } from '../components/traffic/SingleCameraFocusView';
import { JunctionGroupHeader } from '../components/traffic/JunctionGroupHeader';
import {
  Grid,
  Layers,
  Video,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Search
} from 'lucide-react';

type GridLayoutType = '1x1' | '2x2' | '3x3' | '4x4' | 'ALL';
type GroupFilterType = 'ALL' | 'NORMAL' | 'AMBULANCE' | 'ANPR';

export const TrafficDashboard: React.FC = () => {
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [junctions, setJunctions] = useState<JunctionItem[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<CameraItem | null>(null);
  const [groupFilter, setGroupFilter] = useState<GroupFilterType>('ALL');
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);
  const [selectedCamFilterId, setSelectedCamFilterId] = useState<string | null>(null);
  const [gridLayout, setGridLayout] = useState<GridLayoutType>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [signalState, setSignalState] = useState<SignalState | null>(null);
  const [ambulanceActive, setAmbulanceActive] = useState<boolean>(false);
  const [ambulanceCamera, setAmbulanceCamera] = useState<string>('CAM-03');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sliderRef = useRef<HTMLDivElement>(null);

  // Load cameras and junctions from SQLite backend
  const loadData = async () => {
    setLoading(true);
    try {
      const [cRes, jRes] = await Promise.all([
        godViewService.getCameras(),
        godViewService.getJunctions(),
      ]);

      if (cRes.data && cRes.data.cameras) {
        setCameras(cRes.data.cameras);
        // If a camera is currently selected in focus view, update its data reference
        if (selectedCamera) {
          const updated = cRes.data.cameras.find((c) => c.id === selectedCamera.id);
          if (updated) setSelectedCamera(updated);
        }
      }

      if (jRes.data && jRes.data.junctions) {
        setJunctions(jRes.data.junctions);
      }
    } catch (err) {
      console.error('Error fetching cameras or junctions:', err);
    } finally {
      setLoading(false);
    }
  };

  // Poll live signals and ambulance telemetry from backend controllers
  const fetchTelemetry = async () => {
    try {
      const [sRes, aRes, cRes] = await Promise.all([
        signalService.getSignalState(),
        apiClient.get<Record<string, any>>('/api/ambulance'),
        godViewService.getCameras(),
      ]);

      if (sRes.data) {
        setSignalState(sRes.data);
      }

      if (aRes.data) {
        const isAmb = Boolean(aRes.data.is_emergency_active || aRes.data.ambulance_detected);
        setAmbulanceActive(isAmb);
        if (aRes.data.camera) {
          const raw = String(aRes.data.camera).toUpperCase().replace('_', '-');
          setAmbulanceCamera(raw.startsWith('CAM-') ? raw : `CAM-${raw}`);
        }
      }

      if (cRes.data && cRes.data.cameras) {
        setCameras(cRes.data.cameras);
        if (selectedCamera) {
          const updated = cRes.data.cameras.find((c) => c.id === selectedCamera.id);
          if (updated) setSelectedCamera(updated);
        }
      }
    } catch (err) {
      console.error('Telemetry fetch failed:', err);
    }
  };

  useEffect(() => {
    loadData();
    fetchTelemetry();

    // Poll live telemetry every 2 seconds
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, []);

  // Horizontal scroll buttons for pills track
  const scrollSelector = (offset: number) => {
    if (sliderRef.current) {
      sliderRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  // Helper to determine canonical group for a camera
  const getCameraGroup = (c: CameraItem): string => {
    if (c.group) return c.group.toUpperCase();
    const id = c.id.toUpperCase();
    if (['CAM-01', 'CAM-02', 'CAM-03', 'CAM-04'].includes(id)) return 'NORMAL';
    if (['CAM-05', 'CAM-06', 'CAM-07', 'CAM-08'].includes(id)) return 'AMBULANCE';
    if (['CAM-09', 'CAM-10', 'CAM-11', 'CAM-12', 'CAM-13', 'CAM-14', 'CAM-15', 'CAM-16'].includes(id)) return 'ANPR';
    if (c.is_ambulance) return 'AMBULANCE';
    if (c.camera_type === 'ANPR') return 'ANPR';
    return 'NORMAL';
  };

  // Dynamic counts derived strictly from registered master camera list
  const totalCount = cameras.length;
  const normalCount = cameras.filter((c) => getCameraGroup(c) === 'NORMAL').length;
  const ambulanceCount = cameras.filter((c) => getCameraGroup(c) === 'AMBULANCE').length;
  const anprCount = cameras.filter((c) => getCameraGroup(c) === 'ANPR').length;

  // Filter cameras dynamically across the master registry
  const filteredCameras = cameras.filter((cam) => {
    // 1. Group filter (ALL / NORMAL / AMBULANCE / ANPR)
    if (groupFilter !== 'ALL') {
      const g = getCameraGroup(cam);
      if (g !== groupFilter) return false;
    }

    // 2. If an individual camera pill is selected in the bar
    if (selectedCamFilterId && cam.id !== selectedCamFilterId) {
      return false;
    }

    // 3. If a junction group is filtered
    if (selectedJunctionId && selectedJunctionId !== 'ALL') {
      const junction = junctions.find((j) => j.id === selectedJunctionId);
      if (junction && !junction.connected_camera_ids?.includes(cam.id) && cam.junction_id !== selectedJunctionId) {
        return false;
      }
    }

    // 4. Search query filter (matches ID, name, direction, plate, or group)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchId = cam.id.toLowerCase().includes(q);
      const matchName = cam.name.toLowerCase().includes(q);
      const matchDir = (cam.direction || '').toLowerCase().includes(q);
      const matchPlate = (cam.plate || '').toLowerCase().includes(q);
      const matchGrp = getCameraGroup(cam).toLowerCase().includes(q);
      if (!matchId && !matchName && !matchDir && !matchPlate && !matchGrp) {
        return false;
      }
    }

    return true;
  });

  // Layout page sizing
  const getPageSize = () => {
    switch (gridLayout) {
      case '1x1':
        return 1;
      case '2x2':
        return 4;
      case '3x3':
        return 9;
      case '4x4':
        return 16;
      case 'ALL':
      default:
        return Math.max(1, filteredCameras.length);
    }
  };

  const pageSize = getPageSize();
  const totalPages = Math.max(1, Math.ceil(filteredCameras.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages - 1);
  const pagedCameras: CameraItem[] = gridLayout === 'ALL'
    ? filteredCameras
    : filteredCameras.slice(safeCurrentPage * pageSize, safeCurrentPage * pageSize + pageSize);

  // Helper to find junction name for a given camera
  const getJunctionName = (cam: CameraItem): string | undefined => {
    if (!cam.junction_id) return undefined;
    const j = junctions.find((item) => item.id === cam.junction_id || item.connected_camera_ids?.includes(cam.id));
    return j?.name;
  };

  // Active selected junction object
  const activeJunction = selectedJunctionId ? junctions.find((j) => j.id === selectedJunctionId) : null;
  const junctionAssociatedCameras = activeJunction
    ? cameras.filter((c) => activeJunction.connected_camera_ids?.includes(c.id) || c.junction_id === activeJunction.id)
    : [];

  // Reset pagination on filter or layout change
  const handleLayoutChange = (layout: GridLayoutType) => {
    setGridLayout(layout);
    setCurrentPage(0);
  };

  const handleSelectGroup = (grp: GroupFilterType) => {
    setGroupFilter(grp);
    setSelectedJunctionId(null);
    setSelectedCamFilterId(null);
    setCurrentPage(0);
  };

  const handleSelectJunction = (junctionId: string | null) => {
    setSelectedJunctionId(junctionId);
    setSelectedCamFilterId(null);
    setGroupFilter('ALL');
    setCurrentPage(0);
  };

  const handleSelectCameraPill = (camId: string) => {
    if (selectedCamFilterId === camId) {
      setSelectedCamFilterId(null);
    } else {
      setSelectedCamFilterId(camId);
      setSelectedJunctionId(null);
      setGroupFilter('ALL');
    }
    setCurrentPage(0);
  };

  // Grid column CSS class
  const getGridClass = () => {
    switch (gridLayout) {
      case '1x1':
        return 'grid-cols-1 max-w-4xl mx-auto';
      case '2x2':
        return 'grid-cols-1 md:grid-cols-2';
      case '3x3':
        return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case '4x4':
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
      case 'ALL':
      default:
        return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4';
    }
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* If Single Camera Focus View is open, render it exclusively */}
      {selectedCamera ? (
        <SingleCameraFocusView
          camera={selectedCamera}
          allCameras={cameras}
          junctionName={getJunctionName(selectedCamera)}
          onBack={() => setSelectedCamera(null)}
          onSelectCamera={(cam) => setSelectedCamera(cam)}
        />
      ) : (
        <>
          {/* Top Title & Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/[0.06] text-white flex items-center justify-center border border-white/[0.1]">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white tracking-wide flex items-center gap-2">
                    <span>CAMERA MANAGEMENT & SURVEILLANCE</span>
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  </h1>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    Live CCTV Feeds & Multi-Approach Traffic Intelligence ({totalCount} Registered Cameras)
                  </p>
                </div>
              </div>
            </div>

            {/* Layout Switcher, Dynamic Count & Search Controls */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Dynamic Camera Count Badge */}
              <div className="px-3 py-1.5 rounded-lg bg-black/60 border border-white/[0.12] text-xs font-mono font-bold text-white shadow-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>
                  {filteredCameras.length === totalCount
                    ? `${totalCount} CAMERAS`
                    : `${filteredCameras.length} / ${totalCount} CAMERAS`}
                </span>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filter camera or plate..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(0);
                  }}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-white/30 w-44 sm:w-56 transition"
                />
              </div>

              {/* Grid Layout Switcher */}
              <div className="flex items-center p-1 rounded-lg bg-black/40 border border-white/[0.08]">
                {(['1x1', '2x2', '3x3', '4x4', 'ALL'] as GridLayoutType[]).map((layout) => (
                  <button
                    key={layout}
                    onClick={() => handleLayoutChange(layout)}
                    className={`px-2.5 py-1 rounded text-xs font-mono font-semibold transition cursor-pointer ${
                      gridLayout === layout
                        ? 'bg-white/[0.14] text-white shadow-sm'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {layout}
                  </button>
                ))}
              </div>

              {/* Refresh Button */}
              <button
                onClick={loadData}
                className="p-2 text-neutral-400 hover:text-white rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] transition cursor-pointer"
                title="Refresh Camera Nodes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* PRIMARY GROUP FILTERS: ALL, NORMAL, AMBULANCE, ANPR */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-black/40 border border-white/[0.08] p-2.5 rounded-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mr-1 font-semibold">
                Camera Groups:
              </span>

              {/* ALL */}
              <button
                onClick={() => handleSelectGroup('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  groupFilter === 'ALL' && !selectedJunctionId && !selectedCamFilterId
                    ? 'bg-white text-black border-white shadow-md'
                    : 'bg-white/[0.03] text-neutral-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                <span>ALL</span>
                <span
                  className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-bold ${
                    groupFilter === 'ALL' && !selectedJunctionId && !selectedCamFilterId
                      ? 'bg-black/20 text-black'
                      : 'bg-white/[0.08] text-neutral-300'
                  }`}
                >
                  {totalCount}
                </span>
              </button>

              {/* NORMAL */}
              <button
                onClick={() => handleSelectGroup('NORMAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  groupFilter === 'NORMAL' && !selectedJunctionId && !selectedCamFilterId
                    ? 'bg-cyan-500 text-black border-cyan-400 shadow-md'
                    : 'bg-white/[0.03] text-cyan-300 border-white/[0.08] hover:bg-cyan-500/10 hover:text-cyan-200'
                }`}
              >
                <span>NORMAL</span>
                <span
                  className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-bold ${
                    groupFilter === 'NORMAL' && !selectedJunctionId && !selectedCamFilterId
                      ? 'bg-black/20 text-black'
                      : 'bg-cyan-950/80 text-cyan-300 border border-cyan-800/40'
                  }`}
                >
                  {normalCount}
                </span>
              </button>

              {/* AMBULANCE */}
              <button
                onClick={() => handleSelectGroup('AMBULANCE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  groupFilter === 'AMBULANCE' && !selectedJunctionId && !selectedCamFilterId
                    ? 'bg-rose-500 text-white border-rose-400 shadow-md'
                    : 'bg-white/[0.03] text-rose-300 border-white/[0.08] hover:bg-rose-500/10 hover:text-rose-200'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                <span>AMBULANCE</span>
                <span
                  className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-bold ${
                    groupFilter === 'AMBULANCE' && !selectedJunctionId && !selectedCamFilterId
                      ? 'bg-black/20 text-white'
                      : 'bg-rose-950/80 text-rose-300 border border-rose-800/40'
                  }`}
                >
                  {ambulanceCount}
                </span>
              </button>

              {/* ANPR */}
              <button
                onClick={() => handleSelectGroup('ANPR')}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition cursor-pointer flex items-center gap-1.5 border ${
                  groupFilter === 'ANPR' && !selectedJunctionId && !selectedCamFilterId
                    ? 'bg-purple-500 text-white border-purple-400 shadow-md'
                    : 'bg-white/[0.03] text-purple-300 border-white/[0.08] hover:bg-purple-500/10 hover:text-purple-200'
                }`}
              >
                <span>ANPR</span>
                <span
                  className={`text-[10px] font-sans px-1.5 py-0.2 rounded font-bold ${
                    groupFilter === 'ANPR' && !selectedJunctionId && !selectedCamFilterId
                      ? 'bg-black/20 text-white'
                      : 'bg-purple-950/80 text-purple-300 border border-purple-800/40'
                  }`}
                >
                  {anprCount}
                </span>
              </button>
            </div>

            {/* Active filter summary tag & reset button */}
            <div className="flex items-center gap-2 text-xs font-mono text-neutral-400">
              <span>Filter:</span>
              <span className="px-2 py-0.5 rounded bg-white/[0.08] text-white border border-white/[0.1] font-bold">
                {selectedCamFilterId ? selectedCamFilterId : selectedJunctionId ? selectedJunctionId : groupFilter}
              </span>
              {(groupFilter !== 'ALL' || selectedJunctionId || selectedCamFilterId || searchQuery) && (
                <button
                  onClick={() => {
                    setGroupFilter('ALL');
                    setSelectedJunctionId(null);
                    setSelectedCamFilterId(null);
                    setSearchQuery('');
                    setCurrentPage(0);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 underline text-xs cursor-pointer ml-1 font-semibold"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>

          {/* DYNAMIC SCROLLABLE CAMERA & JUNCTION SELECTOR TRACK */}
          <div className="relative flex items-center bg-black/40 border border-white/[0.08] rounded-xl p-1.5 backdrop-blur-md">
            {/* Scroll Left Button */}
            <button
              onClick={() => scrollSelector(-240)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition shrink-0 z-10 cursor-pointer"
              title="Scroll Left"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            {/* Scrollable Track */}
            <div
              ref={sliderRef}
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth px-1 py-0.5 flex-1 text-xs"
            >
              {/* JUNCTION GROUP PILLS */}
              {junctions.map((j) => {
                const isSelected = selectedJunctionId === j.id;
                const jCams = cameras.filter((c) => j.connected_camera_ids?.includes(c.id) || c.junction_id === j.id);
                const hasEmergency = jCams.some((c) => Boolean(c.is_ambulance));

                // Short readable name
                const shortName = j.name.replace(/ \(.*?\)/, '').toUpperCase();

                return (
                  <button
                    key={j.id}
                    onClick={() => handleSelectJunction(isSelected ? null : j.id)}
                    className={`px-3 py-1.5 rounded-lg font-mono font-semibold shrink-0 transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-sm'
                        : hasEmergency
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-white/[0.04] text-neutral-300 border-white/[0.08] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{shortName}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-black/60' : 'text-neutral-400'}`}>
                      ({jCams.length})
                    </span>
                  </button>
                );
              })}

              <div className="h-5 w-px bg-white/[0.1] mx-1 shrink-0" />

              {/* INDIVIDUAL CAMERA PILLS DYNAMICALLY LISTED */}
              {cameras.map((cam) => {
                const isSelected = selectedCamFilterId === cam.id;
                const isEmergency = Boolean(cam.is_ambulance);

                return (
                  <button
                    key={cam.id}
                    onClick={() => handleSelectCameraPill(cam.id)}
                    className={`px-2.5 py-1.5 rounded-lg font-mono font-semibold shrink-0 transition cursor-pointer flex items-center gap-1.5 border ${
                      isSelected
                        ? 'bg-white text-black border-white shadow-sm'
                        : isEmergency
                        ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                        : 'bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {isEmergency && <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />}
                    <span>{cam.id}</span>
                  </button>
                );
              })}
            </div>

            {/* Scroll Right Button */}
            <button
              onClick={() => scrollSelector(240)}
              className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.08] transition shrink-0 z-10 cursor-pointer"
              title="Scroll Right"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ACTIVE JUNCTION GROUP HEADER (when a junction is selected) */}
          {activeJunction && (
            <JunctionGroupHeader
              junction={activeJunction}
              associatedCameras={junctionAssociatedCameras}
              signalState={signalState}
              ambulanceActive={ambulanceActive}
              ambulanceCamera={ambulanceCamera}
              onSelectCamera={(cam) => setSelectedCamera(cam)}
              onClearJunctionFilter={() => setSelectedJunctionId(null)}
            />
          )}

          {/* CCTV VIDEO FEEDS GRID (ALL CAMERAS LOADED DYNAMICALLY) */}
          {pagedCameras.length === 0 ? (
            <div className="py-16 rounded-xl border border-white/[0.08] bg-black/30 flex flex-col items-center justify-center text-center p-6 space-y-2">
              <Video className="w-10 h-10 text-neutral-600 mb-1" />
              <h3 className="text-sm font-bold text-neutral-300">No Cameras Match Current Filter</h3>
              <p className="text-xs text-neutral-500 max-w-sm">
                Try selecting "ALL" cameras or clearing search filters to display active system cameras.
              </p>
              <button
                onClick={() => {
                  setGroupFilter('ALL');
                  setSelectedJunctionId(null);
                  setSelectedCamFilterId(null);
                  setSearchQuery('');
                  setCurrentPage(0);
                }}
                className="mt-2 px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-white border border-white/[0.1] transition cursor-pointer"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className={`grid gap-4.5 ${getGridClass()}`}>
              {pagedCameras.map((cam: CameraItem) => (
                <CameraCard
                  key={cam.id}
                  camera={cam}
                  junctionName={getJunctionName(cam)}
                  onSelect={(c) => setSelectedCamera(c)}
                  isFocused={false}
                />
              ))}
            </div>
          )}

          {/* PAGINATION / FOOTER CONTROLS (active when using 1x1, 2x2, 3x3, 4x4) */}
          {gridLayout !== 'ALL' && filteredCameras.length > pageSize && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-white/[0.08] text-xs text-neutral-400">
              <div className="font-mono">
                Showing{' '}
                <strong className="text-white font-bold">
                  {safeCurrentPage * pageSize + 1}–{Math.min((safeCurrentPage + 1) * pageSize, filteredCameras.length)}
                </strong>{' '}
                of <strong className="text-white font-bold">{filteredCameras.length}</strong> cameras
              </div>

              {/* Prev / Next & Page Selector */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage((prev) => Math.max(0, prev - 1))}
                  disabled={safeCurrentPage === 0}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border border-white/[0.08] transition cursor-pointer flex items-center gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentPage(idx)}
                      className={`w-7 h-7 rounded-lg font-mono text-xs font-bold transition cursor-pointer ${
                        safeCurrentPage === idx
                          ? 'bg-white text-black shadow-sm'
                          : 'bg-white/[0.04] text-neutral-400 hover:text-white hover:bg-white/[0.08]'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))}
                  disabled={safeCurrentPage >= totalPages - 1}
                  className="px-3 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-neutral-200 disabled:opacity-30 disabled:cursor-not-allowed border border-white/[0.08] transition cursor-pointer flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
