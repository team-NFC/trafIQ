import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SignalMode } from '../types/signal';

export type PageId =
  | 'map'
  | 'cameras'
  | 'traffic_analysis'
  | 'anpr'
  | 'camera_tracking'
  | 'database_alerts'
  | 'ai'
  // Legacy aliases
  | 'god_view'
  | 'overview'
  | 'traffic_live'
  | 'traffic_cameras'
  | 'traffic_analytics'
  | 'signal_control'
  | 'ambulance_priority'
  | 'anpr_tracking'
  | 'anpr_search'
  | 'anpr_journey'
  | 'anpr_alerts'
  | 'reports'
  | 'settings';

interface AppContextType {
  currentPage: PageId;
  setCurrentPage: (page: PageId) => void;
  isDemoMode: boolean;
  setDemoMode: (val: boolean) => void;
  selectedCameraId: string | null;
  setSelectedCameraId: (id: string | null) => void;
  selectedJunctionId: string | null;
  setSelectedJunctionId: (id: string | null) => void;
  searchedPlate: string;
  setSearchedPlate: (plate: string) => void;
  signalMode: SignalMode;
  setSignalMode: (mode: SignalMode) => void;
  systemTime: string;
  systemDate: string;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentPage, setCurrentPage] = useState<PageId>('map');
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [selectedJunctionId, setSelectedJunctionId] = useState<string | null>('JUNC-01');
  const [searchedPlate, setSearchedPlate] = useState<string>('TN45BB7890');
  const [signalMode, setSignalMode] = useState<SignalMode>('NORMAL');

  const [systemTime, setSystemTime] = useState<string>('');
  const [systemDate, setSystemDate] = useState<string>('');

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setSystemTime(now.toLocaleTimeString('en-US', { hour12: false }));
      setSystemDate(now.toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }));
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <AppContext.Provider
      value={{
        currentPage,
        setCurrentPage,
        isDemoMode: false,
        setDemoMode: () => {},
        selectedCameraId,
        setSelectedCameraId,
        selectedJunctionId,
        setSelectedJunctionId,
        searchedPlate,
        setSearchedPlate,
        signalMode,
        setSignalMode,
        systemTime,
        systemDate
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return ctx;
};
