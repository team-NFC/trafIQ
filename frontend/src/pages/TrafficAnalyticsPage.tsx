import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { trafficService } from '../api/traffic';
import { FlowDataPoint, ApproachDensityItem, TrafficMetrics } from '../types/traffic';
import { TrafficFlowChart } from '../components/charts/TrafficFlowChart';
import { DensityComparisonBar } from '../components/charts/DensityComparisonBar';
import { TrafficOverview } from '../components/traffic/TrafficOverview';
import { BarChart3, TrendingUp, Compass, Cpu, AlertCircle } from 'lucide-react';

export const TrafficAnalyticsPage: React.FC = () => {
  const { isDemoMode } = useApp();
  const [flowTrend, setFlowTrend] = useState<FlowDataPoint[]>([]);
  const [approaches, setApproaches] = useState<ApproachDensityItem[]>([]);
  const [metrics, setMetrics] = useState<TrafficMetrics | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const [fRes, dRes, mRes] = await Promise.all([
        trafficService.getFlowTrend(),
        trafficService.getApproachDensity(),
        trafficService.getMetrics(),
      ]);

      if (fRes.data) setFlowTrend(fRes.data);
      if (dRes.data) setApproaches(dRes.data);
      if (mRes.data) setMetrics(mRes.data);
    };

    fetchData();
  }, [isDemoMode]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-black uppercase tracking-wide text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-indigo-400" />
          <span>TRAFFIC ANALYTICS & CONGESTION METRICS</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Historical throughput, spatial queue density distribution, and approach comparisons
        </p>
      </div>

      {/* Metrics Top Breakdown */}
      {metrics && <TrafficOverview metrics={metrics} />}

      {/* Two Grid Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Flow Dynamics Over Time */}
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-cyan-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Throughput Over Time (Vehicles vs Density)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">2-HOUR WINDOW</span>
          </div>

          <TrafficFlowChart data={flowTrend} />
        </div>

        {/* Approach Congestion Comparison */}
        <div className="rounded-xl border border-slate-800 bg-[#0a0f1d] p-5 space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Cross-Approach Congestion Comparison (%)
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-500">REAL-TIME</span>
          </div>

          <DensityComparisonBar data={approaches} />
        </div>
      </div>

      {/* FUTURE INTELLIGENCE SECTION (Strictly marked as PLANNED) */}
      <div className="rounded-xl border-2 border-indigo-500/30 bg-gradient-to-r from-indigo-950/20 via-[#0a0f1d] to-purple-950/20 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-indigo-500/20 text-indigo-400">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <span>Future Intelligence Modules</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  ROADMAP / PLANNED
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Predictive and adaptive machine learning systems under active engineering
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Not currently enabled in live execution</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">XGBoost Traffic Flow Forecasting</span>
              <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase">PLANNED</span>
            </div>
            <p className="text-xs text-slate-400">
              Time-series gradient boosting model to predict intersection queue spillovers 15–30 minutes in advance using weather, calendar, and historical density inputs.
            </p>
          </div>

          <div className="p-4 rounded-lg bg-slate-900/60 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200">Reinforcement Learning Signal Optimization</span>
              <span className="text-[10px] font-mono text-indigo-400 font-semibold uppercase">PLANNED</span>
            </div>
            <p className="text-xs text-slate-400">
              Deep Q-Network (DQN) adaptive green phase duration tuner designed to replace static 25s splits with dynamic demand-proportional splits while guaranteeing maximum wait bounds.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
