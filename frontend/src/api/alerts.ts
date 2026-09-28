import { apiClient, ApiResponse } from './client';
import {
  TrafficAlert,
  DatabaseAlertItem,
  ANPRAuditLogItem,
  FIRCaseItem,
  AmbulanceActivityResponse,
  AmbulanceJourneyResponse,
  AmbulanceLiveAlertResponse,
  LocationAmbulanceAnalysisResponse
} from '../types/alert';

export const alertService = {
  // 1. Database Alerts / Watchlist Matches
  async getRecentAlerts(): Promise<ApiResponse<TrafficAlert[]>> {
    return apiClient.get<TrafficAlert[]>('/api/alerts/recent');
  },

  async getDatabaseWatchlist(status?: string): Promise<ApiResponse<DatabaseAlertItem[]>> {
    const query = status && status !== 'ALL' ? `?status=${encodeURIComponent(status)}` : '';
    return apiClient.get<DatabaseAlertItem[]>(`/api/database/alerts${query}`);
  },

  async markAlertReviewed(
    alertId: string,
    action: 'REVIEWED' | 'DISMISSED' = 'REVIEWED',
    notes: string = 'Officer verified and resolved',
    badge: string = 'TN-4521'
  ): Promise<ApiResponse<{ status: string; alert_id: string; new_status: string }>> {
    return apiClient.post<{ status: string; alert_id: string; new_status: string }>(
      `/api/database/alerts/${encodeURIComponent(alertId)}/review`,
      {
        action,
        notes,
        officer_badge: badge,
        officer_name: 'Insp. R. Sundaram'
      }
    );
  },

  // 2. Matching Verification Flow
  async verifyPlate(plate: string): Promise<ApiResponse<{
    matched: boolean;
    plate: string;
    canonical_plate: string;
    status: string;
    message?: string;
    case?: FIRCaseItem;
    alert?: DatabaseAlertItem;
  }>> {
    return apiClient.post('/api/database/verify', { plate });
  },

  // 3. Chronological Audit Log
  async getAuditLogs(filter?: string): Promise<ApiResponse<ANPRAuditLogItem[]>> {
    const query = filter && filter !== 'ALL' ? `?filter=${encodeURIComponent(filter)}` : '';
    return apiClient.get<ANPRAuditLogItem[]>(`/api/database/audit-log${query}`);
  },

  // 4. Authorized FIR Cases
  async getFIRCases(): Promise<ApiResponse<FIRCaseItem[]>> {
    return apiClient.get<FIRCaseItem[]>('/api/database/cases');
  },

  // 5. Ambulance Activity & Real Detections
  async getAmbulanceActivity(): Promise<ApiResponse<AmbulanceActivityResponse>> {
    return apiClient.get<AmbulanceActivityResponse>('/api/ambulance/activity');
  },

  // 6. Ambulance Confirmed Journey
  async getAmbulanceJourney(): Promise<ApiResponse<AmbulanceJourneyResponse>> {
    return apiClient.get<AmbulanceJourneyResponse>('/api/ambulance/journey');
  },

  // 7. Live Emergency Preemption Status
  async getAmbulanceLiveAlert(): Promise<ApiResponse<AmbulanceLiveAlertResponse>> {
    return apiClient.get<AmbulanceLiveAlertResponse>('/api/ambulance/live-alert');
  },

  // 8. Location-Based Ambulance Corridor Diagnostics
  async getLocationAmbulanceAnalysis(junctionId?: string): Promise<ApiResponse<LocationAmbulanceAnalysisResponse>> {
    const path = junctionId && junctionId !== 'ALL'
      ? `/api/ambulance/location/${encodeURIComponent(junctionId)}`
      : '/api/ambulance/locations';
    return apiClient.get<LocationAmbulanceAnalysisResponse>(path);
  }
};
