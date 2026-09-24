import React from 'react';
import { LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  message: string;
  icon?: LucideIcon;
  actionText?: string;
  onAction?: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon: Icon = Inbox,
  actionText,
  onAction
}) => {
  return (
    <div className="rounded-xl border border-dashed border-slate-800 bg-[#0a0f1d]/50 p-8 text-center flex flex-col items-center justify-center">
      <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 mb-3">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-slate-200">{title}</h4>
      <p className="text-xs text-slate-400 mt-1 max-w-sm">{message}</p>
      {actionText && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold transition"
        >
          {actionText}
        </button>
      )}
    </div>
  );
};
