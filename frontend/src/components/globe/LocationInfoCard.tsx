import React, { useState } from 'react';
import { MapPin, Navigation, ExternalLink, Copy, Check, X } from 'lucide-react';
import { GeocodingResult } from '../../services/geocoding/geocodingService';

interface LocationInfoCardProps {
  location: GeocodingResult | null;
  nearestJunction?: string | null;
  onClose: () => void;
  onFlyTo: (lat: number, lon: number) => void;
  onAddJunctionHere?: (lat: number, lon: number) => void;
  onAddCameraHere?: (lat: number, lon: number) => void;
}

export const LocationInfoCard: React.FC<LocationInfoCardProps> = ({
  location,
  nearestJunction,
  onClose,
  onFlyTo,
  onAddJunctionHere,
  onAddCameraHere
}) => {
  const [copied, setCopied] = useState<boolean>(false);

  if (!location) return null;

  const handleCopy = () => {
    const text = `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const gmapsUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;

  return (
    <div className="absolute bottom-12 left-4 z-40 pointer-events-auto select-none w-80 bg-[#0c1017]/92 rounded-xl p-4 font-sans text-slate-200 shadow-xl border border-white/[0.08]">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-white/10 pb-2 mb-2">
        <div className="flex items-center gap-2 truncate">
          <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/30">
            <MapPin className="w-4 h-4" />
          </div>
          <div className="truncate">
            <div className="font-bold text-[12px] font-mono text-cyan-300 uppercase tracking-wider">
              LOCATION
            </div>
            <div className="font-bold text-[13px] text-white truncate">
              {location.name}
            </div>
            {location.isCurrentLocation && (
              <span className="text-[9px] font-mono text-cyan-400 font-bold tracking-wider">
                ● CURRENT GPS LOCATION
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Address */}
      <div className="text-[11px] text-slate-300 leading-relaxed mb-2.5 font-sans">
        {location.formattedAddress}
      </div>

      {/* Coordinates readout */}
      <div className="flex items-center justify-between bg-black/40 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono text-[10px] text-slate-400 mb-2">
        <span>{location.latitude.toFixed(6)}° N, {location.longitude.toFixed(6)}° E</span>
        <button
          onClick={handleCopy}
          className="text-slate-400 hover:text-cyan-400 flex items-center gap-1 transition-colors cursor-pointer"
          title="Copy coordinates"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Nearest Known Junction */}
      <div className="bg-black/30 px-2.5 py-1.5 rounded-lg border border-white/5 font-mono text-[10px] space-y-0.5 mb-3">
        <span className="text-slate-500 uppercase text-[9px]">Nearest known junction:</span>
        <div className="text-purple-300 font-semibold">{nearestJunction || 'None'}</div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-2 pt-1 font-mono text-[11px]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => onFlyTo(location.latitude, location.longitude)}
            className="flex-1 bg-white/[0.08] hover:bg-white/[0.14] text-white border border-white/[0.1] py-1.5 px-3 rounded-lg flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer shadow-sm"
          >
            <Navigation className="w-3.5 h-3.5 text-cyan-400" />
            <span>FLY TO TARGET</span>
          </button>

          <a
            href={gmapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 p-1.5 rounded-lg flex items-center justify-center transition-colors"
            title="Open in Google Maps"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {onAddJunctionHere && (
            <button
              onClick={() => onAddJunctionHere(location.latitude, location.longitude)}
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-bold transition cursor-pointer shadow-sm text-[10px]"
            >
              <span>🚦 + SIGNAL</span>
            </button>
          )}

          {onAddCameraHere && (
            <button
              onClick={() => onAddCameraHere(location.latitude, location.longitude)}
              className="bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 py-1.5 px-2 rounded-lg flex items-center justify-center gap-1 font-bold transition cursor-pointer shadow-sm text-[10px]"
            >
              <span>📷 + CAMERA</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
