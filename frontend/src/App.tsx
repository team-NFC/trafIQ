import React from 'react';
import { useApp } from './context/AppContext';
import { Shell } from './components/layout/Shell';
import { OverviewPage } from './pages/OverviewPage';
import { TrafficDashboard } from './pages/TrafficDashboard';
import { SignalControlPage } from './pages/SignalControlPage';
import { TrafficAnalyticsPage } from './pages/TrafficAnalyticsPage';
import { ANPRDashboard } from './pages/ANPRDashboard';
import { PlateSearchPage } from './pages/PlateSearchPage';
import { DatabaseAlertsPage } from './pages/DatabaseAlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

export const App: React.FC = () => {
  const { currentPage } = useApp();

  const renderPage = () => {
    switch (currentPage) {
      case 'overview':
        return <OverviewPage />;
      case 'traffic_live':
      case 'traffic_cameras':
        return <TrafficDashboard />;
      case 'traffic_analytics':
        return <TrafficAnalyticsPage />;
      case 'signal_control':
      case 'ambulance_priority':
        return <SignalControlPage />;
      case 'anpr_tracking':
        return <ANPRDashboard />;
      case 'anpr_search':
      case 'anpr_journey':
        return <PlateSearchPage />;
      case 'anpr_alerts':
        return <DatabaseAlertsPage />;
      case 'reports':
        return <ReportsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <TrafficDashboard />;
    }
  };

  return <Shell>{renderPage()}</Shell>;
};

export default App;
