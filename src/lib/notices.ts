import { API_URL, getAuthToken } from './config';

export type NoticePriority = 'LOW' | 'NORMAL' | 'HIGH';

export interface BackendNotice {
  id: string;
  title: string;
  content: string;
  priority: NoticePriority;
  roles?: string[] | null;
  hostelIds?: string[] | null;
  blockIds?: string[] | null;
  attachments?: string[] | null;
  author?: { firstName?: string; lastName?: string } | null;
  createdAt: string;
  expiresAt?: string | null;
}

export interface CreateNoticeInput {
  title: string;
  content: string;
  priority?: NoticePriority;
  roles?: string[];
  hostelIds?: string[];
  blockIds?: string[];
  attachments?: string[];
  expiresAt?: string; // ISO
}

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

export async function listMyNotices(): Promise<BackendNotice[]> {
  const url = new URL('/notices', API_URL);
  return fetchJSON<BackendNotice[]>(url.toString());
}

export async function listAllNotices(params?: { role?: string; hostelId?: string; blockId?: string; includeExpired?: boolean; q?: string; limit?: number; offset?: number }): Promise<BackendNotice[]> {
  const url = new URL('/notices/all', API_URL);
  if (params?.role) url.searchParams.set('role', params.role);
  if (params?.hostelId) url.searchParams.set('hostelId', params.hostelId);
  if (params?.blockId) url.searchParams.set('blockId', params.blockId);
  if (params?.includeExpired) url.searchParams.set('includeExpired', String(params.includeExpired));
  if (params?.q) url.searchParams.set('q', params.q);
  if (typeof params?.limit === 'number') url.searchParams.set('limit', String(params.limit));
  if (typeof params?.offset === 'number') url.searchParams.set('offset', String(params.offset));
  return fetchJSON<BackendNotice[]>(url.toString());
}

export async function createNotice(input: CreateNoticeInput): Promise<BackendNotice> {
  const url = new URL('/notices', API_URL);
  return fetchJSON<BackendNotice>(url.toString(), { method: 'POST', body: JSON.stringify(input) });
}

export async function updateNotice(id: string, patch: Partial<CreateNoticeInput>): Promise<BackendNotice> {
  const url = new URL(`/notices/${id}`, API_URL);
  return fetchJSON<BackendNotice>(url.toString(), { method: 'PUT', body: JSON.stringify(patch) });
}

export async function deleteNotice(id: string): Promise<{ affected: number }> {
  const token = getAuthToken();
  const url = new URL(`/notices/${id}`, API_URL);
  const res = await fetch(url.toString(), { method: 'DELETE', headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markAllRead(): Promise<{ updated: number }> {
  const token = getAuthToken();
  const url = new URL('/notices/mark-all-read', API_URL);
  const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markRead(id: string): Promise<{ updated: number }> {
  const token = getAuthToken();
  const url = new URL(`/notices/${id}/mark-read`, API_URL);
  const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function markUnread(id: string): Promise<{ updated: number }> {
  const token = getAuthToken();
  const url = new URL(`/notices/${id}/mark-unread`, API_URL);
  const res = await fetch(url.toString(), { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getUnreadCount(): Promise<{ count: number }> {
  const token = getAuthToken();
  const url = new URL('/notices/unread-count', API_URL);
  const res = await fetch(url.toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
