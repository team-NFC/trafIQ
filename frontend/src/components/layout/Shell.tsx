import React from 'react';
import { Header } from './Header';
import { HangingCCTVWidget } from './HangingCCTVWidget';
import { useApp } from '../../context/AppContext';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const { currentPage } = useApp();
  const isMap = currentPage === 'map' || currentPage === 'god_view';

  return (
    <div className="min-h-screen bg-[#07090e] text-slate-100 flex flex-col font-sans antialiased overflow-hidden select-none">
      {/* 1. Minimal Top Navigation */}
      <Header />

      {/* 2. Movable Ceiling-Track Hanging CCTV AI Shortcut */}
      <HangingCCTVWidget />

      {/* 3. Main Content Viewport (Sidebar Removed - Full-Screen Primary Canvas) */}
      <main className={`flex-1 relative w-full ${isMap ? 'overflow-hidden p-0' : 'overflow-y-auto p-6 bg-[#090b10]'}`}>
        {children}
      </main>
    </div>
  );
};
