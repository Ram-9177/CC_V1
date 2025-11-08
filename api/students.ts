import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoPromise from './_lib/mongo';
import { Student } from './_lib/models/Student';
import { Room } from './_lib/models/Room';
import { getUserFromReq } from './_lib/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await mongoPromise;
  const user = getUserFromReq(req);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.method === 'GET') {
      const students = await Student.find().populate('room').lean();
      return res.status(200).json(students);
    }
    if (req.method === 'POST') {
      const { name, roll, email, room } = req.body || {};
      if (!name || !roll || !email) return res.status(400).json({ error: 'Missing required fields' });
      const existing = await Student.findOne({ $or: [{ roll }, { email }] });
      if (existing) return res.status(409).json({ error: 'Duplicate roll or email' });
      const student = await Student.create({ name, roll, email, room: room || null });
      if (room) await Room.findByIdAndUpdate(room, { $push: { occupants: student._id } });
      return res.status(201).json(student);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
