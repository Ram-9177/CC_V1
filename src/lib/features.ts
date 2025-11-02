import { API_URL, getAuthToken, hasBackend } from './config';
import type { FeatureFlag, FeatureScope } from './types';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
}

function ensureBackend() {
  if (!hasBackend()) throw new Error('Backend not configured');
}

export async function listFeatures(scope: FeatureScope, scopeId: string): Promise<FeatureFlag[]> {
  ensureBackend();
  const url = new URL('/features', API_URL);
  url.searchParams.set('scope', scope);
  url.searchParams.set('scopeId', scopeId);
  const res = await fetch(url.toString(), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Failed to load features');
  return res.json();
}

export async function upsertFeature(params: { scope: FeatureScope; scopeId: string; key: string; enabled: boolean; config?: any }): Promise<FeatureFlag> {
  ensureBackend();
  const res = await fetch(new URL('/features/upsert', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Failed to upsert feature');
  return res.json();
}

export async function deleteFeature(id: string): Promise<{ ok: true }> {
  ensureBackend();
  const res = await fetch(new URL(`/features/${id}`, API_URL).toString(), {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error('Failed to delete feature');
  return res.json();
}
