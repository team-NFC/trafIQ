export type AlertSeverity = 'INFO' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface TrafficAlert {
  id: string;
  type: 'AMBULANCE' | 'CONGESTION' | 'QUEUE_BUILDUP' | 'CAMERA_OFFLINE' | 'ANPR_DETECTION' | 'DATABASE_MATCH';
  title: string;
  message: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  severity: AlertSeverity;
  reviewed?: boolean;
  metadata?: Record<string, unknown>;
}

export interface DatabaseAlertItem {
  id: string;
  case_id?: string;
  plate: string;
  canonical_plate?: string;
  vehicleClass: string;
  recordType: 'FIR / Police Alert' | 'Stolen Vehicle Registry' | 'Traffic Violation Notice' | 'Security Watchlist' | string;
  fir_number?: string;
  police_station?: string;
  case_status?: string;
  cameraId: string;
  cameraName: string;
  location: string;
  latitude?: number;
  longitude?: number;
  detectionTime: string;
  status: 'PENDING_REVIEW' | 'REVIEWED' | 'DISMISSED';
  details: string;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  evidence_image?: string;
}

export interface ANPRAuditLogItem {
  id: number;
  detection_time: string;
  camera_id: string;
  camera_name: string;
  location: string;
  plate: string;
  canonical_plate: string;
  vehicle_class?: string;
  matched: number | boolean;
  match_type: string;
  case_id?: string | null;
  fir_number?: string | null;
  confidence: number;
  speed_kmh?: number;
  status_display: string;
}

export interface FIRCaseItem {
  id: string;
  plate: string;
  canonical_plate: string;
  fir_number: string;
  police_station: string;
  ipc_sections: string;
  case_status: string;
  vehicle_class: string;
  vehicle_model: string;
  severity: string;
  investigating_officer: string;
  flagged_date: string;
  description: string;
  created_at?: string;
}

export interface AmbulanceLocationSummary {
  location: string;
  junction_id: string;
  count: number;
  active_emergency: boolean;
  last_seen: string;
}

export interface AmbulanceCrossingItem {
  id: number;
  plate: string;
  camera_id: string;
  camera_name: string;
  junction_id: string;
  location: string;
  crossing_time: string;
  direction: string;
  speed_kmh: number;
  signal_status: string;
  preemption_active: number | boolean;
}

export interface AmbulanceActivityResponse {
  status: string;
  total_ambulances_detected: number;
  locations_monitored: number;
  time_window: string;
  active_emergency_present: boolean;
  location_summary: AmbulanceLocationSummary[];
  recent_crossings: AmbulanceCrossingItem[];
}

export interface AmbulanceCheckpoint {
  step: number;
  camera_id: string;
  camera_name: string;
  location: string;
  time: string;
  lat: number;
  lng: number;
  speed_kmh: number;
  signal: string;
  status: string;
}

export interface AmbulanceJourneyResponse {
  plate: string;
  vehicle_type: string;
  callsign: string;
  hospital: string;
  origin: string;
  destination: string;
  corridor: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  cameras_count: number;
  status: string;
  mode: string;
  checkpoints: AmbulanceCheckpoint[];
  evidence_image?: string;
}

export interface AmbulanceLiveAlertResponse {
  active: boolean;
  plate: string;
  vehicle_type: string;
  camera_id: string;
  camera_name: string;
  approach: string;
  signal_status: string;
  mode: string;
  preemption_hold_sec: number;
  optical_beacon_verified: boolean;
  message: string;
  evidence_image?: string;
}

export interface LocationAmbulanceAnalysisResponse {
  junction_id: string;
  junction_name: string;
  total_ambulances_detected: number;
  number_of_crossings: number;
  time_range: string;
  cameras_involved: string[];
  current_emergency_status: string;
  historical_activity: AmbulanceCrossingItem[];
}
