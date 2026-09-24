import { ANPRCameraSummary, VehicleJourney, PlateObservation } from '../types/anpr';

export const MOCK_ANPR_CAMERAS: ANPRCameraSummary[] = [
  {
    cameraId: 'cam01',
    name: 'CAM 01',
    location: 'North Corridor — Junction A',
    status: 'LIVE',
    vehiclesTracked: 142,
    uniquePlates: 87,
    latestPlate: 'TN45BB7890',
    latestDetectionTime: '08:00:02',
    latestConfidence: 0.942
  },
  {
    cameraId: 'cam02',
    name: 'CAM 02',
    location: 'East Highway Gate — Junction B',
    status: 'LIVE',
    vehiclesTracked: 129,
    uniquePlates: 74,
    latestPlate: 'TN45BB7890',
    latestDetectionTime: '08:05:02',
    latestConfidence: 0.915
  },
  {
    cameraId: 'cam03',
    name: 'CAM 03',
    location: 'South Arterial Expressway — Junction C',
    status: 'OFFLINE',
    vehiclesTracked: 0,
    uniquePlates: 0,
    latestPlate: 'N/A',
    latestDetectionTime: 'Offline',
    latestConfidence: 0.0
  },
  {
    cameraId: 'cam04',
    name: 'CAM 04',
    location: 'West Ring Road — Junction D',
    status: 'LIVE',
    vehiclesTracked: 96,
    uniquePlates: 61,
    latestPlate: 'TN45BB7890',
    latestDetectionTime: '08:20:02',
    latestConfidence: 0.958
  },
  {
    cameraId: 'cam05',
    name: 'CAM 05',
    location: 'City Perimeter Surveillance Point',
    status: 'LIVE',
    vehiclesTracked: 58,
    uniquePlates: 34,
    latestPlate: 'AJ08HCH',
    latestDetectionTime: '08:22:45',
    latestConfidence: 0.892
  }
];

export const MOCK_RECENT_PLATE_READS: PlateObservation[] = [
  {
    cameraId: 'cam04',
    cameraName: 'CAM 04',
    location: 'West Ring Road — Junction D',
    timestamp: '08:20:02',
    timestampSeconds: 30002,
    confidence: 0.958,
    vehicleClass: 'Car',
    isValidIndian: true,
    speedEstimateKmh: 48
  },
  {
    cameraId: 'cam02',
    cameraName: 'CAM 02',
    location: 'East Highway Gate — Junction B',
    timestamp: '08:05:02',
    timestampSeconds: 29102,
    confidence: 0.915,
    vehicleClass: 'Car',
    isValidIndian: true,
    speedEstimateKmh: 54
  },
  {
    cameraId: 'cam01',
    cameraName: 'CAM 01',
    location: 'North Corridor — Junction A',
    timestamp: '08:00:02',
    timestampSeconds: 28802,
    confidence: 0.942,
    vehicleClass: 'Car',
    isValidIndian: true,
    speedEstimateKmh: 42
  },
  {
    cameraId: 'cam05',
    cameraName: 'CAM 05',
    location: 'City Perimeter Surveillance Point',
    timestamp: '08:22:45',
    timestampSeconds: 30165,
    confidence: 0.892,
    vehicleClass: 'Car',
    isValidIndian: false,
    speedEstimateKmh: 61
  },
  {
    cameraId: 'cam01',
    cameraName: 'CAM 01',
    location: 'North Corridor — Junction A',
    timestamp: '08:23:10',
    timestampSeconds: 30190,
    confidence: 0.931,
    vehicleClass: 'Motorcycle',
    isValidIndian: true,
    speedEstimateKmh: 35
  }
];

export const MOCK_JOURNEYS: Record<string, VehicleJourney> = {
  'TN45BB7890': {
    plateNumber: 'TN45BB7890',
    vehicleClass: 'Car',
    ocrConfidence: 0.938,
    observationsCount: 3,
    firstSeen: '08:00:02',
    lastSeen: '08:20:02',
    totalDurationMinutes: 20,
    uniqueCamerasCount: 3,
    databaseMatch: {
      isMatched: true,
      recordType: 'FIR / Police Alert',
      alertDescription: 'Stored vehicle record flagged for verification (FIR Ref: CC-2026/TN04). Authorized review required.',
      reviewStatus: 'PENDING_REVIEW'
    },
    observations: [
      {
        cameraId: 'cam01',
        cameraName: 'CAM 01',
        location: 'North Corridor — Junction A',
        timestamp: '08:00:02',
        timestampSeconds: 28802,
        confidence: 0.942,
        vehicleClass: 'Car',
        isValidIndian: true,
        speedEstimateKmh: 42
      },
      {
        cameraId: 'cam02',
        cameraName: 'CAM 02',
        location: 'East Highway Gate — Junction B',
        timestamp: '08:05:02',
        timestampSeconds: 29102,
        confidence: 0.915,
        vehicleClass: 'Car',
        isValidIndian: true,
        speedEstimateKmh: 54
      },
      {
        cameraId: 'cam04',
        cameraName: 'CAM 04',
        location: 'West Ring Road — Junction D',
        timestamp: '08:20:02',
        timestampSeconds: 30002,
        confidence: 0.958,
        vehicleClass: 'Car',
        isValidIndian: true,
        speedEstimateKmh: 48
      }
    ]
  },
  'DL01AB1234': {
    plateNumber: 'DL01AB1234',
    vehicleClass: 'Truck',
    ocrConfidence: 0.892,
    observationsCount: 2,
    firstSeen: '07:45:12',
    lastSeen: '08:12:30',
    totalDurationMinutes: 27,
    uniqueCamerasCount: 2,
    databaseMatch: {
      isMatched: false,
    },
    observations: [
      {
        cameraId: 'cam02',
        cameraName: 'CAM 02',
        location: 'East Highway Gate — Junction B',
        timestamp: '07:45:12',
        timestampSeconds: 27912,
        confidence: 0.885,
        vehicleClass: 'Truck',
        isValidIndian: true,
        speedEstimateKmh: 38
      },
      {
        cameraId: 'cam04',
        cameraName: 'CAM 04',
        location: 'West Ring Road — Junction D',
        timestamp: '08:12:30',
        timestampSeconds: 29550,
        confidence: 0.899,
        vehicleClass: 'Truck',
        isValidIndian: true,
        speedEstimateKmh: 41
      }
    ]
  }
};
