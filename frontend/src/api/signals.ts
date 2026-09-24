import { apiClient, ApiResponse } from './client';
import { SignalState, SignalMode } from '../types/signal';

export const signalService = {
  async getSignalState(_modeOverride?: SignalMode): Promise<ApiResponse<SignalState>> {
    return apiClient.get<SignalState>('/api/signals');
  },

  async setSignalMode(mode: SignalMode): Promise<ApiResponse<{ success: boolean; mode: SignalMode }>> {
    return apiClient.post<{ success: boolean; mode: SignalMode }>('/api/signals/mode', { mode });
  }
};
