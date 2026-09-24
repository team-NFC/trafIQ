/**
 * TrafficIQ - Centralized API Client
 * Connects directly to real FastAPI backend services.
 * Strictly adheres to NO FAKE DATA: returns null when endpoints are not yet connected.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLive: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    this.baseUrl = localStorage.getItem('trafficiq_api_base') || API_BASE_URL;
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('trafficiq_api_base', url);
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${this.baseUrl}/api/health`, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        return json.status === 'ok';
      }
      return false;
    } catch {
      return false;
    }
  }

  public async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return { data: json, error: null, isLive: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend connection failed';
      return { data: null, error: msg, isLive: false };
    }
  }

  public async post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const json = await response.json();
      return { data: json, error: null, isLive: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Backend post request failed';
      return { data: null, error: msg, isLive: false };
    }
  }
}

export const apiClient = new ApiClient();
