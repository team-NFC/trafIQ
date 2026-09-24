export type CameraStatus = 'LIVE' | 'ONLINE' | 'PROCESSING' | 'OFFLINE';

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  class_name: 'car' | 'motorcycle' | 'bus' | 'truck' | 'ambulance';
  confidence: number;
}

export interface CameraCounts {
  cars: number;
  motorcycles: number;
  buses: number;
  trucks: number;
  ambulances: number;
  total: number;
}

export interface CameraFeed {
  id: string;             // e.g. "01"
  name: string;           // e.g. "CAM 01"
  approach: string;       // e.g. "North Approach"
  location: string;       // e.g. "Anna Nagar 4-Way Junction"
  status: CameraStatus;
  fps: number;
  resolution: string;     // e.g. "1920x1080"
  sourceType?: string;    // e.g. "RECORDED CCTV"
  streamUrl?: string;
  hasAmbulance?: boolean;
  counts?: CameraCounts | null;
  density?: number | null;
  densityState?: 'LOW' | 'MODERATE' | 'HIGH' | 'ANALYSIS PENDING';
  queueLength?: number | null;
  detections?: BoundingBox[];
}
