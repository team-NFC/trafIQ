import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { FlowDataPoint } from '../../types/traffic';
import { Activity } from 'lucide-react';

interface TrafficFlowChartProps {
  data?: FlowDataPoint[] | null;
}

export const TrafficFlowChart: React.FC<TrafficFlowChartProps> = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center text-center space-y-2 bg-[#060a14]/60 rounded-lg border border-slate-800/60">
        <Activity className="w-6 h-6 text-cyan-400/60 animate-pulse" />
        <span className="text-xs font-semibold text-slate-300">Waiting for traffic analysis...</span>
        <span className="text-[11px] text-slate-500">Flow trend dynamics will graph in real time once video tracking analytics are started</span>
      </div>
    );
  }

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorVehicles" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="colorDensity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.0} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="time"
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#1e293b' }}
          />
          <YAxis
            stroke="#64748b"
            fontSize={11}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0f1d',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)',
            }}
            labelStyle={{ color: '#94a3b8', fontWeight: 'bold' }}
          />
          <Area
            type="monotone"
            dataKey="vehicles"
            name="Vehicle Count"
            stroke="#06b6d4"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorVehicles)"
          />
          <Area
            type="monotone"
            dataKey="density"
            name="Congestion Density (%)"
            stroke="#8b5cf6"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorDensity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};
