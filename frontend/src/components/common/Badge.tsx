import React from 'react';
import { AlertSeverity } from '../../types/alert';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'online' | 'offline' | 'processing' | 'priority' | 'neutral' | AlertSeverity;
  size?: 'sm' | 'md';
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md'
}) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  let colorClasses = 'bg-slate-800 text-slate-300 border-slate-700';

  switch (variant) {
    case 'online':
      colorClasses = 'bg-emerald-950/60 text-emerald-300 border-emerald-500/30';
      break;
    case 'offline':
      colorClasses = 'bg-rose-950/60 text-rose-300 border-rose-500/30';
      break;
    case 'processing':
      colorClasses = 'bg-cyan-950/60 text-cyan-300 border-cyan-500/30';
      break;
    case 'priority':
    case 'CRITICAL':
      colorClasses = 'bg-red-950/80 text-red-300 border-red-500/50 animate-pulse';
      break;
    case 'HIGH':
      colorClasses = 'bg-orange-950/60 text-orange-300 border-orange-500/40';
      break;
    case 'MEDIUM':
      colorClasses = 'bg-amber-950/60 text-amber-300 border-amber-500/30';
      break;
    case 'INFO':
      colorClasses = 'bg-blue-950/60 text-blue-300 border-blue-500/30';
      break;
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded font-semibold font-mono tracking-wide border uppercase ${sizeClasses} ${colorClasses}`}
    >
      {variant === 'online' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />}
      {variant === 'priority' && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-ping" />}
      {children}
    </span>
  );
};
