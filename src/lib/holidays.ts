// Simple holiday helper for client-side guards
// NOTE: The backend should enforce holiday logic authoritatively; this is a convenience check.

// Default sample holidays; can be overridden via localStorage key 'hostel.holidays' (JSON array of YYYY-MM-DD)
export const DEFAULT_HOLIDAYS: string[] = [
  // Diwali (example) - Nov 1, 2025 used in mock data
  '2025-11-01',
];

/**
 * Returns true if the given date (or today) is a holiday based on a local list.
 * Uses localStorage override when available: key 'hostel.holidays' as a JSON array of strings (YYYY-MM-DD).
 */
export function isHoliday(d?: Date): boolean {
  try {
    const date = d || new Date();
    const iso = date.toISOString().slice(0, 10);
    let list: string[] = DEFAULT_HOLIDAYS;
    if (typeof window !== 'undefined') {
      const raw = window.localStorage.getItem('hostel.holidays');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed.filter((s) => typeof s === 'string');
        }
      }
    }
    return list.includes(iso);
  } catch {
    return false;
  }
}
