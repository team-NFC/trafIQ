export interface TrafficMetrics {
  totalVehicles: number;
  cars: number;
  motorcycles: number;
  buses: number;
  trucks: number;
  ambulances: number;
  averageDensity: number;
  peakQueueLength: number;
  throughputPerHour: number;
  activeCamerasCount: number;
}

export interface ApproachDensityItem {
  cameraId: string;
  name: string;
  approach: string;
  density: number;
  queueLength: number;
  state: 'LOW' | 'MODERATE' | 'HIGH' | 'ANALYSIS PENDING';
}

export interface FlowDataPoint {
  time: string;
  vehicles: number;
  density: number;
}
