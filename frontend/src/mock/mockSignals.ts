import { SignalState } from '../types/signal';

export const MOCK_SIGNAL_NORMAL: SignalState = {
  mode: 'NORMAL',
  currentGreenCam: 'CAM 01',
  currentYellowCam: undefined,
  redCameras: ['CAM 02', 'CAM 03', 'CAM 04'],
  currentPhaseIndex: 0,
  remainingSeconds: 18,
  totalCycleSeconds: 120,
  approaches: [
    { cameraId: 'cam01', name: 'CAM 01', approach: 'North Approach', state: 'GREEN', isPriority: false },
    { cameraId: 'cam02', name: 'CAM 02', approach: 'East Approach', state: 'RED', isPriority: false },
    { cameraId: 'cam03', name: 'CAM 03', approach: 'South Approach', state: 'RED', isPriority: false },
    { cameraId: 'cam04', name: 'CAM 04', approach: 'West Approach', state: 'RED', isPriority: false },
  ]
};

export const MOCK_SIGNAL_AMBULANCE: SignalState = {
  mode: 'AMBULANCE_PRIORITY',
  currentGreenCam: 'CAM 03',
  currentYellowCam: undefined,
  redCameras: ['CAM 01', 'CAM 02', 'CAM 04'],
  currentPhaseIndex: 2,
  remainingSeconds: 24,
  totalCycleSeconds: 45,
  approaches: [
    { cameraId: 'cam01', name: 'CAM 01', approach: 'North Approach', state: 'RED', isPriority: false },
    { cameraId: 'cam02', name: 'CAM 02', approach: 'East Approach', state: 'RED', isPriority: false },
    { cameraId: 'cam03', name: 'CAM 03', approach: 'South Approach', state: 'GREEN', isPriority: true },
    { cameraId: 'cam04', name: 'CAM 04', approach: 'West Approach', state: 'RED', isPriority: false },
  ],
  emergencyEvent: {
    active: true,
    cameraId: 'cam03',
    approach: 'South Approach',
    confidence: 0.96,
    detectedAt: '09:14:22',
    clearanceSeconds: 24
  }
};
