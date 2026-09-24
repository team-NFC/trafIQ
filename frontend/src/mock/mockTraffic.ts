import { CameraFeed } from '../types/camera';
import { TrafficMetrics, ApproachDensityItem, FlowDataPoint } from '../types/traffic';

export const MOCK_CAMERA_FEEDS: CameraFeed[] = [
  {
    id: 'cam01',
    name: 'CAM 01',
    approach: 'North Approach',
    location: 'Junction Northbound (Anna Salai)',
    status: 'LIVE',
    fps: 29.8,
    resolution: '1920x1080',
    hasAmbulance: false,
    counts: {
      cars: 18,
      motorcycles: 8,
      buses: 2,
      trucks: 1,
      ambulances: 0,
      total: 29,
    },
    density: 64,
    densityState: 'MODERATE',
    queueLength: 9,
    detections: [
      { x1: 220, y1: 180, x2: 380, y2: 310, class_name: 'car', confidence: 0.92 },
      { x1: 420, y1: 210, x2: 560, y2: 340, class_name: 'car', confidence: 0.88 },
      { x1: 150, y1: 250, x2: 240, y2: 360, class_name: 'motorcycle', confidence: 0.94 },
      { x1: 590, y1: 160, x2: 780, y2: 390, class_name: 'bus', confidence: 0.95 },
    ]
  },
  {
    id: 'cam02',
    name: 'CAM 02',
    approach: 'East Approach',
    location: 'Junction Eastbound (GST Road)',
    status: 'LIVE',
    fps: 30.0,
    resolution: '1920x1080',
    hasAmbulance: false,
    counts: {
      cars: 14,
      motorcycles: 11,
      buses: 1,
      trucks: 2,
      ambulances: 0,
      total: 28,
    },
    density: 52,
    densityState: 'MODERATE',
    queueLength: 6,
    detections: [
      { x1: 180, y1: 190, x2: 340, y2: 320, class_name: 'car', confidence: 0.89 },
      { x1: 390, y1: 230, x2: 470, y2: 350, class_name: 'motorcycle', confidence: 0.91 },
      { x1: 520, y1: 170, x2: 710, y2: 370, class_name: 'truck', confidence: 0.86 },
    ]
  },
  {
    id: 'cam03',
    name: 'CAM 03',
    approach: 'South Approach',
    location: 'Junction Southbound (Poonamallee High)',
    status: 'LIVE',
    fps: 29.5,
    resolution: '1920x1080',
    hasAmbulance: true, // Emergency vehicle currently present in South approach
    counts: {
      cars: 22,
      motorcycles: 14,
      buses: 3,
      trucks: 0,
      ambulances: 1,
      total: 40,
    },
    density: 82,
    densityState: 'HIGH',
    queueLength: 14,
    detections: [
      { x1: 310, y1: 140, x2: 520, y2: 360, class_name: 'ambulance', confidence: 0.96 },
      { x1: 140, y1: 220, x2: 290, y2: 340, class_name: 'car', confidence: 0.87 },
      { x1: 550, y1: 190, x2: 730, y2: 380, class_name: 'bus', confidence: 0.93 },
    ]
  },
  {
    id: 'cam04',
    name: 'CAM 04',
    approach: 'West Approach',
    location: 'Junction Westbound (Mount Road Bypass)',
    status: 'LIVE',
    fps: 30.0,
    resolution: '1920x1080',
    hasAmbulance: false,
    counts: {
      cars: 11,
      motorcycles: 5,
      buses: 0,
      trucks: 1,
      ambulances: 0,
      total: 17,
    },
    density: 35,
    densityState: 'LOW',
    queueLength: 3,
    detections: [
      { x1: 240, y1: 210, x2: 410, y2: 340, class_name: 'car', confidence: 0.91 },
      { x1: 450, y1: 240, x2: 530, y2: 350, class_name: 'motorcycle', confidence: 0.88 },
    ]
  },
];

export const MOCK_TRAFFIC_METRICS: TrafficMetrics = {
  totalVehicles: 114,
  cars: 65,
  motorcycles: 38,
  buses: 6,
  trucks: 4,
  ambulances: 1,
  averageDensity: 58.25,
  peakQueueLength: 14,
  throughputPerHour: 1420,
  activeCamerasCount: 4,
};

export const MOCK_APPROACH_DENSITY: ApproachDensityItem[] = [
  { cameraId: 'cam01', name: 'CAM 01', approach: 'North Approach', density: 64, queueLength: 9, state: 'MODERATE' },
  { cameraId: 'cam02', name: 'CAM 02', approach: 'East Approach', density: 52, queueLength: 6, state: 'MODERATE' },
  { cameraId: 'cam03', name: 'CAM 03', approach: 'South Approach', density: 82, queueLength: 14, state: 'HIGH' },
  { cameraId: 'cam04', name: 'CAM 04', approach: 'West Approach', density: 35, queueLength: 3, state: 'LOW' },
];

export const MOCK_TRAFFIC_FLOW_TREND: FlowDataPoint[] = [
  { time: '08:00', vehicles: 45, density: 40 },
  { time: '08:15', vehicles: 68, density: 55 },
  { time: '08:30', vehicles: 89, density: 72 },
  { time: '08:45', vehicles: 104, density: 78 },
  { time: '09:00', vehicles: 122, density: 86 },
  { time: '09:15', vehicles: 114, density: 81 },
  { time: '09:30', vehicles: 98, density: 69 },
  { time: '09:45', vehicles: 85, density: 60 },
  { time: '10:00', vehicles: 76, density: 52 },
];
