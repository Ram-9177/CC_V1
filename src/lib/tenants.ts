import { API_URL, getAuthToken, hasBackend } from './config';
import type { Tenant, College } from './types';

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {} as Record<string, string>;
}

function ensureBackend() {
  if (!hasBackend()) throw new Error('Backend not configured');
}

// Tenants
export async function listTenants(): Promise<Tenant[]> {
  ensureBackend();
  const res = await fetch(new URL('/tenants', API_URL).toString(), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Failed to load tenants');
  return res.json();
}

export async function createTenant(body: Partial<Tenant>): Promise<Tenant> {
  ensureBackend();
  const res = await fetch(new URL('/tenants', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to create tenant');
  return res.json();
}

// Colleges
export async function listColleges(tenantId?: string): Promise<College[]> {
  ensureBackend();
  const url = new URL('/colleges', API_URL);
  if (tenantId) url.searchParams.set('tenantId', tenantId);
  const res = await fetch(url.toString(), { headers: { ...authHeaders() } });
  if (!res.ok) throw new Error('Failed to load colleges');
  return res.json();
}

export async function createCollege(body: { tenantId: string; code: string; name: string; address?: string }): Promise<College> {
  ensureBackend();
  const res = await fetch(new URL('/colleges', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Failed to create college');
  return res.json();
}
