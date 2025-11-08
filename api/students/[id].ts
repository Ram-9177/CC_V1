import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoPromise from '../_lib/mongo';
import { Student } from '../_lib/models/Student';
import { Room } from '../_lib/models/Room';
import { getUserFromReq } from '../_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { id } = req.query;
  if (!id || typeof id !== 'string') return res.status(400).json({ error: 'Invalid id' });
  try {
    await mongoPromise;
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'GET') {
      const student = await Student.findById(id).populate('room');
      if (!student) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(student);
    }
    if (req.method === 'PUT') {
      const update = await Student.findByIdAndUpdate(id, req.body, { new: true });
      if (!update) return res.status(404).json({ error: 'Not found' });
      return res.status(200).json(update);
    }
    if (req.method === 'DELETE') {
      const del = await Student.findByIdAndDelete(id);
      if (!del) return res.status(404).json({ error: 'Not found' });
      if (del.room) await Room.findByIdAndUpdate(del.room, { $pull: { occupants: del._id } });
      return res.status(200).json({ ok: true });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
