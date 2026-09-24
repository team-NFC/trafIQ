import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number | null | undefined;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  color?: 'cyan' | 'emerald' | 'amber' | 'purple' | 'rose' | 'blue';
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive,
  color = 'cyan'
}) => {
  const colorMap = {
    cyan: 'from-cyan-500/10 to-blue-500/5 text-cyan-400 border-cyan-500/20 shadow-cyan-950/20',
    emerald: 'from-emerald-500/10 to-teal-500/5 text-emerald-400 border-emerald-500/20 shadow-emerald-950/20',
    amber: 'from-amber-500/10 to-orange-500/5 text-amber-400 border-amber-500/20 shadow-amber-950/20',
    purple: 'from-purple-500/10 to-indigo-500/5 text-purple-400 border-purple-500/20 shadow-purple-950/20',
    rose: 'from-rose-500/10 to-red-500/5 text-rose-400 border-rose-500/20 shadow-rose-950/20',
    blue: 'from-blue-500/10 to-sky-500/5 text-blue-400 border-blue-500/20 shadow-blue-950/20',
  };

  const iconBgMap = {
    cyan: 'bg-cyan-500/20 text-cyan-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    amber: 'bg-amber-500/20 text-amber-300',
    purple: 'bg-purple-500/20 text-purple-300',
    rose: 'bg-rose-500/20 text-rose-300',
    blue: 'bg-blue-500/20 text-blue-300',
  };

  const displayValue = value !== null && value !== undefined && value !== '' ? value : '--';

  return (
    <div
      className={`rounded-xl p-4.5 bg-gradient-to-br ${colorMap[color]} bg-[#0c1222] border shadow-lg backdrop-blur flex flex-col justify-between transition-all hover:border-slate-700`}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <div className="mt-1.5 text-2xl font-extrabold font-mono text-white tracking-tight">
            {displayValue}
          </div>
        </div>
        <div className={`p-2.5 rounded-lg ${iconBgMap[color]} shrink-0 shadow-inner`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
          {subtitle && <span className="text-slate-400">{subtitle}</span>}
          {trend && (
            <span
              className={`font-mono font-medium ${
                trendPositive ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {trend}
            </span>
          )}
        </div>
      )}
    </div>
  );
};
