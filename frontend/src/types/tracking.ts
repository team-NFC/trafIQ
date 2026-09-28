export interface TrackedVehicleSummary {
  plate: string;
  vehicle_id: string;
  vehicle_class: string;
  corridor: string;
  camera_path: string[];
  path_display: string;
  start_time: string;
  end_time: string;
  duration_minutes: number;
  status: string;
  status_label: string;
  has_missing_node: boolean;
  missing_camera?: string | null;
  confirmed_cameras: number;
  total_cameras: number;
  scenario: string;
}

export interface CameraSequenceStep {
  step: number;
  camera_id: string;
  camera_name: string;
  location: string;
  time: string;
  timestamp_seconds: number;
  travel_time_from_prev?: string;
  lat: number;
  lng: number;
  status: 'CONFIRMED' | 'MISSING' | string;
  status_display: string;
  is_missing: boolean;
  confidence: number;
  direction: string;
  speed_kmh: number;
  pcu: number;
  evidence_image?: string | null;
  note?: string;
}

export interface RouteSegmentItem {
  from: string;
  to: string;
  type: 'solid' | 'dashed';
  status: string;
  color?: string;
}

export interface PlausibleRouteItem {
  route_id: string;
  name: string;
  confidence: number;
  confidence_pct: string;
  estimated_duration: string;
  distance_km: number;
  is_primary: boolean;
  description: string;
  coordinates: [number, number][];
}

export interface VehicleTrackingDetail {
  status: 'found' | 'not_found';
  plate: string;
  canonical_plate?: string;
  vehicle_id: string;
  vehicle_class: string;
  corridor_name: string;
  location_context: string;
  start_time: string;
  end_time: string;
  total_duration: string;
  total_duration_minutes: number;
  has_missing_node: boolean;
  missing_camera?: string | null;
  interpolation_confidence: number;
  interpolation_confidence_pct: string;
  camera_sequence: CameraSequenceStep[];
  route_segments: RouteSegmentItem[];
  plausible_routes: PlausibleRouteItem[];
  scenario?: string;
  message?: string;
}
