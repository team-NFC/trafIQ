import { apiClient, ApiResponse } from './client';
import { TrafficAlert, DatabaseAlertItem } from '../types/alert';

export const alertService = {
  async getRecentAlerts(): Promise<ApiResponse<TrafficAlert[]>> {
    return apiClient.get<TrafficAlert[]>('/api/alerts/recent');
  },

  async getDatabaseWatchlist(): Promise<ApiResponse<DatabaseAlertItem[]>> {
    return apiClient.get<DatabaseAlertItem[]>('/api/database/watchlist');
  },

  async markAlertReviewed(alertId: string): Promise<ApiResponse<{ success: boolean }>> {
    return apiClient.post<{ success: boolean }>(`/api/database/watchlist/${alertId}/review`, {});
  }
};
