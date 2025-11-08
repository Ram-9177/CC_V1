import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoPromise from './_lib/mongo';
import { Room } from './_lib/models/Room';
import { getUserFromReq } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await mongoPromise;
    const user = getUserFromReq(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const rooms = await Room.find().lean();
      return res.status(200).json(rooms);
    }
    if (req.method === 'POST') {
      const { number, capacity } = req.body || {};
      if (!number) return res.status(400).json({ error: 'Missing room number' });
      const exists = await Room.findOne({ number });
      if (exists) return res.status(409).json({ error: 'Duplicate room number' });
      const room = await Room.create({ number, capacity: capacity ? Number(capacity) : 1 });
      return res.status(201).json(room);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
