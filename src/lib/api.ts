// Unified thin client-side API wrapper for Cloudflare Pages Functions.
// All DB logic lives in /functions/api/* (server edge). This file only performs fetch calls.

export interface LoginResponse { token: string }

function authHeaders(token?: string) {
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  } as const;
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`Login failed: ${res.status}`);
  return res.json();
}

export async function listStudents(token: string) {
  const res = await fetch('/api/students', { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`List students failed: ${res.status}`);
  return res.json();
}

export async function createStudent(token: string, data: { name: string; roll: string; email: string }) {
  const res = await fetch('/api/students', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`Create student failed: ${res.status}`);
  return res.json();
}

export async function getStudent(token: string, id: string) {
  const res = await fetch(`/api/students/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Get student failed: ${res.status}`);
  return res.json();
}

export async function updateStudent(token: string, id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/students/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update student failed: ${res.status}`);
  return res.json();
}

export async function deleteStudent(token: string, id: string) {
  const res = await fetch(`/api/students/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete student failed: ${res.status}`);
  return res.json();
}

export async function listRooms(token: string) {
  const res = await fetch('/api/rooms', { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`List rooms failed: ${res.status}`);
  return res.json();
}

export async function createRoom(token: string, data: { number: string; capacity?: number }) {
  const res = await fetch('/api/rooms', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...data, capacity: data.capacity ?? 1 }),
  });
  if (!res.ok) throw new Error(`Create room failed: ${res.status}`);
  return res.json();
}

export async function getRoom(token: string, id: string) {
  const res = await fetch(`/api/rooms/${id}`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error(`Get room failed: ${res.status}`);
  return res.json();
}

export async function updateRoom(token: string, id: string, patch: Record<string, unknown>) {
  const res = await fetch(`/api/rooms/${id}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(`Update room failed: ${res.status}`);
  return res.json();
}

export async function deleteRoom(token: string, id: string) {
  const res = await fetch(`/api/rooms/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error(`Delete room failed: ${res.status}`);
  return res.json();
}

// Meals summary CSV export (legacy endpoint support). Keeps client decoupled from DB.
function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportMealsSummaryCSV(date: Date) {
  const dateISO = date.toISOString().split('T')[0];
  const res = await fetch(`/api/meals/intents/export?date=${encodeURIComponent(dateISO)}`, {
    method: 'GET',
    headers: { Accept: 'text/csv' },
  });
  if (!res.ok) throw new Error(`Export meals summary failed: ${res.status}`);
  const blob = await res.blob();
  triggerDownload(blob, `meals-summary-${dateISO}.csv`);
  return { ok: true } as const;
}
