import React, { useState } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface ShellProps {
  children: React.ReactNode;
}

export const Shell: React.FC<ShellProps> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 flex flex-col">
      <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed(!collapsed)} />

      <div
        className={`flex-1 flex flex-col transition-all duration-300 ${
          collapsed ? 'pl-18' : 'pl-64'
        }`}
      >
        <Header />
        <main className="flex-1 p-6 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
