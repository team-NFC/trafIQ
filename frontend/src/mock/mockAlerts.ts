import { TrafficAlert, DatabaseAlertItem } from '../types/alert';

export const MOCK_TRAFFIC_ALERTS: TrafficAlert[] = [
  {
    id: 'alt-001',
    type: 'AMBULANCE',
    title: 'Ambulance Detected',
    message: 'Emergency vehicle detected approaching South Lane (CAM 03). Safe priority preemption initiated.',
    cameraId: 'cam03',
    cameraName: 'CAM 03 (South)',
    timestamp: 'Just now',
    severity: 'CRITICAL',
    reviewed: false
  },
  {
    id: 'alt-002',
    type: 'DATABASE_MATCH',
    title: 'Database Watchlist Match',
    message: 'Plate TN45BB7890 matches stored FIR / Police Alert database record. Operator review required.',
    cameraId: 'cam04',
    cameraName: 'CAM 04 (West)',
    timestamp: '3m ago',
    severity: 'HIGH',
    reviewed: false
  },
  {
    id: 'alt-003',
    type: 'CONGESTION',
    title: 'High Traffic Density',
    message: 'South approach congestion density reached 82%. Queue spillover risk.',
    cameraId: 'cam03',
    cameraName: 'CAM 03 (South)',
    timestamp: '7m ago',
    severity: 'MEDIUM',
    reviewed: true
  },
  {
    id: 'alt-004',
    type: 'CAMERA_OFFLINE',
    title: 'Camera Stream Offline',
    message: 'CAM 03 video source stream offline or missing file on disk.',
    cameraId: 'cam03',
    cameraName: 'CAM 03 (ANPR)',
    timestamp: '15m ago',
    severity: 'INFO',
    reviewed: true
  },
];

export const MOCK_DATABASE_WATCHLIST: DatabaseAlertItem[] = [
  {
    id: 'fir-2026-001',
    plate: 'TN45BB7890',
    vehicleClass: 'Car',
    recordType: 'FIR / Police Alert',
    cameraId: 'cam04',
    cameraName: 'CAM 04',
    location: 'West Ring Road — Junction D',
    detectionTime: '08:20:02',
    status: 'PENDING_REVIEW',
    details: 'Flagged under Section 379 IPC (Vehicle Investigation Notice). Review observation log.'
  },
  {
    id: 'fir-2026-002',
    plate: 'KA03HA4521',
    vehicleClass: 'Motorcycle',
    recordType: 'Traffic Violation Notice',
    cameraId: 'cam01',
    cameraName: 'CAM 01',
    location: 'North Corridor — Junction A',
    detectionTime: '07:15:30',
    status: 'REVIEWED',
    details: 'Unpaid automated e-challan repeat notice. Sent to municipal transport registry.'
  },
  {
    id: 'fir-2026-003',
    plate: 'MH02CL9988',
    vehicleClass: 'Truck',
    recordType: 'Stolen Vehicle Registry',
    cameraId: 'cam02',
    cameraName: 'CAM 02',
    location: 'East Highway Gate — Junction B',
    detectionTime: 'Yesterday 22:40',
    status: 'REVIEWED',
    details: 'Inter-state commercial vehicle stolen report #MH-8819. Dispatched to highway patrol.'
  }
];
