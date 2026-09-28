import { apiClient, ApiResponse } from './client';

export interface GodViewNode {
  id: string;
  name: string;
  approach: string;
  zone: 'NORMAL' | 'AMBULANCE' | 'ANPR_MISSING' | 'ANPR_CONTINUOUS';
  x: number;
  y: number;
  lat: number;
  lon: number;
  status: string;
  signal: 'GREEN' | 'YELLOW' | 'RED' | 'TRANSIT' | 'UNMONITORED';
  timer?: number;
  count: number;
  plate?: string;
  is_ambulance?: boolean;
  is_missing?: boolean;
  has_database_alert?: boolean;
  database_alert?: {
    id: string;
    case_id?: string;
    plate: string;
    fir_number: string;
    case_status: string;
    status: string;
    evidence_image?: string;
  };
}

export interface GodViewLink {
  from: string;
  to: string;
  type: 'crossroad' | 'arterial' | 'solid' | 'dashed';
  name: string;
}

export interface GodViewData {
  status: string;
  city: string;
  active_scenario: string;
  nodes: GodViewNode[];
  links: GodViewLink[];
  emergency_alert: {
    active: boolean;
    approach: string;
    camera: string;
    vehicle: string;
    mode: string;
    status: string;
  };
  missing_node_alert: {
    active: boolean;
    missing_camera: string;
    vehicle: string;
    status: string;
  };
}

export interface ScenarioItem {
  id: string;
  name: string;
  description: string;
  cameras: string[];
  active: boolean;
}

export interface ScenariosResponse {
  active_scenario: string;
  scenarios: ScenarioItem[];
}

export interface ApproachAnalytics {
  name: string;
  camera: string;
  cars: number;
  motorcycles: number;
  auto_rickshaws: number;
  buses: number;
  trucks: number;
  ambulances: number;
  total_vehicles: number;
  pcu_demand: number;
  adaptive_green_seconds: number;
  status: string;
}

export interface TrafficAnalyticsResponse {
  status: string;
  scenario: string;
  intersection: string;
  authoritative_count_pipeline: string;
  discrepancy_explanation: string;
  totals: {
    total_vehicles: number;
    cars: number;
    motorcycles: number;
    auto_rickshaws: number;
    buses: number;
    trucks: number;
    ambulances: number;
    total_pcu_demand: number;
  };
  approaches: Record<string, ApproachAnalytics>;
  base_cycle_time: number;
}

export interface TrajectoryNode {
  camera_id: string;
  name: string;
  time: string;
  status: string;
  is_missing: boolean;
  confidence: number;
  frame?: number;
  is_estimated?: boolean;
}

export interface PathSegment {
  from: string;
  to: string;
  type: 'solid' | 'dashed';
  status: string;
}

export interface TrajectoryScenario {
  scenario_name: string;
  vehicle: string;
  canonical_plate: string;
  vehicle_class: string;
  overall_status: string;
  interpolation_confidence: number;
  confidence_display: string;
  explanation: string;
  observed_nodes: TrajectoryNode[];
  path_segments: PathSegment[];
  evidence_image?: string;
  last_known_camera?: string;
  next_known_camera?: string;
  missing_camera?: string;
}

export interface TrajectoriesResponse {
  status: string;
  active_scenario: string;
  scenarios: {
    missing_node: TrajectoryScenario;
    continuous: TrajectoryScenario;
  };
}

export interface IncidentItem {
  id: string;
  type: string;
  title: string;
  camera: string;
  timestamp: string;
  vehicle: string;
  plate: string;
  confidence: number;
  status: string;
  evidence_url: string;
  description: string;
}

export interface IncidentsResponse {
  status: string;
  incidents: IncidentItem[];
}

export interface WeatherData {
  location: string;
  temperature: number;
  feels_like: number;
  humidity: number;
  condition: string;
  description: string;
  wind_speed_kmh: number;
  is_live: boolean;
  fallback?: boolean;
}

export interface PredictionData {
  model: string;
  forecast_horizon_minutes: number;
  overall_trend: string;
  trend_pct: string;
  predicted_pcu_total: number;
  approach_forecast: Record<string, {
    current_pcu: number;
    predicted_pcu: number;
    delta: string;
  }>;
  recommended_adjustment: string;
  confidence: number;
}

export interface AmbulanceStateResponse {
  status: string;
  ambulance_detected: boolean;
  priority_active: boolean;
  camera: string | null;
  approach: string | null;
  plate_number?: string;
  vehicle_class?: string;
  confidence?: number;
  mode: string;
  status_display?: string;
  phase: string;
  message: string;
  evidence_image?: string;
}

export interface CameraItem {
  id: string;
  name: string;
  type?: 'normal' | 'junction_camera';
  latitude: number;
  longitude: number;
  location?: string;
  junction_id?: string | null;
  direction?: string;
  camera_type?: string;
  video_source?: string;
  status: string;
  description?: string;
  zone?: string;
  count: number;
  queue: number;
  pcu?: number;
  signal: string;
  timer?: number;
  signal_color?: string;
  is_active?: boolean;
  plate?: string;
  is_ambulance?: number | boolean;
  is_missing?: number | boolean;
  has_database_alert?: boolean;
  database_alert?: {
    id: string;
    case_id?: string;
    plate: string;
    fir_number: string;
    case_status: string;
    status: string;
    evidence_image?: string;
  };
}

export interface CameraResultsResponse {
  status: string;
  camera_id: string;
  message?: string;
  vehicle_count: number;
  queue_count: number;
  pcu: number;
  density: 'LOW' | 'MODERATE' | 'HIGH' | 'UNKNOWN';
  vehicle_breakdown: {
    car?: number;
    motorcycle?: number;
    bus?: number;
    truck?: number;
    ambulance?: number;
    auto_rickshaw?: number;
  };
  anpr_results: Array<{
    vehicle_id: number;
    vehicle_class: string;
    plate_number: string;
    normalized_plate: string;
    confidence: number;
    speed_kmh?: number;
    timestamp?: string;
  }>;
  primary_plate?: string;
  signal_control?: {
    signal: string;
    signal_color: string;
    timer?: number;
    is_active?: boolean;
    junction_id?: string;
    current_phase?: string;
    active_camera_id?: string;
    green_time?: number;
    yellow_time?: number;
    all_red_time?: number;
  } | null;
  fps?: number;
  total_frames?: number;
  processed_at?: string;
}

export interface JunctionItem {
  id: string;
  name: string;
  type?: string;
  latitude: number;
  longitude: number;
  location?: string;
  signal_type?: string;
  description?: string;
  connected_camera_ids: string[];
  cameras_summary?: any[];
  camera_count: number;
  combined_count: number;
  combined_queue: number;
  combined_pcu: number;
}

export interface SignalControlTelemetry {
  current_signal: string;
  current_phase: string;
  active_camera_id?: string | null;
  next_camera_id?: string | null;
  green_time: number;
  yellow_time: number;
  all_red_time: number;
  remaining_time: number;
  traffic_demand: number;
  queue: number;
  pcu: number;
  adaptive_state: string;
  evp_active: boolean;
}

export interface JunctionDetailResponse {
  status: string;
  junction: {
    id: string;
    name: string;
    type?: string;
    latitude: number;
    longitude: number;
    location?: string;
    signal_type?: string;
    description?: string;
  };
  cameras: CameraItem[];
  connected_camera_ids: string[];
  combined_count: number;
  combined_queue: number;
  combined_pcu: number;
  signal_state: string;
  signal_control?: SignalControlTelemetry;
  ambulance_status: {
    active: boolean;
    approach: string | null;
    vehicle_plate: string | null;
    mode: string;
  };
}

export interface CreateCameraPayload {
  id: string;
  name: string;
  type?: 'normal' | 'junction_camera';
  latitude: number;
  longitude: number;
  location?: string;
  junction_id?: string;
  direction?: string;
  camera_type?: string;
  video_source?: string;
  status?: string;
  description?: string;
}

export interface CreateJunctionPayload {
  id?: string;
  name: string;
  type?: string;
  latitude: number;
  longitude: number;
  location?: string;
  signal_type?: string;
  description?: string;
  cameras?: CreateCameraPayload[];
}

export const godViewService = {
  getGodView(): Promise<ApiResponse<GodViewData>> {
    return apiClient.get<GodViewData>('/api/godview');
  },

  getCameras(): Promise<ApiResponse<{ status: string; count: number; cameras: CameraItem[] }>> {
    return apiClient.get<{ status: string; count: number; cameras: CameraItem[] }>('/api/cameras');
  },

  addCamera(payload: CreateCameraPayload): Promise<ApiResponse<{ status: string; camera: CameraItem; message: string }>> {
    return apiClient.post<{ status: string; camera: CameraItem; message: string }>('/api/cameras', payload);
  },

  deleteCamera(cameraId: string): Promise<ApiResponse<{ status: string; message: string }>> {
    return apiClient.delete<{ status: string; message: string }>(`/api/cameras/${cameraId}`);
  },

  getJunctions(): Promise<ApiResponse<{ status: string; count: number; junctions: JunctionItem[] }>> {
    return apiClient.get<{ status: string; count: number; junctions: JunctionItem[] }>('/api/junctions');
  },

  getJunctionDetail(junctionId: string): Promise<ApiResponse<JunctionDetailResponse>> {
    return apiClient.get<JunctionDetailResponse>(`/api/junctions/${junctionId}`);
  },

  addJunction(payload: CreateJunctionPayload): Promise<ApiResponse<{ status: string; junction: JunctionItem; message: string }>> {
    return apiClient.post<{ status: string; junction: JunctionItem; message: string }>('/api/junctions', payload);
  },

  deleteJunction(junctionId: string): Promise<ApiResponse<{ status: string; message: string }>> {
    return apiClient.delete<{ status: string; message: string }>(`/api/junctions/${junctionId}`);
  },

  getScenarios(): Promise<ApiResponse<ScenariosResponse>> {
    return apiClient.get<ScenariosResponse>('/api/scenarios');
  },

  selectScenario(scenario: string): Promise<ApiResponse<{ status: string; active_scenario: string }>> {
    return apiClient.post<{ status: string; active_scenario: string }>(`/api/scenarios/select?scenario=${scenario}`, {});
  },

  getAnalytics(): Promise<ApiResponse<TrafficAnalyticsResponse>> {
    return apiClient.get<TrafficAnalyticsResponse>('/api/analytics');
  },

  getTrajectories(): Promise<ApiResponse<TrajectoriesResponse>> {
    return apiClient.get<TrajectoriesResponse>('/api/anpr/trajectories');
  },

  getIncidents(): Promise<ApiResponse<IncidentsResponse>> {
    return apiClient.get<IncidentsResponse>('/api/incidents');
  },

  getWeather(): Promise<ApiResponse<WeatherData>> {
    return apiClient.get<WeatherData>('/api/weather');
  },

  getPrediction(): Promise<ApiResponse<PredictionData>> {
    return apiClient.get<PredictionData>('/api/prediction');
  },

  getAmbulanceState(): Promise<ApiResponse<AmbulanceStateResponse>> {
    return apiClient.get<AmbulanceStateResponse>('/api/ambulance');
  },

  getCameraResults(cameraId: string): Promise<ApiResponse<CameraResultsResponse>> {
    return apiClient.get<CameraResultsResponse>(`/api/cameras/${cameraId}/results`);
  },
};
