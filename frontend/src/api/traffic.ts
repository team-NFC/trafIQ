import { apiClient, ApiResponse } from './client';
import { TrafficMetrics, ApproachDensityItem, FlowDataPoint } from '../types/traffic';

export const trafficService = {
  async getMetrics(): Promise<ApiResponse<TrafficMetrics>> {
    return apiClient.get<TrafficMetrics>('/api/traffic/metrics');
  },

  async getApproachDensity(): Promise<ApiResponse<ApproachDensityItem[]>> {
    return apiClient.get<ApproachDensityItem[]>('/api/traffic/density');
  },

  async getFlowTrend(): Promise<ApiResponse<FlowDataPoint[]>> {
    return apiClient.get<FlowDataPoint[]>('/api/traffic/flow-trend');
  }
};
