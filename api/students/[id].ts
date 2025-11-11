import type { VercelRequest, VercelResponse } from '@vercel/node';

// Legacy endpoint removed. Use Cloudflare Pages Functions: /functions/api/students/[id]
export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(410).json({
    error: 'Legacy endpoint removed. Use /api/students/:id served by Cloudflare Pages Functions',
  });
}
