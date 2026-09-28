import React, { useState, useRef, useEffect } from 'react';
import { Search, MapPin, X, Loader2, Navigation } from 'lucide-react';
import { GeocodingService, GeocodingResult } from '../../services/geocoding/geocodingService';
import { JunctionItem, CameraItem } from '../../api/godview';

interface LocationSearchBarProps {
  onLocationSelect: (result: GeocodingResult) => void;
  onLocateMe: () => void;
  configuredJunctions?: JunctionItem[];
  configuredCameras?: CameraItem[];
}

export const LocationSearchBar: React.FC<LocationSearchBarProps> = ({
  onLocationSelect,
  onLocateMe,
  configuredJunctions = [],
  configuredCameras = []
}) => {
  const [query, setQuery] = useState<string>('');
  const [results, setResults] = useState<GeocodingResult[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search combining local configured objects + geocoding
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsLoading(true);
      const lower = query.toLowerCase().trim();

      // 1. Match local configured junctions & cameras
      const localMatches: GeocodingResult[] = [];

      configuredJunctions.forEach(j => {
        if (j.name.toLowerCase().includes(lower) || j.id.toLowerCase().includes(lower) || (j.location && j.location.toLowerCase().includes(lower))) {
          localMatches.push({
            name: `🚦 ${j.name} (${j.id})`,
            latitude: j.latitude,
            longitude: j.longitude,
            country: j.location || 'India',
            formattedAddress: `Configured Signal Junction • ${j.latitude.toFixed(6)}° N, ${j.longitude.toFixed(6)}° E`
          });
        }
      });

      configuredCameras.forEach(c => {
        if (c.name.toLowerCase().includes(lower) || c.id.toLowerCase().includes(lower) || (c.location && c.location.toLowerCase().includes(lower))) {
          localMatches.push({
            name: `📷 ${c.name} (${c.id})`,
            latitude: c.latitude,
            longitude: c.longitude,
            country: c.location || 'India',
            formattedAddress: `Configured Camera • ${c.direction || 'Approach'} • ${c.latitude.toFixed(6)}° N, ${c.longitude.toFixed(6)}° E`
          });
        }
      });

      // 2. Fetch external geocoding results
      const extResults = await GeocodingService.search(query);
      const combined = [...localMatches, ...extResults];

      setResults(combined);
      setIsLoading(false);
      setIsOpen(combined.length > 0);
    }, 280);

    return () => clearTimeout(timer);
  }, [query, configuredJunctions, configuredCameras]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (item: GeocodingResult) => {
    setQuery(item.name);
    setIsOpen(false);
    onLocationSelect(item);
  };

  const handleSelectLocalJunction = (j: JunctionItem) => {
    const result: GeocodingResult = {
      name: j.name,
      latitude: j.latitude,
      longitude: j.longitude,
      country: j.location || 'India',
      formattedAddress: `Signal Junction ${j.id}`
    };
    setQuery(j.name);
    setIsOpen(false);
    onLocationSelect(result);
  };

  const handleSelectLocalCamera = (c: CameraItem) => {
    const result: GeocodingResult = {
      name: c.name,
      latitude: c.latitude,
      longitude: c.longitude,
      country: c.location || 'India',
      formattedAddress: `Camera ${c.id}`
    };
    setQuery(c.name);
    setIsOpen(false);
    onLocationSelect(result);
  };

  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
  };

  const hasConfiguredLocations = configuredJunctions.length > 0 || configuredCameras.length > 0;

  return (
    <div ref={dropdownRef} className="relative z-20 pointer-events-auto select-none w-72 sm:w-80 font-sans">
      {/* Search Input Bar (Clean flat search - no glass box) */}
      <div className="bg-[#0c0f17]/80 rounded-lg flex items-center px-3 py-1.5 text-slate-200 border border-white/[0.08] shadow-md gap-2">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search configured junction, camera, or coordinates..."
          className="bg-transparent border-none outline-none text-xs text-slate-100 placeholder-slate-400 w-full font-medium"
        />

        {isLoading ? (
          <Loader2 className="w-3.5 h-3.5 text-slate-300 animate-spin shrink-0" />
        ) : query ? (
          <button
            onClick={handleClear}
            className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        ) : null}

        <button
          onClick={onLocateMe}
          title="Zoom to My Current GPS Location"
          className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/[0.08] transition-colors shrink-0 cursor-pointer border-l border-white/[0.08] pl-2"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Dropdown Results */}
      {isOpen && results.length > 0 && (
        <div className="bg-[#0c0f17]/95 rounded-lg mt-1 p-1.5 shadow-xl border border-white/[0.08] max-h-72 overflow-y-auto space-y-0.5">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 py-1 font-bold">
            SEARCH RESULTS ({results.length})
          </div>
          {results.map((r, i) => (
            <div
              key={i}
              onClick={() => handleSelect(r)}
              className="flex items-start gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.06] cursor-pointer transition-colors"
            >
              <MapPin className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
              <div className="truncate">
                <div className="text-xs font-bold text-slate-100 truncate">{r.name}</div>
                <div className="text-[10px] text-slate-400 truncate">{r.formattedAddress}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Chips ONLY for actually configured junctions/cameras */}
      {!query && hasConfiguredLocations && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {configuredJunctions.slice(0, 3).map((j) => (
            <button
              key={j.id}
              onClick={() => handleSelectLocalJunction(j)}
              className="bg-[#0c0f16]/85 hover:bg-[#141824] px-2 py-1 rounded-md text-[10px] font-mono text-purple-300 hover:text-purple-100 transition-all border border-purple-500/20 cursor-pointer flex items-center gap-1"
            >
              <span>🚦</span>
              <span className="truncate max-w-[120px]">{j.name}</span>
            </button>
          ))}
          {configuredCameras.filter(c => !c.junction_id).slice(0, 2).map((c) => (
            <button
              key={c.id}
              onClick={() => handleSelectLocalCamera(c)}
              className="bg-[#0c0f16]/85 hover:bg-[#141824] px-2 py-1 rounded-md text-[10px] font-mono text-cyan-300 hover:text-cyan-100 transition-all border border-cyan-500/20 cursor-pointer flex items-center gap-1"
            >
              <span>📷</span>
              <span className="truncate max-w-[100px]">{c.id}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
