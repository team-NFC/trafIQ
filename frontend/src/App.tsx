import React from 'react';
import { useApp } from './context/AppContext';
import { Shell } from './components/layout/Shell';
import { GodViewDashboard } from './pages/GodViewDashboard';
import { OverviewPage } from './pages/OverviewPage';
import { TrafficDashboard } from './pages/TrafficDashboard';
import { TrafficAnalyticsPage } from './pages/TrafficAnalyticsPage';
import { SignalControlPage } from './pages/SignalControlPage';
import { CameraTrackingPage } from './pages/CameraTrackingPage';
import { PlateSearchPage } from './pages/PlateSearchPage';
import { DatabaseAlertsPage } from './pages/DatabaseAlertsPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const { currentPage } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      // 1. Full-Screen 3D Global Earth (Default Hero)
      case 'map':
      case 'god_view':
        return <GodViewDashboard />;

      // 2. CAMERAS (CCTV Feeds & Multi-Camera Surveillance)
      case 'cameras':
      case 'traffic_live':
      case 'traffic_cameras':
        return <TrafficDashboard />;

      // 3. TRAFFIC ANALYSIS (PCU Calculations, Density, Signal Splits)
      case 'traffic_analysis':
      case 'traffic_analytics':
        return <TrafficAnalyticsPage />;

      // 4. ANPR (Plate Reads & License Search)
      case 'anpr':
      case 'anpr_search':
        return <PlateSearchPage />;

      // 5. CAMERA TRACKING (Trajectory Tracking & Missing Node Re-ID)
      case 'camera_tracking':
      case 'anpr_tracking':
      case 'anpr_journey':
        return <CameraTrackingPage />;

      // 6. DATABASE ALERTS (Incident Audit Log & Watchlist Matches)
      case 'database_alerts':
      case 'anpr_alerts':
        return <DatabaseAlertsPage />;

      // 7. AI (Spatial Intelligence Engine Architecture)
      case 'ai':
        return <AIAssistantPage />;

      // Legacy / Additional Views
      case 'signal_control':
      case 'ambulance_priority':
        return <SignalControlPage />;
      case 'overview':
        return <OverviewPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;

      default:
        return <GodViewDashboard />;
    }
  };

  return <Shell>{renderPage()}</Shell>;
};

export default App;
