import { apiClient, ApiResponse } from './client';
import { CameraFeed } from '../types/camera';

interface BackendCameraStatus {
  name?: string;
  approach?: string;
  status: 'online' | 'offline';
  source?: string;
  type?: string;
  resolution?: string;
  fps?: number;
}

export const cameraService = {
  async getTrafficCameras(): Promise<ApiResponse<CameraFeed[]>> {
    const res = await apiClient.get<Record<string, BackendCameraStatus>>('/api/cameras/status');

    if (res.data) {
      const feeds: CameraFeed[] = Object.entries(res.data).map(([key, info]) => {
        const camNum = key.replace('camera_', '');
        return {
          id: camNum,
          name: info.name || `CAM ${camNum}`,
          approach: info.approach || `Approach ${camNum}`,
          location: 'Anna Nagar 4-Way Junction',
          status: info.status === 'online' ? 'ONLINE' : 'OFFLINE',
          fps: info.fps || 24,
          resolution: info.resolution || '1920x1080',
          sourceType: 'RECORDED CCTV',
          streamUrl: `${apiClient.getVideoBaseUrl()}/api/video/camera/${camNum}`,
          hasAmbulance: false,
          counts: null,
          density: null,
          densityState: 'ANALYSIS PENDING',
          queueLength: null,
        };
      });

      return { data: feeds, error: null, isLive: true };
    }

    // If backend is unavailable or not responding, mark cameras as OFFLINE
    const offlineFallback: CameraFeed[] = [
      {
        id: '01',
        name: 'CAM 01',
        approach: 'North Approach',
        location: 'Anna Nagar 4-Way Junction',
        status: 'OFFLINE',
        fps: 0,
        resolution: 'N/A',
        sourceType: 'RECORDED CCTV',
        streamUrl: '',
        hasAmbulance: false,
        counts: null,
        density: null,
        densityState: 'ANALYSIS PENDING',
        queueLength: null,
      },
      {
        id: '02',
        name: 'CAM 02',
        approach: 'East Approach',
        location: 'Anna Nagar 4-Way Junction',
        status: 'OFFLINE',
        fps: 0,
        resolution: 'N/A',
        sourceType: 'RECORDED CCTV',
        streamUrl: '',
        hasAmbulance: false,
        counts: null,
        density: null,
        densityState: 'ANALYSIS PENDING',
        queueLength: null,
      },
      {
        id: '03',
        name: 'CAM 03',
        approach: 'South Approach',
        location: 'Anna Nagar 4-Way Junction',
        status: 'OFFLINE',
        fps: 0,
        resolution: 'N/A',
        sourceType: 'RECORDED CCTV',
        streamUrl: '',
        hasAmbulance: false,
        counts: null,
        density: null,
        densityState: 'ANALYSIS PENDING',
        queueLength: null,
      },
      {
        id: '04',
        name: 'CAM 04',
        approach: 'West Approach',
        location: 'Anna Nagar 4-Way Junction',
        status: 'OFFLINE',
        fps: 0,
        resolution: 'N/A',
        sourceType: 'RECORDED CCTV',
        streamUrl: '',
        hasAmbulance: false,
        counts: null,
        density: null,
        densityState: 'ANALYSIS PENDING',
        queueLength: null,
      },
    ];

    return { data: offlineFallback, error: res.error, isLive: false };
  },

  async getCameraById(id: string): Promise<ApiResponse<CameraFeed | null>> {
    const listRes = await this.getTrafficCameras();
    const found = listRes.data?.find(c => c.id === id || c.name.toLowerCase().includes(id.toLowerCase())) || null;
    return { data: found, error: listRes.error, isLive: listRes.isLive };
  },

  getVideoStreamUrl(cameraId: string): string {
    const cleanId = cameraId.replace('cam', '').replace('camera_', '').trim();
    return `${apiClient.getBaseUrl()}/api/video/camera/${cleanId}`;
  }
};
