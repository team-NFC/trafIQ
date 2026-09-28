export interface PlateObservation {
  cameraId: string;
  cameraName: string;
  location: string;
  timestamp: string;          // Real clock time "08:00:02"
  timestampSeconds: number;
  confidence: number;
  vehicleClass: string;
  isValidIndian: boolean;
  frameIndex?: number;
  speedEstimateKmh?: number;
  plateNumber?: string;
  canonicalPlate?: string;
  isDatabaseMatch?: boolean;
  caseNumber?: string;
  status?: string;
  ownerName?: string;
  statusDisplay?: string;
}

export interface VehicleJourney {
  plateNumber: string;
  vehicleClass: string;
  ocrConfidence: number;
  observationsCount: number;
  firstSeen: string;
  lastSeen: string;
  totalDurationMinutes: number;
  uniqueCamerasCount: number;
  observations: PlateObservation[];
  databaseMatch?: {
    isMatched: boolean;
    recordType?: string;
    alertDescription?: string;
    reviewStatus?: 'PENDING_REVIEW' | 'REVIEWED' | 'DISMISSED';
  };
}

export interface ANPRCameraSummary {
  cameraId: string;
  name: string;
  location: string;
  status: 'LIVE' | 'PROCESSING' | 'OFFLINE';
  vehiclesTracked: number;
  uniquePlates: number;
  latestPlate: string;
  latestDetectionTime: string;
  latestConfidence: number;
}
