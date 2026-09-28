/**
 * TrafficIQ - Centralized API Client
 * Connects directly to real FastAPI backend services.
 * Strictly adheres to NO FAKE DATA: returns null when endpoints are not yet connected.
 */

const isBrowser = typeof window !== 'undefined';
const isDev = isBrowser && (window.location.port === '5173' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// When running in Vite dev server, default to '' (same-origin relative URL) so requests go through the Vite proxy without cross-origin/PNA/ORB blocks!
const API_BASE_URL = import.meta.env.VITE_API_URL || (isDev ? '' : 'http://127.0.0.1:8000');

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLive: boolean;
}

class ApiClient {
  private baseUrl: string;

  constructor() {
    const saved = isBrowser ? localStorage.getItem('trafficiq_api_base') : null;
    if (saved && saved !== 'http://127.0.0.1:8000' && saved !== 'http://localhost:8000') {
      this.baseUrl = saved;
    } else {
      this.baseUrl = API_BASE_URL;
    }
  }

  public getBaseUrl(): string {
    return this.baseUrl;
  }

  public getVideoBaseUrl(): string {
    // Dedicated origin for continuous MJPEG video streams prevents HTTP/1.1 socket pool
    // starvation on the Vite dev server port 5173, keeping API requests fast and unblocked.
    if (isBrowser && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
      return `http://${window.location.hostname}:8000`;
    }
    return 'http://127.0.0.1:8000';
  }

  public setBaseUrl(url: string) {
    this.baseUrl = url;
    localStorage.setItem('trafficiq_api_base', url);
  }

  private formatError(err: unknown, defaultMsg: string): string {
    if (err instanceof Error) {
      if (err.name === 'AbortError' || err.message.toLowerCase().includes('abort')) {
        return 'Request timed out waiting for backend response. Please check that the backend server is running.';
      }
      if (err.message.toLowerCase().includes('failed to fetch')) {
        return 'Network connection error: Unable to reach TrafficIQ backend server (http://127.0.0.1:8000).';
      }
      return err.message;
    }
    return defaultMsg;
  }

  public async checkHealth(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
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

  public async get<T>(endpoint: string, timeoutMs = 25000): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      const msg = this.formatError(err, 'Backend connection failed');
      return { data: null, error: msg, isLive: false };
    }
  }

  public async post<T>(endpoint: string, body: unknown, timeoutMs = 35000): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

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
      const msg = this.formatError(err, 'Backend post request failed');
      return { data: null, error: msg, isLive: false };
    }
  }

  public async delete<T>(endpoint: string, timeoutMs = 25000): Promise<ApiResponse<T>> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'DELETE',
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
      const msg = this.formatError(err, 'Backend delete request failed');
      return { data: null, error: msg, isLive: false };
    }
  }
}

export const apiClient = new ApiClient();
