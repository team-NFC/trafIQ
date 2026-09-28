export interface CameraTelemetry {
  latitude: number;
  longitude: number;
  altitudeKm: number;
  headingDeg: number;
  pitchDeg: number;
  rollDeg: number;
}

export type SensorOpticsMode = 'NORMAL' | 'CRT' | 'NVG' | 'FLIR' | 'NOIR' | 'SNOW';

export type MapBaseStyle = 'google_hybrid' | 'google_roadmap' | 'google_satellite' | 'google_terrain' | 'esri_satellite';

export interface MapLayerControls {
  satellite: boolean;
  osm: boolean;
  labels: boolean;
  buildings3D: boolean;
  cameraNodes: boolean;
  roadLinks: boolean;
  traffic: boolean;
}
