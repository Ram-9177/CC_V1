import { API_URL, getAuthToken } from './config';
import type { GatePass } from './types';
import QRCode from 'qrcode';

async function fetchJSON<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(input.toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getGatePass(id: string): Promise<GatePass | null> {
  const url = new URL(`/gate-passes/${id}`, API_URL);
  const raw = await fetchJSON<any>(url.toString());
  if (!raw) return null;
  // Defensive mapping to UI shape, tolerating backend field differences
  const studentFirst = raw.student?.firstName || raw.student?.name?.split(' ')?.[0] || '';
  const studentLast = raw.student?.lastName || (raw.student?.name?.split(' ') || []).slice(1).join(' ') || '';
  const mapped: GatePass = {
    id: String(raw.id ?? id),
    hallticket: raw.student?.hallticket || raw.hallticket || '',
    studentName: (raw.studentName || `${studentFirst} ${studentLast}`.trim()).trim(),
    studentId: raw.student?.id || raw.studentId || '',
    reason: raw.reason || raw.purpose || '',
    destination: raw.destination || raw.place || '',
    departureTime: raw.departureTime || raw.departAt || raw.createdAt || new Date().toISOString(),
    expectedReturn: raw.expectedReturn || raw.returnBy || raw.departureTime || new Date().toISOString(),
    state: (raw.state || raw.status || 'SUBMITTED'),
    isEmergency: !!raw.isEmergency,
    approvedBy: raw.approvedBy?.name || raw.approvedBy || undefined,
    approvedAt: raw.approvedAt || undefined,
    rejectionReason: raw.rejectionReason || raw.rejectReason || undefined,
    lastActivityAt: raw.updatedAt || raw.lastActivityAt || raw.createdAt || new Date().toISOString(),
    createdAt: raw.createdAt || new Date().toISOString(),
    qrToken: raw.qrCode ? 'server' : undefined,
    adUnlocked: !!raw.adWatchedAt || raw.qrVisible === true,
    hostelId: raw.hostelId || raw.hostel?.id || '',
    hostelName: raw.hostelName || raw.hostel?.name || '',
  };
  return mapped;
}

export async function watchAd(id: string, watchedSeconds = 20): Promise<{ ok: true } | { ok: false; status: number; message?: string }> {
  const token = getAuthToken();
  const url = new URL(`/gate-passes/${id}/watch-ad`, API_URL);
  const res = await fetch(url.toString(), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ watchedDuration: watchedSeconds, completedAt: new Date().toISOString() }),
  });
  if (!res.ok) {
    return { ok: false, status: res.status, message: await res.text().catch(() => undefined) } as const;
  }
  return { ok: true } as const;
}

export async function fetchGatePassQRDataUrl(id: string, fallbackToken?: string): Promise<string> {

  const token = getAuthToken();
  const url = new URL(`/gate-passes/${id}/qr`, API_URL);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'image/png, image/svg+xml, application/json, text/plain',
    },
  });

  // Try a few content types gracefully
  const contentType = res.headers.get('content-type') || '';

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Failed to fetch QR (${res.status}): ${text}`);
  }

  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => ({}));
    if (typeof data.qrDataUrl === 'string') return data.qrDataUrl;
    if (typeof data.qr === 'string') return QRCode.toDataURL(data.qr, { width: 400 });
    if (typeof data.qrCode === 'string') return QRCode.toDataURL(data.qrCode, { width: 400 });
  }

  if (contentType.includes('text/plain')) {
    const text = await res.text();
    return QRCode.toDataURL(text, { width: 400 });
  }

  // Assume image blob (png/svg)
  const blob = await res.blob();
  // Convert to data URL
  const reader = new FileReader();
  const dataUrlPromise = new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
  });
  reader.readAsDataURL(blob);
  return dataUrlPromise;
}

export async function listMyGatePasses(): Promise<GatePass[]> {
  const url = new URL('/gate-passes/my', API_URL);
  const arr = await fetchJSON<any[]>(url.toString());
  return arr.map((raw) => ({
    id: String(raw.id),
    hallticket: raw.student?.hallticket || raw.hallticket || '',
    studentName: raw.studentName || [raw.student?.firstName, raw.student?.lastName].filter(Boolean).join(' '),
    studentId: raw.student?.id || raw.studentId || '',
    reason: raw.reason || '',
    destination: raw.destination || '',
    departureTime: raw.departureTime || raw.createdAt || new Date().toISOString(),
    expectedReturn: raw.expectedReturn || raw.departureTime || new Date().toISOString(),
    state: raw.state || raw.status || 'SUBMITTED',
    isEmergency: !!raw.isEmergency,
    approvedBy: raw.approvedBy?.name || raw.approvedBy || undefined,
    approvedAt: raw.approvedAt || undefined,
    rejectionReason: raw.rejectionReason || undefined,
    lastActivityAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    createdAt: raw.createdAt || new Date().toISOString(),
    qrToken: raw.qrCode ? 'server' : undefined,
    adUnlocked: !!raw.adWatchedAt || raw.qrVisible === true,
    hostelId: raw.hostelId || raw.hostel?.id || '',
    hostelName: raw.hostelName || raw.hostel?.name || '',
  }));
}

export async function listGatePasses(params?: { state?: string; page?: number; pageSize?: number }): Promise<GatePass[]> {
  const url = new URL('/gate-passes', API_URL);
  if (params?.state) url.searchParams.set('state', params.state);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  const arr = await fetchJSON<any[]>(url.toString());
  return arr.map((raw) => ({
    id: String(raw.id),
    hallticket: raw.student?.hallticket || raw.hallticket || '',
    studentName: raw.studentName || [raw.student?.firstName, raw.student?.lastName].filter(Boolean).join(' '),
    studentId: raw.student?.id || raw.studentId || '',
    reason: raw.reason || '',
    destination: raw.destination || '',
    departureTime: raw.departureTime || raw.createdAt || new Date().toISOString(),
    expectedReturn: raw.expectedReturn || raw.departureTime || new Date().toISOString(),
    state: raw.state || raw.status || 'SUBMITTED',
    isEmergency: !!raw.isEmergency,
    approvedBy: raw.approvedBy?.name || raw.approvedBy || undefined,
    approvedAt: raw.approvedAt || undefined,
    rejectionReason: raw.rejectionReason || undefined,
    lastActivityAt: raw.updatedAt || raw.createdAt || new Date().toISOString(),
    createdAt: raw.createdAt || new Date().toISOString(),
    qrToken: raw.qrCode ? 'server' : undefined,
    adUnlocked: !!raw.adWatchedAt || raw.qrVisible === true,
    hostelId: raw.hostelId || raw.hostel?.id || '',
    hostelName: raw.hostelName || raw.hostel?.name || '',
  }));
}

export async function approveGatePass(id: string) {
  const url = new URL(`/gate-passes/${id}/approve`, API_URL);
  return fetchJSON(url.toString(), { method: 'PUT' });
}

export async function rejectGatePass(id: string, reason: string) {
  const url = new URL(`/gate-passes/${id}/reject`, API_URL);
  return fetchJSON(url.toString(), { method: 'PUT', body: JSON.stringify({ reason }) });
}

export async function createGatePass(input: {
  reason: string;
  destination: string;
  departureTime: string; // ISO
  expectedReturn: string; // ISO
  type?: string;
  priority?: 'NORMAL' | 'EMERGENCY';
  contactPerson?: string;
  contactPhone?: string;
  notes?: string;
}): Promise<{ id: string }> {
  const url = new URL('/gate-passes', API_URL);
  return fetchJSON(url.toString(), { method: 'POST', body: JSON.stringify(input) });
}
