// Centralized config for API and WebSocket endpoints
// Uses Vite env variables when available, with sane defaults for local dev

export const API_URL = (import.meta as any)?.env?.VITE_API_URL || '';
export const WS_URL = (import.meta as any)?.env?.VITE_WS_URL || '';
export const ANDROID_APK_URL = (import.meta as any)?.env?.VITE_ANDROID_APK_URL || '';
export const ANDROID_TWA_URL = (import.meta as any)?.env?.VITE_ANDROID_TWA_URL || '';

// Retrieve auth token if/when backend auth is wired.
// For now, this returns null (mock-only). Store token in localStorage as 'authToken' when backend integration is ready.
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem('authToken');
  } catch {
    return null;
  }
}

export function hasBackend(): boolean {
  return typeof API_URL === 'string' && API_URL.length > 0;
}
