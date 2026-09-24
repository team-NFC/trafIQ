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
  plate: string;
  vehicleClass: string;
  recordType: 'FIR / Police Alert' | 'Stolen Vehicle Registry' | 'Traffic Violation Notice' | 'Security Watchlist';
  cameraId: string;
  cameraName: string;
  location: string;
  detectionTime: string;
  status: 'PENDING_REVIEW' | 'REVIEWED' | 'DISMISSED';
  details: string;
}
