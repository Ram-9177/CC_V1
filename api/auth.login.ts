import type { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Missing credentials' });
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD_HASH) return res.status(500).json({ error: 'Admin credentials not configured' });
  if (email !== ADMIN_EMAIL) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });
  if (!JWT_SECRET) return res.status(500).json({ error: 'JWT secret not set' });
  const token = jwt.sign({ email }, JWT_SECRET, { expiresIn: '8h' });
  return res.status(200).json({ token });
}
