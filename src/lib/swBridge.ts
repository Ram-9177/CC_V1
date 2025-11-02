// Service Worker bridge: push auth token and config (API base) to SW for background actions
import { API_URL } from './config';

function postMessageToSW(msg: any) {
  if (!('serviceWorker' in navigator)) return;
  try {
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage(msg);
    } else {
      navigator.serviceWorker.ready.then((reg) => {
        reg?.active?.postMessage?.(msg);
      }).catch(() => {});
    }
  } catch {
    // ignore
  }
}

export function syncAuthTokenToSW(token: string | null) {
  postMessageToSW({ type: 'AUTH_TOKEN', token });
}

export function syncConfigToSW() {
  // Pass API base so SW can call backend from push action handlers
  if (typeof API_URL === 'string' && API_URL.length) {
    postMessageToSW({ type: 'CONFIG', config: { apiBase: API_URL } });
  }
}

export function bootstrapSWBridge() {
  // Proactively send config on load
  syncConfigToSW();
  // Also attempt to push stored token once SW is ready
  try {
    const token = localStorage.getItem('authToken');
    if (token) syncAuthTokenToSW(token);
  } catch {}
}
