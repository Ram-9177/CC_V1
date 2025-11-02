// Android push helper using Capacitor Push Notifications
// Works only on native Android (Capacitor). On web, returns a friendly reason.

import { Capacitor } from '@capacitor/core';
import { PushNotifications, Token } from '@capacitor/push-notifications';
import { registerDeviceToken } from './notificationsClient';

export async function enableAndroidPush(): Promise<{ ok: boolean; reason?: string }>
{
  try {
    if (!Capacitor.isNativePlatform()) return { ok: false, reason: 'not_native' };
    if (Capacitor.getPlatform() !== 'android') return { ok: false, reason: 'not_android' };

    // Request permissions (Android will typically grant; still follow API)
    const perm = await PushNotifications.requestPermissions();
    if (perm.receive !== 'granted') return { ok: false, reason: 'denied' };

    // Register to get a token
    await PushNotifications.register();

    const token = await new Promise<string>((resolve, reject) => {
      const onRegister = (t: Token) => {
        try { resolve(t.value); } catch (e) { reject(e); }
        PushNotifications.removeAllListeners();
      };
      const onError = (err: any) => {
        reject(err);
        PushNotifications.removeAllListeners();
      };
      PushNotifications.addListener('registration', onRegister);
      PushNotifications.addListener('registrationError', onError);
      // Fallback timeout
      setTimeout(() => onError(new Error('timeout')), 10000);
    });

    await registerDeviceToken('android', token);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'error' };
  }
}

export function isAndroidNative(): boolean {
  try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android'; } catch { return false; }
}
