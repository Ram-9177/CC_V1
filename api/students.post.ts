import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoPromise from './_lib/mongo';
import { Student } from './_lib/models/Student';
import { Room } from './_lib/models/Room';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { name, roll, email, room } = req.body;
    if (!name || !roll || !email) return res.status(400).json({ error: 'Missing required fields' });
    await mongoPromise;
    const student = await Student.create({ name, roll, email, room: room || null });
    if (room) await Room.findByIdAndUpdate(room, { $push: { occupants: student._id } });
    return res.status(201).json(student);
  } catch (e: any) {
    if (e.code === 11000) return res.status(409).json({ error: 'Duplicate roll/email' });
    return res.status(500).json({ error: e.message });
  }
}