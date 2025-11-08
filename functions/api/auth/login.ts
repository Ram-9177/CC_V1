import { signToken } from '../../_utils/jwt';

export const onRequestPost: PagesFunction = async (context) => {
  const { request, env } = context;
  const body = await request.json().catch(() => ({}));
  const email = body.email;
  const password = body.password;
  if (!email || !password) return new Response(JSON.stringify({ error: 'Missing credentials' }), { status: 400 });
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.JWT_SECRET) return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500 });
  if (email !== env.ADMIN_EMAIL || password !== env.ADMIN_PASSWORD) return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
  const token = await signToken(env.JWT_SECRET, { email });
  return new Response(JSON.stringify({ token }), { headers: { 'Content-Type': 'application/json' } });
};