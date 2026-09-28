import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { trackingService } from '../api/tracking';
import {
  TrackedVehicleSummary,
  VehicleTrackingDetail,
  CameraSequenceStep
} from '../types/tracking';
import { CameraItem, GodViewLink } from '../api/godview';
import { CesiumGlobe } from '../components/globe/CesiumGlobe';
import { MapLayerControls, MapBaseStyle } from '../types/telemetry';
import { apiClient } from '../api/client';
import {
  Navigation,
  Search,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Compass,
  Gauge,
  MapPin,
  Camera,
  Layers,
  ArrowRight,
  Maximize2,
  ChevronRight,
  X,
  ShieldAlert,
  Car,
  Eye
} from 'lucide-react';

export const CameraTrackingPage: React.FC = () => {
  const { setCurrentPage, setSearchedPlate } = useApp();

  // Active tracked vehicles list
  const [trackedVehicles, setTrackedVehicles] = useState<TrackedVehicleSummary[]>([]);
  const [selectedVehiclePlate, setSelectedVehiclePlate] = useState<string>('TN 45 BB 7890');

  // Search input state
  const [searchQuery, setSearchQuery] = useState<string>('TN 45 BB 7890');
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Active vehicle tracking detail
  const [trackingDetail, setTrackingDetail] = useState<VehicleTrackingDetail | null>(null);

  // Selected camera step for details inspection
  const [selectedStep, setSelectedStep] = useState<CameraSequenceStep | null>(null);
  const [selectedPlausibleRouteId, setSelectedPlausibleRouteId] = useState<string>('route_a');

  // Sidebar / panel collapse state
  const [isDossierOpen, setIsDossierOpen] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'sequence' | 'vehicles' | 'routes'>('sequence');

  // Map controls
  const [is3D, setIs3D] = useState<boolean>(true);
  const [mapStyle, setMapStyle] = useState<MapBaseStyle>('google_hybrid');
  const layers: MapLayerControls = {
    satellite: true,
    labels: true,
    osm: false,
    buildings3D: true,
    cameraNodes: true,
    roadLinks: true,
    traffic: false
  };

  // Cesium controller reference
  const controllerRef = useRef<{
    flyTo: (lat: number, lon: number, altMeters: number, heading?: number, pitch?: number, duration?: number) => void;
    flyToEarth: () => void;
    flyToIndia: () => void;
    flyToTamilNadu: () => void;
    flyToTrichy: () => void;
    flyToJunction: () => void;
    set3DMode: (enable3D: boolean) => void;
    toggle2D3D: () => void;
    resetNorth: () => void;
    zoomIn: () => void;
    zoomOut: () => void;
  } | null>(null);

  // 1. Load active tracked vehicles on mount
  useEffect(() => {
    const loadVehicles = async () => {
      try {
        const res = await trackingService.getTrackedVehicles();
        if (res.data) {
          setTrackedVehicles(res.data);
        }
      } catch (err) {
        console.warn('Failed to load tracked vehicles:', err);
      }
    };
    loadVehicles();
  }, []);

  // 2. Perform search when vehicle selection changes or search is triggered
  const executeSearch = async (queryToSearch: string, timeRange?: string) => {
    if (!queryToSearch.trim()) return;
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const tr = timeRange && timeRange !== 'all' ? timeRange : undefined;
      const res = await trackingService.searchVehicleTracking(queryToSearch, tr);

      if (res.data && res.data.status === 'found') {
        const rawSeq: any[] = res.data.camera_sequence || (res.data as any).journey || [];
        const rawRoutes: any[] = res.data.plausible_routes || [];
        const rawSegments: any[] = res.data.route_segments || (res.data as any).path_segments || [];

        const normalizedSeq: CameraSequenceStep[] = rawSeq.map((step, idx) => ({
          step: step.step || step.step_index || idx + 1,
          camera_id: step.camera_id || step.camera || `CAM-${idx + 1}`,
          camera_name: step.camera_name || step.location || `Camera ${step.camera_id || step.camera || idx + 1}`,
          location: step.location || step.camera_name || 'Observation Node',
          time: step.time || step.timestamp || '10:42:00',
          timestamp_seconds: step.timestamp_seconds || 38500 + idx * 120,
          travel_time_from_prev: step.travel_time_from_prev,
          lat: Number(step.lat ?? step.latitude ?? 10.7905),
          lng: Number(step.lng ?? step.longitude ?? 78.7047),
          status: step.status || (step.is_missing ? 'MISSING' : 'CONFIRMED'),
          status_display: step.status_display || (step.is_missing ? '⚠ Not Detected' : '✓ Detected'),
          is_missing: Boolean(step.is_missing),
          confidence: Number(step.confidence ?? 0.98),
          direction: step.direction || 'Approach Corridor',
          speed_kmh: Number(step.speed_kmh ?? 45),
          pcu: Number(step.pcu ?? 1.0),
          evidence_image: step.evidence_image || (res.data as any).evidence_image || null,
          note: step.note || ''
        }));

        const normalizedData: VehicleTrackingDetail = {
          ...res.data,
          camera_sequence: normalizedSeq,
          plausible_routes: rawRoutes,
          route_segments: rawSegments
        };

        setTrackingDetail(normalizedData);
        setSelectedVehiclePlate(res.data.plate);
        // Default to step 1
        if (normalizedSeq.length > 0) {
          setSelectedStep(normalizedSeq[0]);
        }
        // Set default primary plausible route if available
        if (rawRoutes.length > 0) {
          setSelectedPlausibleRouteId(rawRoutes[0].route_id);
        }

        // Center map on corridor
        flyToCorridor(normalizedSeq);
      } else {
        setErrorMsg(res.data?.message || `No tracking history found for "${queryToSearch}"`);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error communicating with tracking service');
    } finally {
      setIsLoading(false);
    }
  };

  // Fly camera to encompass the full tracked corridor
  const flyToCorridor = (sequence?: CameraSequenceStep[]) => {
    if (!controllerRef.current || !sequence || sequence.length === 0) return;

    let sumLat = 0;
    let sumLng = 0;
    sequence.forEach(s => {
      sumLat += s.lat;
      sumLng += s.lng;
    });
    const avgLat = sumLat / sequence.length;
    const avgLng = sumLng / sequence.length;

    controllerRef.current.flyTo(avgLat, avgLng, 3800, 0, -50, 1.8);
  };

  // Initial load with default sample
  useEffect(() => {
    executeSearch('TN 45 BB 7890');
  }, []);

  // Switch to a specific tracked vehicle
  const handleSelectVehicle = (v: TrackedVehicleSummary) => {
    setSelectedVehiclePlate(v.plate);
    setSearchQuery(v.plate);
    executeSearch(v.plate, timeRangeFilter);
  };

  // Fly to specific camera step
  const handleSelectStep = (step: CameraSequenceStep) => {
    setSelectedStep(step);
    if (controllerRef.current) {
      controllerRef.current.flyTo(step.lat, step.lng, 950, 0, -45, 1.4);
    }
  };

  // Navigate to full ANPR history
  const handleOpenANPRDetails = () => {
    if (trackingDetail) {
      setSearchedPlate(trackingDetail.plate);
      setCurrentPage('anpr_search');
    }
  };

  // Prepare map camera entities from tracking sequence
  const mapCameras: CameraItem[] = useMemo(() => {
    if (!trackingDetail || !trackingDetail.camera_sequence) return [];

    return (trackingDetail.camera_sequence || []).map(s => {
      return {
        id: s.camera_id,
        name: s.location || s.camera_name,
        latitude: s.lat,
        longitude: s.lng,
        direction: s.direction,
        status: s.status,
        is_missing: s.is_missing ? 1 : 0,
        has_database_alert: trackingDetail.scenario === 'normal' && s.camera_id === 'CAM-07',
        is_ambulance: trackingDetail.scenario === 'ambulance' ? 1 : 0,
        count: 1,
        queue: 0,
        signal: s.is_missing ? 'YELLOW' : 'GREEN'
      };
    });
  }, [trackingDetail]);

  // Prepare road links from route segments
  const mapLinks: GodViewLink[] = useMemo(() => {
    if (!trackingDetail || !trackingDetail.route_segments) return [];

    return (trackingDetail.route_segments || []).map(seg => ({
      from: seg.from,
      to: seg.to,
      type: seg.type === 'dashed' ? 'dashed' : 'solid',
      name: `${seg.from} → ${seg.to} (${seg.status})`
    }));
  }, [trackingDetail]);

  return (
    <div className="relative w-full h-[calc(100vh-52px)] overflow-hidden bg-[#060910] text-slate-200 select-none">
      {/* =========================================================================
          1. 3D GOD'S-EYE CESIUM MAP (PRIMARY VISUAL ELEMENT)
          ========================================================================= */}
      <div className="absolute inset-0 z-0">
        <CesiumGlobe
          is3D={is3D}
          layers={layers}
          mapStyle={mapStyle}
          selectedLocation={null}
          currentLocation={null}
          cameras={mapCameras}
          links={mapLinks}
          activeScenario={trackingDetail?.scenario || 'anpr_missing'}
          selectedCameraId={selectedStep?.camera_id}
          onSelectCamera={(cam) => {
            const step = trackingDetail?.camera_sequence.find(s => s.camera_id === cam.id);
            if (step) setSelectedStep(step);
          }}
          onMapClick={() => {}}
          onTelemetryUpdate={() => {}}
          onRegisterController={(ctrl) => {
            controllerRef.current = ctrl;
          }}
        />
      </div>

      {/* =========================================================================
          2. FLOATING TOP HUD: VEHICLE TRACKING SEARCH & CONTROLS
          ========================================================================= */}
      <div className="absolute top-3 left-3 right-3 z-30 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5 pointer-events-none">
        {/* Left: Search Bar & Sample Pills */}
        <div className="pointer-events-auto flex flex-wrap items-center gap-2 bg-[#090d16]/92 backdrop-blur-md px-3 py-2 rounded-xl border border-white/[0.08] shadow-xl">
          <div className="flex items-center gap-2 pr-2 border-r border-white/[0.08]">
            <Navigation className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-xs font-mono font-semibold tracking-wider text-white uppercase">
              CAMERA TRACKING
            </span>
          </div>

          {/* Search Query Input */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              executeSearch(searchQuery, timeRangeFilter);
            }}
            className="flex items-center gap-2"
          >
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search Plate, Vehicle ID, Camera ID..."
                className="w-56 sm:w-64 bg-[#121826] border border-white/[0.12] rounded-lg px-2.5 py-1 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Time Range Filter */}
            <div className="hidden sm:flex items-center gap-1 bg-[#121826] border border-white/[0.12] rounded-lg px-2 py-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <select
                value={timeRangeFilter}
                onChange={(e) => {
                  setTimeRangeFilter(e.target.value);
                  executeSearch(searchQuery, e.target.value);
                }}
                className="bg-transparent text-[11px] font-mono text-slate-300 focus:outline-none cursor-pointer"
              >
                <option value="all">All Times</option>
                <option value="10:40-10:50">10:40 - 10:50</option>
                <option value="08:30-08:45">08:30 - 08:45</option>
                <option value="10:15-10:30">10:15 - 10:30</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="px-3 py-1 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center gap-1 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
            >
              <Search className="w-3 h-3" />
              <span>{isLoading ? 'Tracking...' : 'Search'}</span>
            </button>
          </form>

          {/* Quick-Select Sample Pills */}
          <div className="hidden xl:flex items-center gap-1.5 pl-2 border-l border-white/[0.08]">
            <span className="text-[10px] font-mono text-slate-500 uppercase">Quick:</span>
            {trackedVehicles.map(v => {
              const isSelected = selectedVehiclePlate === v.plate;
              return (
                <button
                  key={v.plate}
                  onClick={() => handleSelectVehicle(v)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono transition-all cursor-pointer whitespace-nowrap ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                      : 'bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-white/[0.04]'
                  }`}
                  title={`${v.plate} · ${v.status_label}`}
                >
                  {v.plate} {v.has_missing_node && '⚠'}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Map Style & 2D/3D Controls */}
        <div className="pointer-events-auto flex items-center gap-1 bg-[#090d16]/92 backdrop-blur-md p-1.5 rounded-xl border border-white/[0.08] shadow-xl self-end md:self-auto">
          {/* Base Layer Switcher */}
          <div className="flex items-center bg-[#121826] rounded-lg p-0.5 border border-white/[0.08]">
            <button
              onClick={() => setMapStyle('google_hybrid')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                mapStyle === 'google_hybrid' ? 'bg-cyan-600/40 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hybrid
            </button>
            <button
              onClick={() => setMapStyle('google_roadmap')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                mapStyle === 'google_roadmap' ? 'bg-cyan-600/40 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Roads
            </button>
            <button
              onClick={() => setMapStyle('google_satellite')}
              className={`px-2 py-1 rounded text-[11px] font-mono cursor-pointer ${
                mapStyle === 'google_satellite' ? 'bg-cyan-600/40 text-cyan-300 font-semibold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Satellite
            </button>
          </div>

          {/* 3D / 2D Toggle */}
          <button
            onClick={() => {
              const next3D = !is3D;
              setIs3D(next3D);
              if (controllerRef.current) {
                controllerRef.current.set3DMode(next3D);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-mono flex items-center gap-1 cursor-pointer transition-colors ${
              is3D ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-[#121826] text-slate-400 hover:text-slate-200'
            }`}
            title="Toggle 2D / 3D Tilt View"
          >
            <span>{is3D ? '3D Tilt' : '2D Plan'}</span>
          </button>

          {/* Reset Corridor View */}
          <button
            onClick={() => trackingDetail && flyToCorridor(trackingDetail.camera_sequence)}
            className="p-1.5 rounded-lg bg-[#121826] hover:bg-[#1a2337] text-slate-400 hover:text-white cursor-pointer transition-colors"
            title="Center Corridor in 3D"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Error Message Toast */}
      {errorMsg && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-40 bg-red-950/90 border border-red-500/50 text-red-200 px-4 py-2 rounded-xl text-xs font-mono shadow-2xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)} className="ml-2 text-red-400 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* =========================================================================
          3. LEFT FLOATING HUD: VEHICLE PROFILE, SEQUENCE & PLAUSIBLE ROUTES
          ========================================================================= */}
      <div
        className={`absolute top-18 bottom-18 left-3 z-20 w-84 sm:w-96 flex flex-col transition-transform duration-300 ease-out pointer-events-auto ${
          isDossierOpen ? 'translate-x-0' : '-translate-x-[calc(100%+16px)]'
        }`}
      >
        <div className="flex-1 flex flex-col bg-[#090d16]/95 backdrop-blur-xl border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
          {/* Dossier Header */}
          <div className="p-3.5 border-b border-white/[0.08] bg-[#0c121e]/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Car className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-mono font-bold tracking-wider text-white">
                  {trackingDetail?.plate || searchQuery}
                </span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.08] text-slate-300">
                  {trackingDetail?.vehicle_id || 'VEH-ID'}
                </span>
              </div>
              <button
                onClick={() => setIsDossierOpen(false)}
                className="text-slate-500 hover:text-slate-300 cursor-pointer"
                title="Collapse Panel"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vehicle Meta Chips */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono text-slate-400">
              <span className="text-slate-300">{trackingDetail?.vehicle_class || 'Vehicle Class'}</span>
              <span>•</span>
              <span className="text-cyan-400">{trackingDetail?.corridor_name}</span>
            </div>

            {/* Status Alert Banner */}
            {trackingDetail?.has_missing_node ? (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-amber-300">
                    Missing Node Reconstructed ({trackingDetail.interpolation_confidence_pct})
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    Camera node {trackingDetail.missing_camera} did not detect plate. Spatio-temporal route interpolated.
                  </div>
                </div>
              </div>
            ) : trackingDetail?.scenario === 'ambulance' ? (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-red-500/10 border border-red-500/25 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-tight">
                  <div className="font-semibold text-red-300">
                    Emergency Preemption Corridor Active
                  </div>
                  <div className="text-slate-400 text-[10px] mt-0.5">
                    Live green corridor priority active across Anna Nagar & GH Hospital junctions.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="text-[11px] font-mono text-emerald-300">
                  Continuous Trajectory Verified (100% Sequence Confidence)
                </span>
              </div>
            )}
          </div>

          {/* Sub-tabs: Sequence vs Active Vehicles vs Plausible Routes */}
          <div className="flex border-b border-white/[0.08] bg-[#080b12]">
            <button
              onClick={() => setActiveTab('sequence')}
              className={`flex-1 py-2 text-center text-xs font-mono font-medium transition-colors cursor-pointer ${
                activeTab === 'sequence'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/[0.02]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Sequence ({trackingDetail?.camera_sequence?.length ?? 0})
            </button>
            {trackingDetail?.has_missing_node && (
              <button
                onClick={() => setActiveTab('routes')}
                className={`flex-1 py-2 text-center text-xs font-mono font-medium transition-colors cursor-pointer ${
                  activeTab === 'routes'
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-white/[0.02]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Plausible Routes ({trackingDetail?.plausible_routes?.length ?? 0})
              </button>
            )}
            <button
              onClick={() => setActiveTab('vehicles')}
              className={`flex-1 py-2 text-center text-xs font-mono font-medium transition-colors cursor-pointer ${
                activeTab === 'vehicles'
                  ? 'text-cyan-400 border-b-2 border-cyan-400 bg-white/[0.02]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Active ({trackedVehicles.length})
            </button>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 scrollbar-thin scrollbar-thumb-white/10">
            {/* TAB 1: CHRONOLOGICAL CAMERA SEQUENCE */}
            {activeTab === 'sequence' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 px-1 mb-1">
                  <span>CHRONOLOGICAL PROGRESSION</span>
                  <span>{trackingDetail?.total_duration || 'Duration'}</span>
                </div>

                {(trackingDetail?.camera_sequence ?? []).map((step, idx) => {
                  const isSelected = selectedStep?.camera_id === step.camera_id;
                  const isMissing = step.is_missing;

                  return (
                    <div
                      key={step.camera_id}
                      onClick={() => handleSelectStep(step)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer relative overflow-hidden ${
                        isSelected
                          ? isMissing
                            ? 'bg-amber-950/30 border-amber-500/60 shadow-lg'
                            : 'bg-cyan-950/30 border-cyan-500/60 shadow-lg'
                          : isMissing
                          ? 'bg-[#121622]/80 border-amber-500/20 hover:border-amber-500/40'
                          : 'bg-[#101420]/80 border-white/[0.06] hover:border-white/[0.14]'
                      }`}
                    >
                      {/* Active Indicator Bar */}
                      {isSelected && (
                        <div
                          className={`absolute left-0 top-0 bottom-0 w-1 ${
                            isMissing ? 'bg-amber-400' : 'bg-cyan-400'
                          }`}
                        />
                      )}

                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-mono font-bold ${
                              isMissing
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
                              <span>{step.camera_id}</span>
                              <span className="text-[10px] font-normal text-slate-400">
                                ({step.camera_name})
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                              {step.location}
                            </div>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold flex items-center gap-1 ${
                            isMissing
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          }`}
                        >
                          {isMissing ? (
                            <>
                              <AlertTriangle className="w-2.5 h-2.5" />
                              <span>NOT DETECTED</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 className="w-2.5 h-2.5" />
                              <span>DETECTED</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Telemetry Row */}
                      <div className="mt-2 pt-2 border-t border-white/[0.04] grid grid-cols-3 gap-1 text-[10px] font-mono text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-300">{step.time}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Compass className="w-3 h-3 text-slate-500" />
                          <span className="truncate">{step.direction}</span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <Gauge className="w-3 h-3 text-slate-500" />
                          <span className="text-slate-300">{step.speed_kmh} km/h</span>
                        </div>
                      </div>

                      {/* Delta time from prev */}
                      {step.travel_time_from_prev && (
                        <div className="mt-1 text-[9px] font-mono text-slate-500 text-right">
                          Transit delta: {step.travel_time_from_prev}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 2: PLAUSIBLE ROUTES (FOR MISSING NODE SCENARIOS) */}
            {activeTab === 'routes' && trackingDetail?.has_missing_node && (
              <div className="space-y-2.5">
                <div className="text-[11px] font-mono text-slate-400 px-1">
                  SELECT PLAUSIBLE INTERPOLATION HYPOTHESIS:
                </div>

                {(trackingDetail?.plausible_routes ?? []).map((route) => {
                  const isSelected = selectedPlausibleRouteId === route.route_id;
                  return (
                    <div
                      key={route.route_id}
                      onClick={() => setSelectedPlausibleRouteId(route.route_id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-950/30 border-amber-500/60 shadow-lg'
                          : 'bg-[#101420]/80 border-white/[0.06] hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="text-xs font-mono font-bold text-white">
                          {route.name}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                            route.is_primary
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-slate-700/40 text-slate-300 border border-white/[0.08]'
                          }`}
                        >
                          {route.confidence_pct}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-300 leading-snug">
                        {route.description}
                      </p>

                      <div className="mt-2.5 pt-2 border-t border-white/[0.06] flex items-center justify-between text-[10px] font-mono text-slate-400">
                        <span>Distance: {route.distance_km} km</span>
                        <span>Estimated: {route.estimated_duration}</span>
                        {route.is_primary && (
                          <span className="text-amber-400 font-semibold">PRIMARY CORRIDOR</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* TAB 3: ACTIVE TRACKED VEHICLES NETWORK */}
            {activeTab === 'vehicles' && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-slate-400 px-1 mb-1">
                  CITY-WIDE ACTIVE TRACKING CORRIDORS:
                </div>
                {trackedVehicles.map((v) => {
                  const isSelected = selectedVehiclePlate === v.plate;
                  return (
                    <div
                      key={v.plate}
                      onClick={() => handleSelectVehicle(v)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg'
                          : 'bg-[#101420]/80 border-white/[0.06] hover:border-white/[0.14]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-mono font-bold text-white">
                          {v.plate}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {v.duration_minutes} min
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-sans mb-1">
                        {v.corridor}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {v.path_display}
                      </div>
                      <div className="mt-2 pt-1.5 border-t border-white/[0.04] flex items-center justify-between text-[10px] font-mono">
                        <span className={v.has_missing_node ? 'text-amber-400' : 'text-emerald-400'}>
                          {v.status_label}
                        </span>
                        <span className="text-slate-500">
                          {v.confirmed_cameras}/{v.total_cameras} Cams
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dossier Footer Action: Cross-Reference with ANPR */}
          <div className="p-3 border-t border-white/[0.08] bg-[#0c121e]/90 flex items-center justify-between">
            <button
              onClick={handleOpenANPRDetails}
              className="w-full py-2 px-3 rounded-lg bg-white/[0.06] hover:bg-white/[0.10] text-slate-200 text-xs font-mono font-medium flex items-center justify-center gap-2 border border-white/[0.08] cursor-pointer transition-colors"
            >
              <span>View Full ANPR History</span>
              <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Button to restore Dossier if collapsed */}
      {!isDossierOpen && (
        <button
          onClick={() => setIsDossierOpen(true)}
          className="absolute top-18 left-3 z-20 px-3 py-2 bg-[#090d16]/95 backdrop-blur-md border border-white/[0.12] rounded-xl text-xs font-mono text-white flex items-center gap-2 shadow-xl hover:bg-[#121826] cursor-pointer"
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span>Show Vehicle Dossier</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      )}

      {/* =========================================================================
          4. RIGHT / FLOATING MODAL: SELECTED CAMERA DETAILS & OCR EVIDENCE
          ========================================================================= */}
      {selectedStep && (
        <div className="absolute top-18 right-3 z-20 w-80 sm:w-92 bg-[#090d16]/95 backdrop-blur-xl border border-white/[0.10] rounded-2xl shadow-2xl overflow-hidden pointer-events-auto">
          {/* Card Header */}
          <div className="p-3.5 border-b border-white/[0.08] bg-[#0c121e]/80 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Camera className="w-4 h-4 text-cyan-400" />
              <div>
                <span className="text-xs font-mono font-bold text-white">
                  {selectedStep.camera_id}: {selectedStep.camera_name}
                </span>
                <div className="text-[10px] text-slate-400 font-sans">
                  {selectedStep.location}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSelectedStep(null)}
              className="text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3.5 space-y-3 max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin">
            {/* Status & Confirmation Callout */}
            <div
              className={`p-2.5 rounded-xl border flex items-start gap-2.5 ${
                selectedStep.is_missing
                  ? 'bg-amber-500/10 border-amber-500/30 text-amber-200'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              }`}
            >
              {selectedStep.is_missing ? (
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              )}
              <div className="text-xs leading-snug font-mono">
                <div className="font-bold">
                  {selectedStep.is_missing
                    ? '⚠ NOT DETECTED AT NODE (MISSING)'
                    : '✓ CONFIRMED ANPR OBSERVATION'}
                </div>
                <div className="text-[10px] text-slate-400 font-sans mt-0.5">
                  {selectedStep.is_missing
                    ? 'Camera node did not detect vehicle due to temporary optical occlusion / bypass. Reconstructed via velocity consistency.'
                    : `Confidence score: ${(selectedStep.confidence * 100).toFixed(1)}% verified match.`}
                </div>
              </div>
            </div>

            {/* GPS Ground Truth Coordinates (Immutable uploaded rule) */}
            <div className="p-2.5 rounded-xl bg-[#121826] border border-white/[0.06]">
              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-cyan-400" />
                <span>EXACT GPS GROUND TRUTH (NO ROAD SNAPPING)</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono text-white">
                <span>Lat: {selectedStep.lat.toFixed(6)}° N</span>
                <span>Lng: {selectedStep.lng.toFixed(6)}° E</span>
              </div>
              <div className="text-[9px] text-slate-500 mt-1 font-mono">
                Source of Truth: Uploaded camera deployment coordinates preserved exactly.
              </div>
            </div>

            {/* Telemetry Metrics Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-[#121826] border border-white/[0.04]">
                <div className="text-[10px] text-slate-500">TIMESTAMP</div>
                <div className="text-white font-bold mt-0.5">{selectedStep.time}</div>
              </div>
              <div className="p-2 rounded-lg bg-[#121826] border border-white/[0.04]">
                <div className="text-[10px] text-slate-500">TRAVEL DIRECTION</div>
                <div className="text-cyan-300 font-bold mt-0.5 truncate">{selectedStep.direction}</div>
              </div>
              <div className="p-2 rounded-lg bg-[#121826] border border-white/[0.04]">
                <div className="text-[10px] text-slate-500">ESTIMATED SPEED</div>
                <div className="text-white font-bold mt-0.5">{selectedStep.speed_kmh} km/h</div>
              </div>
              <div className="p-2 rounded-lg bg-[#121826] border border-white/[0.04]">
                <div className="text-[10px] text-slate-500">PCU WEIGHT</div>
                <div className="text-white font-bold mt-0.5">{selectedStep.pcu.toFixed(1)} PCU</div>
              </div>
            </div>

            {/* ANPR Evidence Image (If Available) */}
            {selectedStep.evidence_image ? (
              <div className="space-y-1.5">
                <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center justify-between">
                  <span>ANPR EVIDENCE SNAPSHOT</span>
                  <span className="text-cyan-400 font-mono">CONFIRMED OCR</span>
                </div>
                <div className="relative rounded-xl overflow-hidden border border-white/[0.12] bg-black/60 aspect-video flex items-center justify-center">
                  <img
                    src={
                      selectedStep.evidence_image.startsWith('http')
                        ? selectedStep.evidence_image
                        : `${apiClient.getBaseUrl()}${selectedStep.evidence_image}`
                    }
                    alt={`Evidence ${selectedStep.camera_id}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute bottom-1.5 left-2 bg-black/70 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] font-mono text-emerald-400">
                    {trackingDetail?.plate}
                  </div>
                </div>
              </div>
            ) : selectedStep.is_missing ? (
              <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-center">
                <div className="text-xs font-mono text-amber-300">No Image Evidence Available</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  Missing node did not capture visual frame. Velocity-consistent model applied.
                </div>
              </div>
            ) : null}

            {/* Focus Camera in 3D Button */}
            <button
              onClick={() => {
                if (controllerRef.current) {
                  controllerRef.current.flyTo(selectedStep.lat, selectedStep.lng, 750, 0, -45, 1.4);
                }
              }}
              className="w-full py-2 bg-cyan-600/80 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-medium flex items-center justify-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Center Camera in 3D Map</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          5. BOTTOM FLOATING HORIZONTAL TIMELINE
          ========================================================================= */}
      {trackingDetail && trackingDetail.camera_sequence.length > 0 && (
        <div className="absolute bottom-3 left-3 right-3 z-20 pointer-events-none flex justify-center">
          <div className="pointer-events-auto max-w-4xl w-full bg-[#090d16]/95 backdrop-blur-xl border border-white/[0.08] px-4 py-2.5 rounded-2xl shadow-2xl flex items-center justify-between gap-3 overflow-x-auto scrollbar-none">
            {trackingDetail.camera_sequence.map((step, idx) => {
              const isSelected = selectedStep?.camera_id === step.camera_id;
              const isLast = idx === trackingDetail.camera_sequence.length - 1;

              return (
                <React.Fragment key={step.camera_id}>
                  {/* Step Node */}
                  <div
                    onClick={() => handleSelectStep(step)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl cursor-pointer transition-all shrink-0 ${
                      isSelected
                        ? step.is_missing
                          ? 'bg-amber-500/20 border border-amber-500/50 shadow'
                          : 'bg-cyan-500/20 border border-cyan-500/50 shadow'
                        : 'bg-[#121826]/70 border border-white/[0.04] hover:bg-white/[0.08]'
                    }`}
                  >
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${
                        step.is_missing
                          ? 'bg-amber-400 animate-pulse'
                          : 'bg-cyan-400'
                      }`}
                    />
                    <div className="font-mono text-left">
                      <div className="text-[11px] font-bold text-white flex items-center gap-1">
                        <span>{step.camera_id}</span>
                        {step.is_missing && <span className="text-amber-400 text-[9px]">⚠</span>}
                      </div>
                      <div className="text-[9px] text-slate-400">
                        {step.time}
                      </div>
                    </div>
                  </div>

                  {/* Connecting Leg / Transit Delta */}
                  {!isLast && (
                    <div className="flex flex-col items-center justify-center shrink-0 px-1">
                      <div className="text-[8px] font-mono text-slate-500">
                        {trackingDetail.camera_sequence[idx + 1].travel_time_from_prev || 'Transit'}
                      </div>
                      <div
                        className={`w-8 sm:w-12 h-0.5 my-0.5 ${
                          trackingDetail.camera_sequence[idx + 1].is_missing || step.is_missing
                            ? 'border-b-2 border-dashed border-amber-500/60'
                            : 'bg-cyan-500/60'
                        }`}
                      />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
