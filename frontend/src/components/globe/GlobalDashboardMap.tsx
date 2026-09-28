import React, { useState, useEffect, useRef } from 'react';
import {
  GodViewNode,
  GodViewLink,
  CameraItem,
  JunctionItem,
  godViewService
} from '../../api/godview';
import { CameraTelemetry, MapLayerControls, MapBaseStyle } from '../../types/telemetry';
import { GeocodingService, GeocodingResult } from '../../services/geocoding/geocodingService';
import { CesiumGlobe } from './CesiumGlobe';
import { LocationSearchBar } from './LocationSearchBar';
import { LocationInfoCard } from './LocationInfoCard';
import { NavigationDock } from './NavigationDock';
import { BottomTelemetry } from './BottomTelemetry';
import { SingleCameraDrawer } from './SingleCameraDrawer';
import { JunctionOverviewModal } from './JunctionOverviewModal';
import { AddJunctionModal } from './AddJunctionModal';
import { AddCameraModal } from './AddCameraModal';
import {
  Plus,
  Crosshair,
  CheckCircle,
  BarChart2,
  Layers,
  ChevronDown
} from 'lucide-react';

interface GlobalDashboardMapProps {
  nodes?: GodViewNode[];
  links?: GodViewLink[];
  activeScenario: string;
  selectedNodeId?: string | null;
  onSelectNode?: (node: GodViewNode) => void;
  onSelectScenario?: (scenarioId: string) => void;
  onToggleAnalyticsDrawer?: () => void;
  isAnalyticsDrawerOpen?: boolean;
  analyticsData?: any;
}

export const GlobalDashboardMap: React.FC<GlobalDashboardMapProps> = ({
  nodes = [],
  links = [],
  activeScenario,
  selectedNodeId,
  onSelectNode,
  onToggleAnalyticsDrawer,
  isAnalyticsDrawerOpen = false,
  analyticsData
}) => {
  const [is3D, setIs3D] = useState<boolean>(true);
  const [selectedLocation, setSelectedLocation] = useState<GeocodingResult | null>(null);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number; accuracy?: number } | null>(null);
  const [isLocating, setIsLocating] = useState<boolean>(false);
  const [isLayerMenuOpen, setIsLayerMenuOpen] = useState<boolean>(false);

  // Dynamic Camera & Junction data from SQLite backend
  const [cameras, setCameras] = useState<CameraItem[]>([]);
  const [junctions, setJunctions] = useState<JunctionItem[]>([]);

  // Selected entities for interaction modals
  const [selectedCamera, setSelectedCamera] = useState<CameraItem | null>(null);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>(null);

  // Add Dropdown & Modals State
  const [isAddMenuOpen, setIsAddMenuOpen] = useState<boolean>(false);
  const [isAddJunctionOpen, setIsAddJunctionOpen] = useState<boolean>(false);
  const [isAddCameraOpen, setIsAddCameraOpen] = useState<boolean>(false);
  const [addCoords, setAddCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [addLocationName, setAddLocationName] = useState<string>('');
  const [isPickingLocation, setIsPickingLocation] = useState<boolean>(false);
  const [pickTarget, setPickTarget] = useState<'junction' | 'camera'>('junction');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Active zoom hierarchy level tracking
  const [currentZoomLevel, setCurrentZoomLevel] = useState<'earth' | 'india' | 'tamil_nadu' | 'trichy' | 'junction'>('earth');

  // Google Maps Style: 'google_hybrid' (default satellite + roads), 'google_roadmap', 'google_terrain'
  const [mapStyle, setMapStyle] = useState<MapBaseStyle>('google_hybrid');

  // Map Layer Controls
  const [layers, setLayers] = useState<MapLayerControls>({
    satellite: true,
    labels: true,
    osm: false,
    buildings3D: true,
    cameraNodes: true,
    roadLinks: true,
    traffic: false
  });

  // Telemetry state
  const [telemetry, setTelemetry] = useState<CameraTelemetry>({
    latitude: 20.5937,
    longitude: 78.9629,
    altitudeKm: 24000.0,
    headingDeg: 0,
    pitchDeg: -90,
    rollDeg: 0
  });

  // Dynamic hierarchy synchronization based on altitude
  useEffect(() => {
    const alt = telemetry.altitudeKm;
    if (alt > 2500) {
      setCurrentZoomLevel('earth');
    } else if (alt > 500) {
      setCurrentZoomLevel('india');
    } else if (alt > 70) {
      setCurrentZoomLevel('tamil_nadu');
    } else if (alt > 6) {
      setCurrentZoomLevel('trichy');
    } else {
      setCurrentZoomLevel('junction');
    }
  }, [telemetry.altitudeKm]);

  // Controller reference exposed by CesiumGlobe
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

  // Fetch cameras and junctions on mount & scenario change
  const refreshEntities = async () => {
    try {
      const [camsRes, juncsRes] = await Promise.all([
        godViewService.getCameras(),
        godViewService.getJunctions()
      ]);
      if (camsRes.data?.cameras) {
        setCameras(camsRes.data.cameras);
      }
      if (juncsRes.data?.junctions) {
        const jList = juncsRes.data.junctions;
        setJunctions(jList);
        const savedJId = localStorage.getItem('trafficiq_last_junction_id');
        if (savedJId && jList.some(j => j.id === savedJId)) {
          setSelectedJunctionId(savedJId);
        }
      }
    } catch (err) {
      console.warn('Could not refresh cameras/junctions from SQLite:', err);
    }
  };

  useEffect(() => {
    refreshEntities();
  }, [activeScenario]);

  // Handle Search Result Select
  const handleLocationSelect = (res: GeocodingResult) => {
    setSelectedLocation(res);
    if (controllerRef.current) {
      controllerRef.current.flyTo(res.latitude, res.longitude, 2500, undefined, is3D ? -50 : -90, 2.2);
    }
  };

  // Calculate Nearest Known Junction from clicked coordinates
  const getNearestJunctionName = (lat: number, lon: number) => {
    if (junctions.length === 0) return 'None';
    let minDist = Infinity;
    let nearest: JunctionItem | null = null;
    junctions.forEach(j => {
      const dLat = (j.latitude - lat) * 111320;
      const dLon = (j.longitude - lon) * 111320 * Math.cos((lat * Math.PI) / 180);
      const distMeters = Math.sqrt(dLat * dLat + dLon * dLon);
      if (distMeters < minDist) {
        minDist = distMeters;
        nearest = j;
      }
    });
    if (nearest && minDist < 2000) {
      return `${(nearest as JunctionItem).name} (~${Math.round(minDist)}m)`;
    }
    return 'None';
  };

  // Handle Ground Click on Map (Empty space)
  const handleMapClick = async (lat: number, lon: number) => {
    setSelectedCamera(null);
    setSelectedJunctionId(null);
    const res = await GeocodingService.reverseGeocode(lat, lon);
    setSelectedLocation(res);
  };

  // Handle "+ Add Signal Here" from Location Info Card
  const handleAddJunctionHere = (lat: number, lon: number) => {
    setAddCoords({ lat, lon });
    setAddLocationName(selectedLocation?.formattedAddress || selectedLocation?.name || '');
    setSelectedLocation(null);
    setIsAddJunctionOpen(true);
  };

  // Handle "+ Add Camera Here" from Location Info Card
  const handleAddCameraHere = (lat: number, lon: number) => {
    setAddCoords({ lat, lon });
    setAddLocationName(selectedLocation?.formattedAddress || selectedLocation?.name || '');
    setSelectedLocation(null);
    setIsAddCameraOpen(true);
  };

  // Handle Pick on Map Crosshair click
  const handlePickLocation = async (lat: number, lon: number) => {
    setIsPickingLocation(false);
    setAddCoords({ lat, lon });
    try {
      const geo = await GeocodingService.reverseGeocode(lat, lon);
      setAddLocationName(geo.formattedAddress || geo.name || '');
    } catch {
      setAddLocationName('');
    }
    if (pickTarget === 'junction') {
      setIsAddJunctionOpen(true);
    } else {
      setIsAddCameraOpen(true);
    }
    setToastMessage(`Captured exact coordinates: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Junction Successfully Added
  const handleJunctionAdded = (newJunc: JunctionItem) => {
    refreshEntities();
    // Immediately open the Junction Control View / bar after creation
    setSelectedJunctionId(newJunc.id);
    localStorage.setItem('trafficiq_last_junction_id', newJunc.id);
    setSelectedCamera(null);
    setSelectedLocation(null);

    setToastMessage(`Signal Junction ${newJunc.id} deployed at exact GPS (${newJunc.latitude.toFixed(6)}, ${newJunc.longitude.toFixed(6)})!`);
    setTimeout(() => setToastMessage(null), 5000);

    if (controllerRef.current) {
      controllerRef.current.flyTo(newJunc.latitude, newJunc.longitude, 1300, undefined, is3D ? -50 : -90, 2.0);
    }
  };

  // Handle Junction Deletion
  const handleDeleteJunction = async (junctionId: string) => {
    refreshEntities();
    setSelectedJunctionId(null);
    setToastMessage(`Junction ${junctionId} and associated approach cameras removed.`);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handle Camera Successfully Added
  const handleCameraAdded = (newCam: CameraItem) => {
    setCameras(prev => {
      const filtered = prev.filter(c => c.id !== newCam.id);
      return [...filtered, newCam];
    });
    // Immediately refresh backend entities so full database state is synchronized
    refreshEntities();

    // Immediately open the Single Camera Drawer / bar after creation
    setSelectedCamera(newCam);
    setSelectedJunctionId(null);
    setSelectedLocation(null);

    setToastMessage(`Camera ${newCam.id} deployed at exact GPS (${newCam.latitude.toFixed(6)}, ${newCam.longitude.toFixed(6)})!`);
    setTimeout(() => setToastMessage(null), 5000);

    // Fly to new camera
    if (controllerRef.current) {
      controllerRef.current.flyTo(newCam.latitude, newCam.longitude, 1200, undefined, is3D ? -50 : -90, 2.0);
    }
  };

  // Handle Camera Deletion
  const handleDeleteCamera = async (cameraId: string) => {
    if (!confirm(`Are you sure you want to remove ${cameraId}?`)) return;
    try {
      await godViewService.deleteCamera(cameraId);
      setCameras(prev => prev.filter(c => c.id !== cameraId));
      setSelectedCamera(null);
      setToastMessage(`Camera ${cameraId} removed.`);
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err: any) {
      alert(`Could not delete camera: ${err.message || 'Server error'}`);
    }
  };

  // Single Camera marker click
  const handleSelectCamera = (camera: CameraItem) => {
    setSelectedLocation(null);
    setSelectedJunctionId(null);
    setSelectedCamera(camera);

    if (onSelectNode) {
      const matchedNode = nodes.find(n => n.id === camera.id);
      if (matchedNode) onSelectNode(matchedNode);
    }

    if (controllerRef.current) {
      controllerRef.current.flyTo(camera.latitude, camera.longitude, 850, undefined, is3D ? -50 : -90, 1.8);
    }
  };

  // Junction marker click (4-way intersection)
  const handleSelectJunction = (junction: JunctionItem) => {
    setSelectedLocation(null);
    setSelectedCamera(null);
    setSelectedJunctionId(junction.id);
    localStorage.setItem('trafficiq_last_junction_id', junction.id);

    if (controllerRef.current) {
      controllerRef.current.flyTo(junction.latitude, junction.longitude, 1300, undefined, is3D ? -50 : -90, 2.0);
    }
  };

  // Open Junction from Camera Drawer
  const handleOpenJunctionFromCam = (juncId: string) => {
    setSelectedCamera(null);
    setSelectedJunctionId(juncId);
    localStorage.setItem('trafficiq_last_junction_id', juncId);
    const junc = junctions.find(j => j.id === juncId);
    if (junc && controllerRef.current) {
      controllerRef.current.flyTo(junc.latitude, junc.longitude, 1300, undefined, is3D ? -50 : -90, 2.0);
    }
  };

  // Handle "My Location" (GPS) Click
  const handleGetCurrentLocation = async () => {
    setIsLocating(true);
    try {
      const loc = await GeocodingService.getCurrentLocation();
      setCurrentLocation(loc);

      const res = await GeocodingService.reverseGeocode(loc.lat, loc.lon);
      res.name = 'Your Current Location';
      res.isCurrentLocation = true;
      setSelectedLocation(res);

      if (controllerRef.current) {
        controllerRef.current.flyTo(loc.lat, loc.lon, 1500, undefined, is3D ? -50 : -90, 2.0);
      }
    } catch (err: any) {
      alert(`Could not get current GPS location: ${err.message || 'Permission denied'}`);
    } finally {
      setIsLocating(false);
    }
  };

  const handleToggle3D = () => {
    const next3D = !is3D;
    setIs3D(next3D);
    if (controllerRef.current) {
      controllerRef.current.set3DMode(next3D);
    }
  };

  const handleSet3DMode = (enable3D: boolean) => {
    setIs3D(enable3D);
    if (controllerRef.current) {
      controllerRef.current.set3DMode(enable3D);
    }
  };

  // Cinematic Zoom Hierarchy Handlers
  const handleFlyEarth = () => {
    setCurrentZoomLevel('earth');
    setSelectedCamera(null);
    setSelectedJunctionId(null);
    setSelectedLocation(null);
    controllerRef.current?.flyToEarth();
  };

  const handleFlyIndia = () => {
    setCurrentZoomLevel('india');
    controllerRef.current?.flyToIndia();
  };

  const handleFlyTamilNadu = () => {
    setCurrentZoomLevel('tamil_nadu');
    controllerRef.current?.flyToTamilNadu();
  };

  const handleFlyTrichy = () => {
    setCurrentZoomLevel('trichy');
    controllerRef.current?.flyToTrichy();
  };

  const handleFlyJunction = () => {
    setCurrentZoomLevel('junction');
    if (junctions.length > 0) {
      const target = selectedJunctionId ? junctions.find(j => j.id === selectedJunctionId) || junctions[0] : junctions[0];
      controllerRef.current?.flyTo(target.latitude, target.longitude, 1300, undefined, is3D ? -50 : -90, 2.0);
    } else if (cameras.length > 0) {
      controllerRef.current?.flyTo(cameras[0].latitude, cameras[0].longitude, 1300, undefined, is3D ? -50 : -90, 2.0);
    } else {
      controllerRef.current?.flyToJunction();
    }
  };

  const handleResetNorth = () => {
    controllerRef.current?.resetNorth();
  };

  const handleZoomIn = () => {
    controllerRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    controllerRef.current?.zoomOut();
  };

  const handleToggleLayer = (layerKey: keyof MapLayerControls) => {
    setLayers(prev => ({ ...prev, [layerKey]: !prev[layerKey] }));
  };

  return (
    <div className="relative w-full h-[calc(100vh-56px)] bg-[#07090e] overflow-hidden select-none flex flex-col font-sans">
      {/* 1. Main Full-Screen 3D Cesium Global Earth (Primary Visual Hero) */}
      <div className="flex-1 relative w-full h-full">
        <CesiumGlobe
          is3D={is3D}
          layers={layers}
          mapStyle={mapStyle}
          selectedLocation={selectedLocation}
          currentLocation={currentLocation}
          nodes={nodes}
          cameras={cameras}
          junctions={junctions}
          links={links}
          activeScenario={activeScenario}
          selectedNodeId={selectedNodeId}
          selectedCameraId={selectedCamera ? selectedCamera.id : null}
          selectedJunctionId={selectedJunctionId}
          onSelectCamera={handleSelectCamera}
          onSelectJunction={handleSelectJunction}
          onMapClick={handleMapClick}
          onTelemetryUpdate={setTelemetry}
          isPickingLocation={isPickingLocation}
          onPickLocation={handlePickLocation}
          onRegisterController={(ctrl) => {
            controllerRef.current = ctrl;
          }}
        />

        {/* 2. Top-Left Floating Location Search Bar */}
        <div className="absolute top-4 left-5 z-20 pointer-events-auto">
          <LocationSearchBar
            onLocationSelect={handleLocationSelect}
            onLocateMe={handleGetCurrentLocation}
            configuredJunctions={junctions}
            configuredCameras={cameras}
          />
        </div>

        {/* 3. Top-Center Cinematic Zoom Hierarchy: EARTH -> INDIA -> TAMIL NADU -> TRICHY -> JUNCTION (Option Group) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 pointer-events-auto hidden md:flex items-center gap-1 glass-option-group px-2 py-1 font-mono text-[11px]">
          <button
            onClick={handleFlyEarth}
            className={`px-3 py-1 transition-all cursor-pointer whitespace-nowrap ${
              currentZoomLevel === 'earth'
                ? 'glass-option-item-active'
                : 'glass-option-item'
            }`}
            title="Fly to Planetary Earth in Space Orbit"
          >
            EARTH
          </button>

          <span className="text-slate-600 font-sans text-xs">›</span>

          <button
            onClick={handleFlyIndia}
            className={`px-3 py-1 transition-all cursor-pointer whitespace-nowrap ${
              currentZoomLevel === 'india'
                ? 'glass-option-item-active'
                : 'glass-option-item'
            }`}
            title="Fly to India Subcontinent"
          >
            INDIA
          </button>

          <span className="text-slate-600 font-sans text-xs">›</span>

          <button
            onClick={handleFlyTamilNadu}
            className={`px-3 py-1 transition-all cursor-pointer whitespace-nowrap ${
              currentZoomLevel === 'tamil_nadu'
                ? 'glass-option-item-active'
                : 'glass-option-item'
            }`}
            title="Fly to Tamil Nadu State"
          >
            TAMIL NADU
          </button>

          <span className="text-slate-600 font-sans text-xs">›</span>

          <button
            onClick={handleFlyTrichy}
            className={`px-3 py-1 transition-all cursor-pointer whitespace-nowrap ${
              currentZoomLevel === 'trichy'
                ? 'glass-option-item-active'
                : 'glass-option-item'
            }`}
            title="Fly to Tiruchirappalli City Grid"
          >
            TRICHY
          </button>

          <span className="text-slate-600 font-sans text-xs">›</span>

          <button
            onClick={handleFlyJunction}
            className={`px-3 py-1 transition-all cursor-pointer whitespace-nowrap ${
              currentZoomLevel === 'junction'
                ? 'glass-option-item-active'
                : 'glass-option-item'
            }`}
            title="Fly to Monitored Signal Junction"
          >
            JUNCTION
          </button>
        </div>

        {/* 4. Top-Right Floating Controls (Clean Flat Individual Buttons - No Glass Boxes) */}
        <div className="absolute top-4 right-5 z-20 pointer-events-auto flex items-center gap-2">
          {/* "+ ADD" Dropdown with TWO choices */}
          <div className="relative">
            <button
              onClick={() => setIsAddMenuOpen(!isAddMenuOpen)}
              className="bg-[#0e131d]/90 hover:bg-[#161c28] text-slate-200 hover:text-white font-mono text-xs px-3 py-1.5 rounded-lg border border-white/[0.1] shadow-lg flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Add a Signal/Junction or Normal Standalone Camera"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold">+ ADD</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {isAddMenuOpen && (
              <div className="absolute right-0 mt-1.5 w-56 bg-[#0b0f19] border border-white/10 rounded-xl shadow-2xl p-1.5 z-30 font-mono text-xs animate-in fade-in zoom-in-95 duration-150">
                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setAddCoords(null);
                    setIsAddJunctionOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-purple-950/60 hover:text-purple-200 text-slate-200 transition text-left cursor-pointer"
                >
                  <span className="text-base">🚦</span>
                  <div>
                    <div className="font-bold text-white">SIGNAL / JUNCTION</div>
                    <div className="text-[10px] text-slate-400">Primary Hub + Approach Cams</div>
                  </div>
                </button>

                <div className="h-px bg-white/5 my-1" />

                <button
                  onClick={() => {
                    setIsAddMenuOpen(false);
                    setAddCoords(null);
                    setAddLocationName('');
                    setIsAddCameraOpen(true);
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg hover:bg-cyan-950/60 hover:text-cyan-200 text-slate-200 transition text-left cursor-pointer"
                >
                  <span className="text-base">📷</span>
                  <div>
                    <div className="font-bold text-white">NORMAL CAMERA</div>
                    <div className="text-[10px] text-slate-400">Single Standalone Camera</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {onToggleAnalyticsDrawer && (
            <button
              onClick={onToggleAnalyticsDrawer}
              className={`px-3 py-1.5 rounded-lg font-mono text-xs transition-colors cursor-pointer flex items-center gap-1.5 border shadow-md ${
                isAnalyticsDrawerOpen
                  ? 'bg-white/[0.14] text-white border-white/[0.18]'
                  : 'bg-[#0e131d]/85 hover:bg-[#161c28] text-slate-300 hover:text-white border-white/[0.08]'
              }`}
              title="Toggle detailed PCU split, ANPR trajectories, and incident audit drawer"
            >
              <BarChart2 className="w-3.5 h-3.5 text-slate-400" />
              <span>DRAWER</span>
            </button>
          )}
        </div>

        {/* 5. Bottom-Left Mode Switcher & Layer Controls (Option Groups) */}
        <div className="absolute bottom-12 left-5 z-20 pointer-events-auto flex items-center gap-2">
          {/* Option Group 1: Satellite / Map / Terrain */}
          <div className="glass-option-group p-1 flex items-center gap-1 font-mono text-[11px]">
            <button
              onClick={() => setMapStyle('google_hybrid')}
              className={`px-2.5 py-1 transition-all cursor-pointer ${
                mapStyle === 'google_hybrid'
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
              title="Google Satellite & Roads (Google Maps Hybrid)"
            >
              SATELLITE
            </button>
            <button
              onClick={() => setMapStyle('google_roadmap')}
              className={`px-2.5 py-1 transition-all cursor-pointer ${
                mapStyle === 'google_roadmap'
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
              title="Google Maps Standard Roadmap"
            >
              MAP
            </button>
            <button
              onClick={() => setMapStyle('google_terrain')}
              className={`px-2.5 py-1 transition-all cursor-pointer ${
                mapStyle === 'google_terrain'
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
              title="Google Maps Terrain"
            >
              TERRAIN
            </button>
          </div>

          {/* Option Group 2: 3D / 2D / Layers */}
          <div className="glass-option-group p-1 flex items-center gap-1 font-mono text-[11px]">
            <button
              onClick={() => handleSet3DMode(true)}
              className={`px-2.5 py-1 transition-all cursor-pointer ${
                is3D
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
            >
              3D
            </button>
            <button
              onClick={() => handleSet3DMode(false)}
              className={`px-2.5 py-1 transition-all cursor-pointer ${
                !is3D
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
            >
              2D
            </button>
            <div className="w-px h-3.5 bg-white/[0.12] mx-0.5" />
            <button
              onClick={() => setIsLayerMenuOpen(!isLayerMenuOpen)}
              className={`px-2.5 py-1 flex items-center gap-1.5 transition-all cursor-pointer ${
                layers.traffic ? 'text-emerald-400 font-semibold' : 'glass-option-item'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>LAYERS</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>
          </div>

          {/* Layer Control Popover (Clean flat panel) */}
          {isLayerMenuOpen && (
            <div className="bg-[#0c0f17]/95 border border-white/[0.08] rounded-xl absolute bottom-12 left-64 w-60 p-2.5 shadow-xl font-mono text-xs text-slate-200 space-y-1.5 z-30">
              <div className="text-[10px] text-slate-400 font-bold uppercase pb-1 border-b border-white/[0.06] flex items-center justify-between">
                <span>MAP SENSORS</span>
                <span className="text-[9px] text-slate-500 font-normal">CLEAN TILES</span>
              </div>
              <label className="flex items-center justify-between cursor-pointer hover:bg-white/[0.04] p-1 rounded">
                <span className="text-emerald-300 flex items-center gap-1.5 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    LIVE GOOGLE TRAFFIC
                  </span>
                  <input
                    type="checkbox"
                    checked={layers.traffic}
                    onChange={() => handleToggleLayer('traffic')}
                    className="accent-emerald-500"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-white/[0.04] p-1 rounded">
                  <span>CAMERAS ({cameras.length})</span>
                  <input
                    type="checkbox"
                    checked={layers.cameraNodes}
                    onChange={() => handleToggleLayer('cameraNodes')}
                    className="accent-slate-200"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-white/[0.04] p-1 rounded">
                  <span>ROAD CORRIDORS</span>
                  <input
                    type="checkbox"
                    checked={layers.roadLinks}
                    onChange={() => handleToggleLayer('roadLinks')}
                    className="accent-slate-200"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-white/[0.04] p-1 rounded">
                  <span>3D BUILDINGS</span>
                  <input
                    type="checkbox"
                    checked={layers.buildings3D}
                    onChange={() => handleToggleLayer('buildings3D')}
                    className="accent-slate-200"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer hover:bg-white/[0.04] p-1 rounded">
                  <span>STREET & PLACE LABELS</span>
                  <input
                    type="checkbox"
                    checked={layers.labels}
                    onChange={() => handleToggleLayer('labels')}
                    className="accent-slate-200"
                  />
                </label>
              </div>
            )}
        </div>

        {/* Crosshair Pick Mode HUD Indicator */}
        {isPickingLocation && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 pointer-events-none select-none bg-[#0c0f16]/95 border border-white/[0.18] px-4 py-2 rounded-xl text-slate-200 font-mono text-xs flex items-center gap-2 shadow-2xl">
            <Crosshair className="w-4 h-4 text-emerald-400" />
            <span>CLICK EXACT LOCATION ON 3D GLOBE TO SET {pickTarget === 'junction' ? 'SIGNAL JUNCTION' : 'CAMERA'} COORDINATES</span>
          </div>
        )}

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div className="absolute top-20 right-5 z-30 pointer-events-none select-none bg-[#0c0f16]/95 border border-emerald-500/40 px-4 py-2 rounded-xl text-slate-200 font-mono text-xs flex items-center gap-2 shadow-2xl animate-in slide-in-from-top duration-200">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* 6. Selected / Clicked Location Information Card (Empty space click) */}
        <LocationInfoCard
          location={selectedLocation}
          nearestJunction={selectedLocation ? getNearestJunctionName(selectedLocation.latitude, selectedLocation.longitude) : undefined}
          onClose={() => setSelectedLocation(null)}
          onFlyTo={(lat, lon) => {
            controllerRef.current?.flyTo(lat, lon, 2500, undefined, is3D ? -50 : -90, 2.0);
          }}
          onAddJunctionHere={handleAddJunctionHere}
          onAddCameraHere={handleAddCameraHere}
        />

        {/* 7. Navigation Dock (GPS, Compass, Zoom In/Out) */}
        <NavigationDock
          is3D={is3D}
          onToggle3D={handleToggle3D}
          onResetNorth={handleResetNorth}
          onResetEarth={handleFlyEarth}
          onCenterTrichy={handleFlyTrichy}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onGetCurrentLocation={handleGetCurrentLocation}
          isLocating={isLocating}
          layers={layers}
          onToggleLayer={handleToggleLayer}
        />

        {/* 8. Bottom Telemetry Strip */}
        <BottomTelemetry telemetry={telemetry} is3D={is3D} />
      </div>

      {/* 9. Single Camera Card (Floating on right side, preserves map visibility) */}
      <SingleCameraDrawer
        camera={selectedCamera}
        onClose={() => setSelectedCamera(null)}
        onOpenJunction={handleOpenJunctionFromCam}
        onDeleteCamera={handleDeleteCamera}
        onOpenAnalytics={onToggleAnalyticsDrawer}
        analyticsData={analyticsData}
      />

      {/* 10. 4-Way Junction Overview Card (Floating on right side) */}
      <JunctionOverviewModal
        junctionId={selectedJunctionId}
        onClose={() => setSelectedJunctionId(null)}
        onSelectCamera={handleSelectCamera}
        onDeleteJunction={handleDeleteJunction}
        activeScenario={activeScenario}
      />

      {/* 11. Add Signal / Junction Floating Modal */}
      <AddJunctionModal
        isOpen={isAddJunctionOpen}
        initialLat={addCoords?.lat}
        initialLon={addCoords?.lon}
        existingJunctionsCount={junctions.length}
        existingCamerasCount={cameras.length}
        onClose={() => setIsAddJunctionOpen(false)}
        onJunctionAdded={handleJunctionAdded}
        onPickOnMap={() => {
          setPickTarget('junction');
          setIsAddJunctionOpen(false);
          setIsPickingLocation(true);
        }}
      />

      {/* 12. Add Normal Standalone Camera Floating Modal */}
      <AddCameraModal
        isOpen={isAddCameraOpen}
        initialLat={addCoords?.lat}
        initialLon={addCoords?.lon}
        initialLocationName={addLocationName}
        existingCamerasCount={cameras.length}
        existingCameraIds={cameras.map(c => c.id)}
        onClose={() => setIsAddCameraOpen(false)}
        onCameraAdded={handleCameraAdded}
        onPickOnMap={() => {
          setPickTarget('camera');
          setIsAddCameraOpen(false);
          setIsPickingLocation(true);
        }}
      />
    </div>
  );
};
