import { API_URL, hasBackend, getAuthToken } from './config';

export interface SearchLiteItem {
  id: string;
  hallticket: string;
  firstName: string;
  lastName: string;
  role: string;
  roomNumber?: string;
  hostelBlock?: string;
  phoneNumber?: string;
}

export async function searchUsersLite(query: string, limit = 10): Promise<SearchLiteItem[]> {
  if (!hasBackend()) return [];
  const token = getAuthToken();
  const url = new URL('/users/search', API_URL);
  url.searchParams.set('query', query);
  url.searchParams.set('limit', String(limit));
  const res = await fetch(url.toString(), {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
