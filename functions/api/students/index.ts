import { verifyToken } from '../../_utils/jwt';
import { dataApi } from '../../_utils/dataApi';

export const onRequestGet: PagesFunction = async (ctx) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const result = await dataApi(env, 'find', { collection: 'students', filter: {} });
  return new Response(JSON.stringify(result.documents || []), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPost: PagesFunction = async (ctx) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { name, roll, email } = body;
  if (!name || !roll || !email) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  // Check duplicates
  const dupCheck = await dataApi(env, 'find', { collection: 'students', filter: { $or: [{ roll }, { email }] }, limit: 1 });
  if (dupCheck.documents?.length) return new Response(JSON.stringify({ error: 'Duplicate roll/email' }), { status: 409 });
  await dataApi(env, 'insertOne', { collection: 'students', document: { name, roll, email, room: null, createdAt: new Date().toISOString() } });
  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};