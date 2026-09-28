import React, { useState } from 'react';
import { Crosshair, Compass, Plus, Minus, Layers, Check, Globe } from 'lucide-react';
import { MapLayerControls } from '../../types/telemetry';

interface NavigationDockProps {
  is3D: boolean;
  onToggle3D: () => void;
  onResetNorth: () => void;
  onResetEarth?: () => void;
  onCenterTrichy?: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onGetCurrentLocation: () => void;
  isLocating: boolean;
  layers: MapLayerControls;
  onToggleLayer: (layerKey: keyof MapLayerControls) => void;
}

export const NavigationDock: React.FC<NavigationDockProps> = ({
  is3D,
  onToggle3D,
  onResetNorth,
  onResetEarth,
  onCenterTrichy,
  onZoomIn,
  onZoomOut,
  onGetCurrentLocation,
  isLocating,
  layers,
  onToggleLayer
}) => {
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  return (
    <div className="absolute bottom-12 right-4 z-20 pointer-events-auto select-none flex flex-col items-end gap-2 font-mono">
      {/* Layer Toggle Popover */}
      {showLayerMenu && (
        <div className="liquid-glass p-3 rounded-xl w-60 mb-2 text-[11px] shadow-2xl border border-white/10 text-slate-200">
          <div className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-2 pb-1.5 border-b border-white/10 flex items-center justify-between">
            <span>MAP INTELLIGENCE LAYERS</span>
            <button onClick={() => setShowLayerMenu(false)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
          </div>
          <div className="space-y-1 font-sans text-xs">
            <button
              onClick={() => onToggleLayer('traffic')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span className="text-emerald-300 flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                Live Google Traffic
              </span>
              {layers.traffic && <Check className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('satellite')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span>Satellite Imagery</span>
              {layers.satellite && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('labels')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span>Roads & Place Labels</span>
              {layers.labels && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('osm')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span>OpenStreetMap Grid</span>
              {layers.osm && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('buildings3D')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span>3D Global Buildings</span>
              {layers.buildings3D && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('cameraNodes')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span className="font-semibold text-cyan-300">16 TrafficIQ Cameras</span>
              {layers.cameraNodes && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
            <button
              onClick={() => onToggleLayer('roadLinks')}
              className="w-full flex items-center justify-between p-1.5 rounded-lg hover:bg-white/10 text-left transition-colors cursor-pointer"
            >
              <span className="font-semibold text-cyan-300">Corridor Road Links</span>
              {layers.roadLinks && <Check className="w-3.5 h-3.5 text-cyan-400" />}
            </button>
          </div>
        </div>
      )}

      {/* Main Google Earth Style Controls Stack */}
      <div className="bg-[#0c1017]/85 rounded-xl p-1 flex flex-col items-center gap-1 shadow-lg border border-white/[0.08]">
        {/* Layer Selector */}
        <button
          onClick={() => setShowLayerMenu(!showLayerMenu)}
          title="Toggle Map Layers"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            showLayerMenu ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* 2D / 3D Toggle */}
        <button
          onClick={onToggle3D}
          title={is3D ? 'Switch to 2D Top-Down View' : 'Switch to 3D Perspective Aerial View'}
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors font-bold text-xs cursor-pointer"
        >
          <span className={`px-1 py-0.5 rounded text-[10px] ${is3D ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/40' : 'text-slate-400'}`}>
            {is3D ? '3D' : '2D'}
          </span>
        </button>

        {/* Compass / Reset North */}
        <button
          onClick={onResetNorth}
          title="Reset Heading to North"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Compass className="w-4 h-4 text-rose-400" />
        </button>

        <div className="w-5 h-px bg-white/10 my-0.5" />

        {/* Zoom In */}
        <button
          onClick={onZoomIn}
          title="Zoom In"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          onClick={onZoomOut}
          title="Zoom Out"
          className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
        >
          <Minus className="w-4 h-4" />
        </button>

        <div className="w-5 h-px bg-white/10 my-0.5" />

        {/* Center on Trichy */}
        {onCenterTrichy && (
          <button
            onClick={onCenterTrichy}
            title="Focus Trichy 16-Camera Grid"
            className="p-2 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors font-bold text-[10px] cursor-pointer"
          >
            <span className="font-mono text-[9px] bg-cyan-950 text-cyan-300 px-1 py-0.5 rounded border border-cyan-800">
              TRZ
            </span>
          </button>
        )}

        {/* Center Full Earth */}
        {onResetEarth && (
          <button
            onClick={onResetEarth}
            title="View Entire Planetary Globe"
            className="p-2 rounded-lg text-slate-300 hover:text-cyan-400 hover:bg-white/10 transition-colors cursor-pointer"
          >
            <Globe className="w-4 h-4" />
          </button>
        )}

        {/* GPS My Location */}
        <button
          onClick={onGetCurrentLocation}
          title="My Location"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            isLocating ? 'text-cyan-400 animate-pulse' : 'text-slate-300 hover:text-white hover:bg-white/10'
          }`}
        >
          <Crosshair className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
