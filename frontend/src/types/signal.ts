export type SignalColor = 'GREEN' | 'YELLOW' | 'RED';
export type SignalMode = 'NORMAL' | 'AMBULANCE_PRIORITY' | 'MANUAL';

export interface ApproachSignal {
  cameraId: string;
  name: string;
  approach: string;
  state: SignalColor;
  isPriority: boolean;
}

export interface SignalState {
  mode: SignalMode;
  currentGreenCam: string;    // e.g. "CAM 01"
  currentYellowCam?: string;
  redCameras: string[];       // e.g. ["CAM 02", "CAM 03", "CAM 04"]
  currentPhaseIndex: number;  // 0 -> CAM 01, 1 -> CAM 02, etc.
  remainingSeconds: number;
  totalCycleSeconds: number;
  approaches: ApproachSignal[];
  emergencyEvent?: {
    active: boolean;
    cameraId: string;
    approach: string;
    confidence: number;
    detectedAt: string;
    clearanceSeconds: number;
  };
}
