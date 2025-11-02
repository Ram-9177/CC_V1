import { API_URL, hasBackend } from './config';
import type { Role } from './types';

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    hallticket: string;
    role: Role;
    firstName?: string;
    lastName?: string;
    profilePhoto?: string;
  };
}

export async function login(hallticket: string, password: string): Promise<{ role: Role } | null> {
  if (!hasBackend()) return null;
  const res = await fetch(new URL('/auth/login', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hallticket, password }),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  const data = (await res.json()) as LoginResponse;
  if (!data?.accessToken) throw new Error('Invalid login response');
  localStorage.setItem('authToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('userRole', data.user.role);
  return { role: data.user.role };
}

export function logout() {
  localStorage.removeItem('authToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('userRole');
}

export async function getMe(): Promise<{ id: string; role: Role } | null> {
  if (!hasBackend()) return null;
  const token = localStorage.getItem('authToken');
  if (!token) return null;
  const res = await fetch(new URL('/auth/me', API_URL).toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  try {
    return (await res.json()) as { id: string; role: Role };
  } catch {
    return null;
  }
}

export interface RegisterInput {
  hallticket: string;
  password: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  role?: Role; // optional; backend may default to STUDENT
}

export async function register(input: RegisterInput): Promise<{ role: Role } | null> {
  if (!hasBackend()) return null;
  const res = await fetch(new URL('/auth/register', API_URL).toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Register failed (${res.status})`);
  const data = (await res.json()) as LoginResponse;
  if (!data?.accessToken) throw new Error('Invalid register response');
  localStorage.setItem('authToken', data.accessToken);
  if (data.refreshToken) localStorage.setItem('refreshToken', data.refreshToken);
  localStorage.setItem('userRole', data.user.role);
  return { role: data.user.role };
}
