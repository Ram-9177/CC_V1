import { API_URL, getAuthToken } from './config';

export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER';
export type MealChoice = 'YES' | 'SAME' | 'NO';

export interface MealMenu {
  id: string;
  date: string; // YYYY-MM-DD
  mealType: MealType;
  items: string[];
  hostelId?: string;
  createdBy?: string;
}

export interface IntentsSummary {
  BREAKFAST: { yes: number; same: number; no: number; outside: number };
  LUNCH: { yes: number; same: number; no: number; outside: number };
  DINNER: { yes: number; same: number; no: number; outside: number };
}

async function fetchJSON<T>(url: URL, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(url.toString(), {
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

export async function listMenus(dateISO: string): Promise<MealMenu[]> {
  const url = new URL('/meals/menus', API_URL);
  url.searchParams.set('date', dateISO);
  return fetchJSON<MealMenu[]>(url);
}

export async function updateMenu(menuId: string, items: string[]): Promise<MealMenu> {
  const url = new URL(`/meals/menus/${menuId}`, API_URL);
  return fetchJSON<MealMenu>(url, { method: 'PUT', body: JSON.stringify({ items }) });
}

export async function getIntentsSummary(dateISO: string): Promise<IntentsSummary> {
  const url = new URL('/meals/intents/summary', API_URL);
  url.searchParams.set('date', dateISO);
  return fetchJSON<IntentsSummary>(url);
}

export async function getMyIntents(dateISO: string): Promise<Record<MealType, MealChoice>> {
  const url = new URL('/meals/intents/my', API_URL);
  url.searchParams.set('date', dateISO);
  return fetchJSON<Record<MealType, MealChoice>>(url);
}

export async function setMyIntent(dateISO: string, mealType: MealType, choice: MealChoice) {
  const url = new URL('/meals/intents', API_URL);
  return fetchJSON(url, { method: 'POST', body: JSON.stringify({ date: dateISO, mealType, choice }) });
}
