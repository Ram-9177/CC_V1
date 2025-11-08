import { verifyToken } from '../../_utils/jwt';
import { getDatabase, ObjectId } from '../../_utils/mongodb';
type PagesFunction = any;

export const onRequestGet: PagesFunction = async (ctx: any) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const { id } = params;
  const db = await getDatabase(env as any);
  const doc = await db.collection('rooms').findOne({ _id: new ObjectId(id) });
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  return new Response(JSON.stringify(doc), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPut: PagesFunction = async (ctx: any) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { id } = params;
  const db = await getDatabase(env as any);
  await db.collection('rooms').updateOne({ _id: new ObjectId(id) }, { $set: body });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestDelete: PagesFunction = async (ctx: any) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const { id } = params;
  const db = await getDatabase(env as any);
  await db.collection('rooms').deleteOne({ _id: new ObjectId(id) });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
