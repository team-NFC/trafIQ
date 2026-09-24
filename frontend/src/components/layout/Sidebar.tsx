import React from 'react';
import { useApp, PageId } from '../../context/AppContext';
import {
  LayoutDashboard,
  Video,
  BarChart3,
  TrafficCone,
  Ambulance,
  ScanLine,
  Search,
  Route,
  ShieldAlert,
  FileText,
  Settings,
  Radio,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggleCollapse }) => {
  const { currentPage, setCurrentPage } = useApp();

  const navItemClass = (pageId: PageId) => {
    const isActive = currentPage === pageId;
    return `group flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 cursor-pointer ${
      isActive
        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-950/40'
        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
    }`;
  };

  return (
    <aside
      className={`fixed left-0 top-0 bottom-0 z-30 bg-[#090d18] border-r border-slate-800/80 flex flex-col transition-all duration-300 ${
        collapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800/80 bg-[#070a13]">
        <div className="flex items-center gap-3 overflow-hidden cursor-pointer" onClick={() => setCurrentPage('overview')}>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-md shadow-cyan-500/25 shrink-0">
            <Radio className="w-5 h-5 animate-pulse" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-wider text-white flex items-center gap-1.5">
                TRAFFIC<span className="text-cyan-400">IQ</span>
              </span>
              <span className="text-[10px] uppercase font-semibold tracking-widest text-slate-400">
                AI Operations Center
              </span>
            </div>
          )}
        </div>

        <button
          onClick={onToggleCollapse}
          className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Section */}
        <div className="space-y-1">
          <div
            onClick={() => setCurrentPage('overview')}
            className={navItemClass('overview')}
            title="Overview"
          >
            <LayoutDashboard className="w-5 h-5 shrink-0 text-cyan-400" />
            {!collapsed && <span>Overview</span>}
          </div>
        </div>

        {/* TRAFFIC SECTION */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Traffic Junction</span>
              <span className="text-[10px] bg-cyan-950/80 text-cyan-400 px-1.5 py-0.5 rounded border border-cyan-800/40">
                4-WAY
              </span>
            </div>
          )}

          <div
            onClick={() => setCurrentPage('traffic_live')}
            className={navItemClass('traffic_live')}
            title="Live Dashboard"
          >
            <Video className="w-5 h-5 shrink-0 text-blue-400" />
            {!collapsed && <span>Live Dashboard</span>}
          </div>

          <div
            onClick={() => setCurrentPage('traffic_cameras')}
            className={navItemClass('traffic_cameras')}
            title="Camera Feeds"
          >
            <Radio className="w-5 h-5 shrink-0 text-emerald-400" />
            {!collapsed && <span>Camera Feeds</span>}
          </div>

          <div
            onClick={() => setCurrentPage('traffic_analytics')}
            className={navItemClass('traffic_analytics')}
            title="Traffic Analytics"
          >
            <BarChart3 className="w-5 h-5 shrink-0 text-indigo-400" />
            {!collapsed && <span>Traffic Analytics</span>}
          </div>

          <div
            onClick={() => setCurrentPage('signal_control')}
            className={navItemClass('signal_control')}
            title="Signal Control"
          >
            <TrafficCone className="w-5 h-5 shrink-0 text-amber-400" />
            {!collapsed && <span>Signal Control</span>}
          </div>

          <div
            onClick={() => setCurrentPage('ambulance_priority')}
            className={navItemClass('ambulance_priority')}
            title="Ambulance Priority"
          >
            <Ambulance className="w-5 h-5 shrink-0 text-rose-500" />
            {!collapsed && (
              <span className="flex items-center justify-between flex-1">
                <span>Ambulance Priority</span>
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
              </span>
            )}
          </div>
        </div>

        {/* ANPR SECTION */}
        <div className="space-y-1">
          {!collapsed && (
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>ANPR Intelligence</span>
              <span className="text-[10px] bg-purple-950/80 text-purple-300 px-1.5 py-0.5 rounded border border-purple-800/40">
                CITY-WIDE
              </span>
            </div>
          )}

          <div
            onClick={() => setCurrentPage('anpr_tracking')}
            className={navItemClass('anpr_tracking')}
            title="Camera Tracking"
          >
            <ScanLine className="w-5 h-5 shrink-0 text-purple-400" />
            {!collapsed && <span>Camera Tracking</span>}
          </div>

          <div
            onClick={() => setCurrentPage('anpr_search')}
            className={navItemClass('anpr_search')}
            title="Plate Search"
          >
            <Search className="w-5 h-5 shrink-0 text-fuchsia-400" />
            {!collapsed && <span>Plate Search</span>}
          </div>

          <div
            onClick={() => setCurrentPage('anpr_journey')}
            className={navItemClass('anpr_journey')}
            title="Vehicle Journey"
          >
            <Route className="w-5 h-5 shrink-0 text-cyan-400" />
            {!collapsed && <span>Vehicle Journey</span>}
          </div>

          <div
            onClick={() => setCurrentPage('anpr_alerts')}
            className={navItemClass('anpr_alerts')}
            title="Database Alerts"
          >
            <ShieldAlert className="w-5 h-5 shrink-0 text-amber-400" />
            {!collapsed && (
              <span className="flex items-center justify-between flex-1">
                <span>Database Alerts</span>
                <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-mono">
                  1
                </span>
              </span>
            )}
          </div>
        </div>

        {/* UTILITIES */}
        <div className="space-y-1 pt-2 border-t border-slate-800/80">
          <div
            onClick={() => setCurrentPage('reports')}
            className={navItemClass('reports')}
            title="Reports"
          >
            <FileText className="w-5 h-5 shrink-0 text-slate-400" />
            {!collapsed && <span>Reports</span>}
          </div>

          <div
            onClick={() => setCurrentPage('settings')}
            className={navItemClass('settings')}
            title="Settings"
          >
            <Settings className="w-5 h-5 shrink-0 text-slate-400" />
            {!collapsed && <span>Settings</span>}
          </div>
        </div>
      </div>

      {/* System Badge */}
      {!collapsed && (
        <div className="p-3 border-t border-slate-800/80 bg-[#070b14]/90">
          <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <div className="text-[11px] font-semibold text-slate-300">RTX 3050 CUDA</div>
            </div>
            <span className="text-[10px] text-cyan-400 font-mono font-medium">ONLINE</span>
          </div>
        </div>
      )}
    </aside>
  );
};
