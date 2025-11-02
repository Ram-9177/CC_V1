import { API_URL, getAuthToken, hasBackend } from './config';
import { isHoliday } from './holidays';

export type DevicePlatform = 'android' | 'ios' | 'webpush' | 'web';

function ensureBackend() {
  if (!hasBackend()) {
    throw new Error('Backend not configured. Set VITE_API_URL and VITE_WS_URL.');
  }
}

export async function listMyTokens() {
  ensureBackend();
  const token = getAuthToken();
  const res = await fetch(new URL('/notifications/tokens', API_URL).toString(), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function registerDeviceToken(platform: DevicePlatform, tokenOrSubscription: string | any) {
  ensureBackend();
  const token = getAuthToken();
  const body: any = { platform };
  if (platform === 'webpush') {
    body.token = typeof tokenOrSubscription === 'string' ? tokenOrSubscription : JSON.stringify(tokenOrSubscription);
  } else {
    body.token = String(tokenOrSubscription);
  }
  const res = await fetch(new URL('/notifications/register-token', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteDeviceToken(id: string) {
  ensureBackend();
  const token = getAuthToken();
  const res = await fetch(new URL(`/notifications/token/${id}`, API_URL).toString(), {
    method: 'DELETE',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export type BroadcastFilters = {
  // When true, students currently marked OUTSIDE via gate pass are excluded
  excludeOutpass?: boolean;
  // When true, backend may skip sends on configured holidays for the given date
  skipIfHoliday?: boolean;
  // ISO date (YYYY-MM-DD) for context (e.g., which day's meal)
  date?: string;
  // Optional tag to indicate meal type or topic for backend logic
  mealType?: string;
};

export async function broadcastNotification(input: {
  role?: string;
  hostelId?: string;
  title: string;
  body?: string;
  url?: string;
  filters?: BroadcastFilters;
}) {
  ensureBackend();
  const token = getAuthToken();
  const res = await fetch(new URL('/notifications/broadcast', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/**
 * Convenience: Send a daily meal reminder push to students, excluding those on outpass and skipping holidays.
 * Returns `{ skipped: 'holiday' }` if today is a holiday (client-side quick guard), otherwise returns backend result.
 */
export async function sendMealReminder(params: {
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER' | string;
  hostelId?: string;
  date?: string; // ISO yyyy-mm-dd; defaults to today
  title?: string;
  body?: string;
}) {
  ensureBackend();
  const { mealType, hostelId } = params;
  const date = params.date || new Date().toISOString().slice(0, 10);

  // Client-side guard to avoid accidental sends on holidays
  try {
    if (isHoliday(new Date(date))) {
      return { skipped: 'holiday' } as const;
    }
  } catch {}

  const title = params.title || `Meal reminder: ${mealType}`;
  const body = params.body || `Please set your ${mealType.toLowerCase()} preference. Students on outpass are auto-excluded.`;

  return broadcastNotification({
    role: 'STUDENT',
    hostelId,
    title,
    body,
    url: '/student/meals',
    filters: {
      excludeOutpass: true,
      skipIfHoliday: true,
      date,
      mealType,
    },
  });
}
