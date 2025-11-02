import { API_URL, getAuthToken } from './config';

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

  const token = getAuthToken();
  const url = new URL('/meals/intents/export', API_URL);
  url.searchParams.set('date', dateISO);

  const res = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      Accept: 'text/csv',
    },
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const blob = await res.blob();
  triggerDownload(blob, `meals-summary-${dateISO}.csv`);
  return { ok: true } as const;
}
