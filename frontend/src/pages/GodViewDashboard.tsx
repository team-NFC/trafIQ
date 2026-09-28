import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import {
  godViewService,
  GodViewData,
  TrafficAnalyticsResponse,
  TrajectoriesResponse,
  IncidentsResponse,
  WeatherData,
  PredictionData,
  AmbulanceStateResponse,
} from '../api/godview';
import { GlobalDashboardMap } from '../components/globe/GlobalDashboardMap';
import { TrafficAnalyticsPanel } from '../components/godview/TrafficAnalyticsPanel';
import { TrajectoryViewer } from '../components/godview/TrajectoryViewer';
import { IncidentPanel } from '../components/godview/IncidentPanel';
import { PredictionWidget } from '../components/godview/PredictionWidget';
import {
  BarChart2,
  ChevronDown,
  CloudSun,
  ShieldAlert,
  Eye
} from 'lucide-react';

export const GodViewDashboard: React.FC = () => {
  const { systemTime } = useApp();

  const [activeScenario, setActiveScenario] = useState<string>('normal');
  const [godViewData, setGodViewData] = useState<GodViewData | null>(null);
  const [analytics, setAnalytics] = useState<TrafficAnalyticsResponse | null>(null);
  const [trajectories, setTrajectories] = useState<TrajectoriesResponse | null>(null);
  const [incidents, setIncidents] = useState<IncidentsResponse | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [prediction, setPrediction] = useState<PredictionData | null>(null);
  const [ambulanceState, setAmbulanceState] = useState<AmbulanceStateResponse | null>(null);

  // Expandable telemetry drawer state
  const [isAnalyticsDrawerOpen, setIsAnalyticsDrawerOpen] = useState<boolean>(false);
  const [drawerTab, setDrawerTab] = useState<'analytics' | 'incidents' | 'prediction'>('analytics');

  const fetchDashboardData = async () => {
    try {
      const [gvRes, anRes, trRes, inRes, weRes, prRes, ambRes] = await Promise.all([
        godViewService.getGodView(),
        godViewService.getAnalytics(),
        godViewService.getTrajectories(),
        godViewService.getIncidents(),
        godViewService.getWeather(),
        godViewService.getPrediction(),
        godViewService.getAmbulanceState(),
      ]);

      if (gvRes.data) {
        setGodViewData(gvRes.data);
        if (gvRes.data.active_scenario) {
          setActiveScenario(gvRes.data.active_scenario);
        }
      }
      if (anRes.data) setAnalytics(anRes.data);
      if (trRes.data) setTrajectories(trRes.data);
      if (inRes.data) setIncidents(inRes.data);
      if (weRes.data) setWeather(weRes.data);
      if (prRes.data) setPrediction(prRes.data);
      if (ambRes.data) setAmbulanceState(ambRes.data);
    } catch (err) {
      console.error('Error fetching dashboard telemetry:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, 2500);
    return () => clearInterval(interval);
  }, []);

  const handleSelectScenario = async (scenarioId: string) => {
    try {
      await godViewService.selectScenario(scenarioId);
      setActiveScenario(scenarioId);
      await fetchDashboardData();
    } catch (err) {
      console.error('Failed to change scenario:', err);
    }
  };

  return (
    <div className="relative w-full h-[calc(100vh-64px)] overflow-hidden bg-[#020408]">
      {/* 1. Main Visual Hero: Full-Screen 3D Cesium Global Map */}
      <GlobalDashboardMap
        nodes={godViewData ? godViewData.nodes : []}
        links={godViewData ? godViewData.links : []}
        activeScenario={activeScenario}
        onSelectScenario={handleSelectScenario}
        onToggleAnalyticsDrawer={() => setIsAnalyticsDrawerOpen(!isAnalyticsDrawerOpen)}
        isAnalyticsDrawerOpen={isAnalyticsDrawerOpen}
        analyticsData={analytics}
      />

      {/* 2. Floating Emergency EVP Banner Alert (When Ambulance Scenario / EVP is active) */}
      {(activeScenario === 'ambulance' || ambulanceState?.priority_active) && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-30 pointer-events-auto max-w-xl w-[92%] animate-in slide-in-from-top duration-300">
          <div className="liquid-glass border border-rose-500/50 bg-rose-950/80 px-4 py-2 rounded-2xl shadow-2xl flex items-center justify-between gap-3 text-rose-200 font-mono text-xs">
            <div className="flex items-center gap-2 font-bold truncate">
              <ShieldAlert className="w-4 h-4 text-rose-400 animate-pulse shrink-0" />
              <span>🚨 AMBULANCE EMERGENCY VEHICLE PREEMPTION (EVP) ACTIVE</span>
            </div>
            <span className="text-[10px] bg-rose-900/80 text-white px-2 py-0.5 rounded font-bold border border-rose-600/50 shrink-0">
              {ambulanceState?.approach || 'SOUTH (CAM-03)'} {ambulanceState?.phase || 'GREEN OVERRIDE'}
            </span>
          </div>
        </div>
      )}

      {/* 3. Slide-Up Traffic Intelligence & Analytics Drawer */}
      {isAnalyticsDrawerOpen && (
        <div className="absolute inset-x-0 bottom-0 z-40 max-h-[65vh] bg-[#080d1a]/95 backdrop-blur-2xl border-t border-white/10 shadow-2xl flex flex-col text-slate-100 animate-in slide-in-from-bottom duration-300 pointer-events-auto">
          {/* Drawer Header */}
          <div className="px-6 py-3 border-b border-white/10 bg-slate-900/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <span className="font-mono font-bold text-sm text-white flex items-center gap-2">
                  <span>TRAFFIC INTELLIGENCE & AUDIT DRAWER</span>
                  <span className="text-[10px] px-2 py-0.2 rounded-full font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {activeScenario.toUpperCase().replace('_', ' ')}
                  </span>
                </span>
                <span className="text-xs text-slate-400">
                  Real-time PCU demand allocations, incident audit log, and ANPR journey re-identification
                </span>
              </div>
            </div>

            {/* Navigation Tabs & Close */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-slate-950/80 border border-white/10 p-1 rounded-xl font-mono text-xs">
                <button
                  onClick={() => setDrawerTab('analytics')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    drawerTab === 'analytics'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  PCU ANALYTICS
                </button>
                <button
                  onClick={() => setDrawerTab('incidents')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    drawerTab === 'incidents'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  INCIDENT LOG
                </button>
                <button
                  onClick={() => setDrawerTab('prediction')}
                  className={`px-3 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    drawerTab === 'prediction'
                      ? 'bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  DEMAND FORECAST
                </button>
              </div>

              <button
                onClick={() => setIsAnalyticsDrawerOpen(false)}
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1 font-mono text-xs font-bold"
                title="Minimize Intelligence Drawer"
              >
                <ChevronDown className="w-4 h-4" />
                <span>MINIMIZE</span>
              </button>
            </div>
          </div>

          {/* Drawer Body - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Weather & Active Scenario Header */}
            {weather && (
              <div className="flex items-center justify-between bg-slate-900/60 p-3.5 rounded-xl border border-white/5 font-mono text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CloudSun className="w-4 h-4 text-amber-400" />
                  <span>TRICHY WEATHER:</span>
                  <strong className="text-white">{weather.temperature}°C</strong>
                  <span className="text-slate-500">|</span>
                  <span>{weather.condition} ({weather.description})</span>
                  <span className="text-slate-500">|</span>
                  <span>Humidity: {weather.humidity}%</span>
                </div>
                <div className="text-slate-400">
                  System Clock: <strong className="text-cyan-400">{systemTime}</strong>
                </div>
              </div>
            )}

            {/* Tab 1: PCU Analytics & Trajectory */}
            {drawerTab === 'analytics' && (
              <div className="space-y-6">
                {activeScenario.startsWith('anpr') ? (
                  <TrajectoryViewer trajectories={trajectories} activeScenario={activeScenario} />
                ) : (
                  <TrafficAnalyticsPanel analytics={analytics} activeScenario={activeScenario} />
                )}
              </div>
            )}

            {/* Tab 2: Incident Audit Log */}
            {drawerTab === 'incidents' && (
              <IncidentPanel incidents={incidents} />
            )}

            {/* Tab 3: Demand Prediction & Forecasting */}
            {drawerTab === 'prediction' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <PredictionWidget prediction={prediction} />
                <div className="rounded-2xl border border-slate-800 bg-[#090e1a] p-5 space-y-3.5 shadow-xl">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800/80">
                    <span className="text-sm font-black font-mono tracking-wider uppercase text-white flex items-center gap-2">
                      <Eye className="w-4 h-4 text-cyan-400" />
                      <span>SCENARIO EXECUTION AUDIT</span>
                    </span>
                    <span className="text-xs font-mono text-cyan-400 font-bold uppercase">
                      {activeScenario.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="text-xs text-slate-300 font-sans leading-relaxed space-y-2">
                    {activeScenario === 'normal' && (
                      <p>
                        Standard cyclic adaptive signal timing running on the 4-way intersection. Real CCTV frames from CAM-01 through CAM-04 are processed through YOLOv8 and ByteTrack to allocate green times proportionally to approach PCU demand.
                      </p>
                    )}
                    {activeScenario === 'ambulance' && (
                      <p>
                        Emergency Vehicle Preemption active. A Force Traveller ambulance (Plate <strong className="text-amber-400">TN 45 AU 4608</strong>) approaching along South Approach (CAM-03) has triggered emergency override. Conflicting approaches are held at RED while South approach maintains an uninterrupted green corridor.
                      </p>
                    )}
                    {activeScenario === 'anpr_missing' && (
                      <p>
                        Multi-camera vehicle correlation along Bharathidasan Salai highway corridor. Vehicle <strong className="text-amber-400">TN 45 BB 7890</strong> was detected on CAM-09 (Toll Gate) and CAM-10 (Cantonment), missed on unmonitored node CAM-11, and re-identified on CAM-12. Intermediate trajectory is reconstructed with 87.4% confidence.
                      </p>
                    )}
                    {activeScenario === 'anpr_continuous' && (
                      <p>
                        Continuous unbroken ANPR journey tracking along Thillai Nagar Main Road. Target vehicle <strong className="text-amber-400">TN 45 T 4567</strong> is sequentially verified across CAM-13, CAM-14, CAM-15, and CAM-16 with 100% trajectory continuity.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
