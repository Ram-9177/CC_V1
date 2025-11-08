import { verifyToken } from '../../_utils/jwt';
import { dataApi } from '../../_utils/dataApi';

export const onRequestGet: PagesFunction = async (ctx) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const result = await dataApi(env, 'find', { collection: 'rooms', filter: {} });
  return new Response(JSON.stringify(result.documents || []), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { number, capacity } = body;
  if (!number) return new Response(JSON.stringify({ error: 'Missing room number' }), { status: 400 });
  const dup = await dataApi(env, 'find', { collection: 'rooms', filter: { number }, limit: 1 });
  if (dup.documents?.length) return new Response(JSON.stringify({ error: 'Duplicate room number' }), { status: 409 });
  await dataApi(env, 'insertOne', { collection: 'rooms', document: { number, capacity: capacity ? Number(capacity) : 1, occupants: [] } });
  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};