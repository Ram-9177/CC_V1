import { API_URL, getAuthToken } from './config';

export interface CreateSessionInput {
  title: string;
  sessionType?: string;
  scheduledAt?: string; // ISO
  mode?: 'QR' | 'MANUAL' | 'MIXED';
  totalExpected?: number;
}

export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED';

export interface AttendanceSessionDto {
  id: string;
  title: string;
  sessionType?: string | null;
  scheduledAt?: string | null;
  startedAt?: string | null;
  endedAt?: string | null;
  status: 'SCHEDULED' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  mode: 'QR' | 'MANUAL' | 'MIXED';
  totalExpected: number;
  totalPresent: number;
  totalAbsent: number;
  createdAt: string;
}

export interface AttendanceRecordDto {
  id: string;
  session: { id: string; title: string };
  student: { id: string; firstName?: string; lastName?: string; hallticket?: string };
  markedAt: string;
  status: AttendanceStatus;
  method?: 'QR' | 'MANUAL' | 'AUTO';
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
  // Some endpoints return raw text (CSV)
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('application/json')) {
    // @ts-ignore
    return res.text();
  }
  return res.json() as Promise<T>;
}

// Lightweight client cache (sessionStorage) with TTL and offline fallback + small LRU cap
const CACHE_PREFIX = 'attn:';
const CACHE_INDEX_KEY = `${CACHE_PREFIX}index`;
function cacheKey(url: string) { return CACHE_PREFIX + url; }
function readIndex(): string[] {
  try {
    const raw = sessionStorage.getItem(CACHE_INDEX_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch { return []; }
}
function writeIndex(keys: string[]) {
  try { sessionStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(keys)); } catch {}
}
function getCached<T>(url: string): T | null {
  try {
    const raw = sessionStorage.getItem(cacheKey(url));
    if (!raw) return null;
    const { t, v } = JSON.parse(raw);
    if (Date.now() > t) return null;
    return v as T;
  } catch { return null; }
}
function setCached<T>(url: string, value: T, ttlMs: number) {
  try {
    const key = cacheKey(url);
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now() + ttlMs, v: value }));
    // Update small LRU-style index (cap ~50)
    const idx = readIndex();
    const without = idx.filter((k) => k !== key);
    without.unshift(key);
    const CAP = 50;
    if (without.length > CAP) {
      const toRemove = without.splice(CAP);
      toRemove.forEach((k) => { try { sessionStorage.removeItem(k); } catch {} });
    }
    writeIndex(without);
  } catch {}
}

export async function listSessions(params?: { status?: string; date?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number; search?: string; sortBy?: 'createdAt'|'scheduledAt'|'status'|'title'; sortDir?: 'ASC'|'DESC' }): Promise<{ data: AttendanceSessionDto[]; total: number; page?: number; pageSize?: number }> {
  const url = new URL('/attendance/sessions', API_URL);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.date) url.searchParams.set('date', params.date);
  if (params?.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) url.searchParams.set('dateTo', params.dateTo);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params?.sortDir) url.searchParams.set('sortDir', params.sortDir);
  const key = url.toString();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const cached = getCached<{ data: AttendanceSessionDto[]; total: number; page?: number; pageSize?: number }>(key);
  if (offline && cached) return cached;
  try {
    const res = await fetchJSON<typeof cached>(key);
    // Cache for 30s
    if (res) setCached(key, res, 30000);
    return res as any;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

export async function createSession(input: CreateSessionInput): Promise<AttendanceSessionDto> {
  const url = new URL('/attendance/sessions', API_URL);
  return fetchJSON(url.toString(), { method: 'POST', body: JSON.stringify(input) });
}

export async function startSession(id: string): Promise<AttendanceSessionDto> {
  const url = new URL(`/attendance/sessions/${id}/start`, API_URL);
  return fetchJSON(url.toString(), { method: 'PUT' });
}

export async function endSession(id: string): Promise<any> {
  const url = new URL(`/attendance/sessions/${id}/end`, API_URL);
  return fetchJSON(url.toString(), { method: 'PUT' });
}

export async function getSession(id: string): Promise<any> {
  const url = new URL(`/attendance/sessions/${id}`, API_URL);
  return fetchJSON(url.toString());
}

export async function listSessionRecords(sessionId: string, params?: { page?: number; pageSize?: number; status?: AttendanceStatus | 'ALL'; search?: string; sortBy?: 'markedAt'|'status'|'hallticket'; sortDir?: 'ASC'|'DESC'; fromDate?: string; toDate?: string }): Promise<{ data: AttendanceRecordDto[]; total: number; page?: number; pageSize?: number }> {
  const url = new URL(`/attendance/sessions/${sessionId}/records`, API_URL);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params?.status && params.status !== 'ALL') url.searchParams.set('status', params.status);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.fromDate) url.searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) url.searchParams.set('toDate', params.toDate);
  if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params?.sortDir) url.searchParams.set('sortDir', params.sortDir);
  const key = url.toString();
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const cached = getCached<{ data: AttendanceRecordDto[]; total: number; page?: number; pageSize?: number }>(key);
  if (offline && cached) return cached;
  try {
    const res = await fetchJSON<typeof cached>(key);
    if (res) setCached(key, res, 30000);
    return res as any;
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

export async function exportSessionRecords(sessionId: string, params?: { page?: number; pageSize?: number; status?: AttendanceStatus | 'ALL'; search?: string }) {
  const token = getAuthToken();
  const url = new URL(`/attendance/sessions/${sessionId}/export`, API_URL);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  if (params?.status && params.status !== 'ALL') url.searchParams.set('status', params.status);
  if (params?.search) url.searchParams.set('search', params.search);
  const res = await fetch(url.toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function exportSessions(params?: { status?: string; date?: string; dateFrom?: string; dateTo?: string; search?: string; sortBy?: 'createdAt'|'scheduledAt'|'status'|'title'; sortDir?: 'ASC'|'DESC'; page?: number; pageSize?: number }) {
  const token = getAuthToken();
  const url = new URL('/attendance/sessions/export', API_URL);
  if (params?.status) url.searchParams.set('status', params.status);
  if (params?.date) url.searchParams.set('date', params.date);
  if (params?.dateFrom) url.searchParams.set('dateFrom', params.dateFrom);
  if (params?.dateTo) url.searchParams.set('dateTo', params.dateTo);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.sortBy) url.searchParams.set('sortBy', params.sortBy);
  if (params?.sortDir) url.searchParams.set('sortDir', params.sortDir);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function myRecords(params?: { fromDate?: string; toDate?: string }): Promise<{ data: AttendanceRecordDto[]; summary: { totalSessions: number; present: number; absent: number; attendanceRate: number } }> {
  const url = new URL('/attendance/my-records', API_URL);
  if (params?.fromDate) url.searchParams.set('fromDate', params.fromDate);
  if (params?.toDate) url.searchParams.set('toDate', params.toDate);
  return fetchJSON(url.toString());
}

export async function exportCsv(sessionId: string): Promise<string> {
  const token = getAuthToken();
  const url = new URL('/attendance/export', API_URL);
  url.searchParams.set('sessionId', sessionId);
  const res = await fetch(url.toString(), { headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export async function markAttendance(input: { sessionId: string; studentId?: string; status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; method: 'QR' | 'MANUAL' }) {
  const url = new URL('/attendance/mark', API_URL);
  return fetchJSON(url.toString(), { method: 'POST', body: JSON.stringify(input) });
}

export async function joinSession(sessionId: string) {
  const url = new URL('/attendance/join', API_URL);
  return fetchJSON(url.toString(), { method: 'POST', body: JSON.stringify({ sessionId }) });
}

export async function joinByQr(sessionId: string) {
  const url = new URL('/attendance/join-by-qr', API_URL);
  return fetchJSON(url.toString(), { method: 'POST', body: JSON.stringify({ sessionId }) });
}
