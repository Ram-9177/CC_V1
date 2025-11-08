import type { VercelRequest, VercelResponse } from '@vercel/node';
import mongoPromise from './_lib/mongo';
import { Student } from './_lib/models/Student';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    await mongoPromise;
    const students = await Student.find().populate('room').lean();
    return res.status(200).json(students);
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}