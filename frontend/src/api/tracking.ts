import { apiClient, ApiResponse } from './client';
import { TrackedVehicleSummary, VehicleTrackingDetail } from '../types/tracking';

export const trackingService = {
  /**
   * Fetch active tracked vehicles across the surveillance network.
   */
  async getTrackedVehicles(): Promise<ApiResponse<TrackedVehicleSummary[]>> {
    return apiClient.get<TrackedVehicleSummary[]>('/api/tracking/vehicles');
  },

  /**
   * Search vehicle tracking by plate number, vehicle ID, camera ID, or time range.
   */
  async searchVehicleTracking(
    query: string,
    timeRange?: string
  ): Promise<ApiResponse<VehicleTrackingDetail>> {
    let endpoint = `/api/tracking/search?query=${encodeURIComponent(query)}`;
    if (timeRange) {
      endpoint += `&time_range=${encodeURIComponent(timeRange)}`;
    }
    return apiClient.get<VehicleTrackingDetail>(endpoint);
  },
};
