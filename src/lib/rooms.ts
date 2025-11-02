import { API_URL, getAuthToken } from './config';

export interface Room {
  id: string;
  block: string;
  number: string;
  floor?: string;
  capacity: number;
  occupants?: number;
}

export interface RoomWithOccupants extends Room {
  occupants: number;
}

export async function listRooms(params?: { block?: string; search?: string }): Promise<RoomWithOccupants[]> {
  const token = getAuthToken();
  const url = new URL('/rooms', API_URL);
  if (params?.block) url.searchParams.set('block', params.block);
  if (params?.search) url.searchParams.set('search', params.search);
  const res = await fetch(url.toString(), {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function upsertRoom(input: { block: string; number: string; floor?: string; capacity?: number }): Promise<Room> {
  const token = getAuthToken();
  const res = await fetch(new URL('/rooms/upsert', API_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function assignUserToRoom(roomId: string, hallticket: string, bedLabel?: string): Promise<{ userId: string; roomId: string; bedLabel?: string }> {
  const token = getAuthToken();
  const res = await fetch(new URL(`/rooms/${roomId}/assign`, API_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ hallticket, bedLabel }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function unassignUserFromRoom(roomId: string, hallticket: string): Promise<{ userId: string; roomId: null }> {
  const token = getAuthToken();
  const res = await fetch(new URL(`/rooms/${roomId}/unassign`, API_URL).toString(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ hallticket }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function bulkAssignRoomsFromCsvText(csvText: string): Promise<{ assigned: number; failed: number; errors: any[] }> {
  const token = getAuthToken();
  const form = new FormData();
  const blob = new Blob([csvText], { type: 'text/csv' });
  form.append('file', blob, 'room-assignments.csv');
  const res = await fetch(new URL('/rooms/bulk-assign', API_URL).toString(), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function exportRoomOccupantsCsv(roomId: string): Promise<Blob> {
  const token = getAuthToken();
  const res = await fetch(new URL(`/rooms/${roomId}/occupants/export`, API_URL).toString(), {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'text/csv' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export async function exportAllRoomsCsv(): Promise<Blob> {
  const token = getAuthToken();
  const res = await fetch(new URL('/rooms/export', API_URL).toString(), {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'text/csv' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}

export async function exportAllOccupantsCsv(): Promise<Blob> {
  const token = getAuthToken();
  const res = await fetch(new URL('/rooms/occupants/export', API_URL).toString(), {
    method: 'GET',
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), Accept: 'text/csv' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
}
