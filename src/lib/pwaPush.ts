// Minimal PWA Web Push subscription helper
// Requires VITE_VAPID_PUBLIC_KEY to be set to your Base64URL-encoded VAPID public key

import { registerDeviceToken } from './notificationsClient';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enableWebPush(): Promise<{ ok: boolean; reason?: string }>
{
  try {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return { ok: false, reason: 'unsupported' };
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return { ok: false, reason: 'denied' };

    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    if (existing) {
      // already subscribed
      await registerDeviceToken('webpush', existing.toJSON());
      return { ok: true };
    }

    const vapidPublicKey = (import.meta as any)?.env?.VITE_VAPID_PUBLIC_KEY || '';
    if (!vapidPublicKey) return { ok: false, reason: 'no_vapid_key' };

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    });
    await registerDeviceToken('webpush', sub.toJSON());
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'error' };
  }
}
