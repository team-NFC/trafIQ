import React, { useState, useEffect } from 'react';
import { useApp, PageId } from '../../context/AppContext';
import { apiClient } from '../../api/client';
import {
  Globe,
  Video,
  BarChart3,
  ScanLine,
  Navigation,
  ShieldAlert,
  Sparkles,
  Clock,
  Cpu
} from 'lucide-react';

interface NavItem {
  id: PageId;
  label: string;
  icon: React.ElementType;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'map', label: 'MAP', icon: Globe },
  { id: 'cameras', label: 'CAMERAS', icon: Video },
  { id: 'traffic_analysis', label: 'TRAFFIC ANALYSIS', icon: BarChart3 },
  { id: 'anpr', label: 'ANPR', icon: ScanLine },
  { id: 'camera_tracking', label: 'CAMERA TRACKING', icon: Navigation },
  { id: 'database_alerts', label: 'DATABASE ALERTS', icon: ShieldAlert },
  { id: 'ai', label: 'AI', icon: Sparkles }
];

export const Header: React.FC = () => {
  const { currentPage, setCurrentPage, systemTime } = useApp();
  const [backendOnline, setBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;
    const verifyBackend = async () => {
      const isOnline = await apiClient.checkHealth();
      if (isMounted) {
        setBackendOnline(isOnline);
      }
    };

    verifyBackend();
    const timer = setInterval(verifyBackend, 5000);
    return () => {
      isMounted = false;
      clearInterval(timer);
    };
  }, []);

  const isNavActive = (id: PageId) => {
    if (currentPage === id) return true;
    if (id === 'map' && currentPage === 'god_view') return true;
    if (id === 'cameras' && (currentPage === 'traffic_live' || currentPage === 'traffic_cameras')) return true;
    if (id === 'traffic_analysis' && (currentPage === 'traffic_analytics' || currentPage === 'signal_control' || currentPage === 'ambulance_priority')) return true;
    if (id === 'anpr' && (currentPage === 'anpr_search')) return true;
    if (id === 'camera_tracking' && (currentPage === 'anpr_tracking' || currentPage === 'anpr_journey')) return true;
    if (id === 'database_alerts' && currentPage === 'anpr_alerts') return true;
    return false;
  };

  return (
    <header className="h-14 bg-[#07090e]/85 border-b border-white/[0.06] sticky top-0 z-40 px-4 sm:px-6 flex items-center justify-between select-none">
      {/* 1. Clean Flat Brand Identity (No glass container) */}
      <div className="flex items-center gap-2.5">
        <div
          onClick={() => setCurrentPage('map')}
          className="flex items-center gap-2 cursor-pointer group"
          title="Return to 3D Global Earth Map"
        >
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 group-hover:scale-110 transition-transform"></div>
          <span className="font-bold tracking-wider text-sm text-white font-sans flex items-center">
            TRAFFIC<span className="text-slate-400 font-mono font-normal">IQ</span>
          </span>
        </div>
        <span className="text-slate-700 font-sans text-xs hidden sm:inline">|</span>
        <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest hidden xl:inline">
          Global Intelligence
        </span>
      </div>

      {/* 2. ONE Single Subtle Rounded Glass Container for the Navigation Option Group */}
      <nav className="glass-option-group flex items-center gap-1 p-1 overflow-x-auto max-w-[65vw] sm:max-w-none scrollbar-none">
        {NAV_ITEMS.map((item) => {
          const active = isNavActive(item.id);
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`px-3.5 py-1.5 text-xs font-mono tracking-wide flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                active
                  ? 'glass-option-item-active'
                  : 'glass-option-item'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${active ? 'text-white' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* 3. Simple Flat Telemetry & Hardware Status (No glass container) */}
      <div className="flex items-center gap-3 font-mono text-xs text-slate-400">
        {/* Backend Online Status */}
        <div className="flex items-center gap-1.5">
          <span
            className={`w-2 h-2 rounded-full ${
              backendOnline ? 'bg-emerald-400' : 'bg-rose-400'
            }`}
          />
          <span className="text-[11px] text-slate-200 font-semibold tracking-wider">
            {backendOnline ? 'ONLINE' : 'OFFLINE'}
          </span>
        </div>

        <span className="text-slate-700 hidden sm:inline">|</span>

        {/* Local Hardware Indicator */}
        <div className="hidden lg:flex items-center gap-1.5 text-[10px] text-slate-400">
          <Cpu className="w-3 h-3 text-slate-400" />
          <span>RTX 3050</span>
        </div>

        <span className="text-slate-700 hidden sm:inline">|</span>

        {/* Live Clock */}
        <div className="hidden sm:flex items-center gap-1.5 text-slate-400 text-[11px]">
          <Clock className="w-3 h-3 text-slate-500" />
          <span>{systemTime || '00:00:00'}</span>
        </div>
      </div>
    </header>
  );
};
