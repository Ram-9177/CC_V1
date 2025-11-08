import type { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || '';

export function getUserFromReq(req: VercelRequest): any | null {
  const auth = req.headers['authorization'];
  if (!auth || Array.isArray(auth)) return null;
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  const token = parts[1];
  try {
    if (!JWT_SECRET) return null;
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}
