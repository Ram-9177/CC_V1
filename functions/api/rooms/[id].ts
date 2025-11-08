import { verifyToken } from '../../_utils/jwt';
import { dataApi, oid } from '../../_utils/dataApi';

export const onRequestGet: PagesFunction = async (ctx) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const { id } = params;
  const result = await dataApi(env, 'find', { collection: 'rooms', filter: { _id: oid(id) }, limit: 1 });
  const doc = result.documents?.[0];
  if (!doc) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 });
  return new Response(JSON.stringify(doc), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestPut: PagesFunction = async (ctx) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const body = await request.json().catch(() => ({}));
  const { id } = params;
  await dataApi(env, 'updateOne', { collection: 'rooms', filter: { _id: oid(id) }, update: { $set: body } });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};

export const onRequestDelete: PagesFunction = async (ctx) => {
  const { env, request, params } = ctx as any;
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.substring(7) : '';
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  try { await verifyToken(env.JWT_SECRET, token); } catch { return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }); }
  const { id } = params;
  await dataApi(env, 'deleteOne', { collection: 'rooms', filter: { _id: oid(id) } });
  return new Response(JSON.stringify({ ok: true }), { headers: { 'Content-Type': 'application/json' } });
};
