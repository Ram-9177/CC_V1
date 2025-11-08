import { verifyToken } from '../../_utils/jwt';
import { getDatabase } from '../../_utils/mongodb';
type PagesFunction = any;

export const onRequestGet: PagesFunction = async (ctx: any) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const db = await getDatabase(env as any);
  const docs = await db.collection('rooms').find({}).toArray();
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPost: PagesFunction = async (ctx: any) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { number, capacity } = body;
  if (!number) return new Response(JSON.stringify({ error: 'Missing room number' }), { status: 400 });
  const db = await getDatabase(env as any);
  const dup = await db.collection('rooms').findOne({ number });
  if (dup) return new Response(JSON.stringify({ error: 'Duplicate room number' }), { status: 409 });
  await db.collection('rooms').insertOne({ number, capacity: capacity ? Number(capacity) : 1, occupants: [] });
  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};