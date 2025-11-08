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
  const docs = await db.collection('students').find({}).toArray();
  return new Response(JSON.stringify(docs), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPost: PagesFunction = async (ctx: any) => {
  const { env, request } = ctx;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { name, roll, email } = body;
  if (!name || !roll || !email) return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 });
  // Check duplicates
  const db = await getDatabase(env as any);
  const dup = await db.collection('students').findOne({ $or: [{ roll }, { email }] });
  if (dup) return new Response(JSON.stringify({ error: 'Duplicate roll/email' }), { status: 409 });
  await db.collection('students').insertOne({ name, roll, email, room: null, createdAt: new Date().toISOString() });
  return new Response(JSON.stringify({ ok: true }), { status: 201 });
};