export interface CameraPreset {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  altitudeMeters: number;
  headingDeg: number;
  pitchDeg: number;
  description: string;
}

export const MAP_CONFIG = {
  // Google Maps Official Tile Layers (Real Google Maps Satellite / Hybrid / Roadmap - NO WATERMARK)
  googleHybridUrl: 'https://mt{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  googleRoadmapUrl: 'https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
  googleSatelliteUrl: 'https://mt{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
  googleTerrainUrl: 'https://mt{s}.google.com/vt/lyrs=p&x={x}&y={y}&z={z}',
  googleTrafficUrl: 'https://mt{s}.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}',

  // High-resolution Esri Satellite imagery & clean official reference layers (NO WATERMARK)
  esriSatelliteUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  esriLabelsUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
  esriTransportationUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
  osmTilesUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  osmTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  
  defaultCenter: {
    lat: 10.7905,
    lon: 78.7047,
    altMeters: 14000.0,
    heading: 25,
    pitch: -55
  },

  // Cesium ion token
  cesiumIonToken: (import.meta as any).env?.VITE_CESIUM_ION_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjRONjFBVzQ0YkhTWlQ2SXoiLCJqdGkiOiI3NGE0ZTZlYy1iNTU5LTQ5ZjMtYTA3YS1kOTkyYWVkMGIzZTEiLCJpZCI6NDk5NjAxLCJpc3MiOiJodHRwczovL2FwaS5jZXNpdW0uY29tIiwiYXVkIjoidW5kZWZpbmVkX2RlZmF1bHQiLCJpYXQiOjE3ODk3MDc5NjZ9.Heq-pd6vB3pl1nTzo3_c_YX-XMvWBCNFcLNNz8REmnU',

  // Presets matching multi-scale zoom flow
  presets: [
    {
      id: 'orbit',
      name: 'SPACE ORBIT',
      latitude: 22.0,
      longitude: 78.0,
      altitudeMeters: 16000000.0,
      headingDeg: 0,
      pitchDeg: -90,
      description: 'Global Planetary View'
    },
    {
      id: 'india',
      name: 'INDIA REGION',
      latitude: 20.5937,
      longitude: 78.9629,
      altitudeMeters: 2400000.0,
      headingDeg: 0,
      pitchDeg: -80,
      description: 'Subcontinent Regional View'
    },
    {
      id: 'tamil_nadu',
      name: 'TAMIL NADU',
      latitude: 11.1271,
      longitude: 78.6569,
      altitudeMeters: 450000.0,
      headingDeg: 0,
      pitchDeg: -70,
      description: 'State Level Surveillance'
    },
    {
      id: 'trichy_city',
      name: 'TRICHY (CITY)',
      latitude: 10.7905,
      longitude: 78.7047,
      altitudeMeters: 16000.0,
      headingDeg: 25,
      pitchDeg: -55,
      description: 'Tiruchirappalli Urban Area'
    }
  ] as CameraPreset[]
};
