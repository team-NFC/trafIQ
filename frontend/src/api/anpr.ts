import { apiClient, ApiResponse } from './client';
import { ANPRCameraSummary, VehicleJourney, PlateObservation } from '../types/anpr';

export interface CityWideCorrelationSummary {
  uniqueVehiclesCount: number;
  multiCameraTripsCount: number;
  singleCameraObservationsCount: number;
  activeANPRCameras: number;
}

export const anprService = {
  async getANPRCameras(): Promise<ApiResponse<ANPRCameraSummary[]>> {
    return apiClient.get<ANPRCameraSummary[]>('/api/anpr/cameras');
  },

  async getRecentPlateReads(): Promise<ApiResponse<PlateObservation[]>> {
    return apiClient.get<PlateObservation[]>('/api/anpr/recent-reads');
  },

  async searchPlate(plateNumber: string): Promise<ApiResponse<VehicleJourney | null>> {
    const cleanPlate = plateNumber.trim().toUpperCase().replace(/[\s-]/g, '');
    return apiClient.get<VehicleJourney | null>(
      `/api/anpr/search?plate=${encodeURIComponent(cleanPlate)}`
    );
  },

  async getCityWideSummary(): Promise<ApiResponse<CityWideCorrelationSummary>> {
    return apiClient.get<CityWideCorrelationSummary>('/api/anpr/correlation/summary');
  }
};
