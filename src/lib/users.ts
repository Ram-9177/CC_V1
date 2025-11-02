import { API_URL, getAuthToken, hasBackend } from './config';

export interface BulkImportResult {
  imported: number;
  failed: number;
  errors: Array<{ row: number; hallticket?: string; error: string }>;
}

export async function bulkImportUsersFromCsvText(csvText: string): Promise<BulkImportResult> {
  if (!hasBackend()) {
    // Simulate importing all rows as success when offline/mock mode
    const lines = csvText.trim().split('\n');
    const count = Math.max(0, lines.length - 1);
    return { imported: count, failed: 0, errors: [] };
  }
  const token = getAuthToken();
  const form = new FormData();
  const blob = new Blob([csvText], { type: 'text/csv' });
  form.append('file', blob, 'users.csv');
  const res = await fetch(new URL('/users/bulk-import', API_URL).toString(), {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Bulk import failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function exportUsers(params?: { role?: string; search?: string }): Promise<string> {
  if (!hasBackend()) {
    return 'hallticket,firstName,lastName,role,roomNumber,hostelBlock,phoneNumber\n';
  }
  const token = getAuthToken();
  const url = new URL('/users/export', API_URL);
  if (params?.role) url.searchParams.set('role', params.role);
  if (params?.search) url.searchParams.set('search', params.search);
  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

export interface UserListItem {
  id: string;
  hallticket: string;
  firstName: string;
  lastName: string;
  role: string;
  roomNumber?: string;
  hostelBlock?: string;
  phoneNumber?: string;
  email?: string;
}

export async function listUsers(params?: { role?: string; search?: string; page?: number; pageSize?: number }): Promise<UserListItem[]> {
  if (!hasBackend()) return [];
  const token = getAuthToken();
  const url = new URL('/users', API_URL);
  if (params?.role && params.role !== 'all') url.searchParams.set('role', params.role);
  if (params?.search) url.searchParams.set('search', params.search);
  if (params?.page) url.searchParams.set('page', String(params.page));
  if (params?.pageSize) url.searchParams.set('pageSize', String(params.pageSize));
  const res = await fetch(url.toString(), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
