import type { VercelRequest, VercelResponse } from '@vercel/node';

// Legacy endpoint removed. Use Cloudflare Pages Functions: /functions/api/auth/login
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({
    error: 'Legacy endpoint removed. Use /api/auth/login served by Cloudflare Pages Functions',
  });
}
