import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { ApproachDensityItem } from '../../types/traffic';

interface DensityComparisonBarProps {
  data: ApproachDensityItem[];
}

export const DensityComparisonBar: React.FC<DensityComparisonBarProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    name: d.name,
    density: d.density,
    queue: d.queueLength,
    approach: d.approach,
  }));

  const getBarColor = (val: number) => {
    if (val >= 75) return '#ef4444';
    if (val >= 45) return '#f59e0b';
    return '#10b981';
  };

  return (
    <div className="w-full h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
          <XAxis
            dataKey="name"
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
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#0a0f1d',
              borderColor: '#334155',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            formatter={(value) => [`${value}%`, 'Density']}
          />
          <Bar dataKey="density" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={getBarColor(entry.density)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
