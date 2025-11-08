import { Schema, model } from 'mongoose';

const StudentSchema = new Schema({
  name: { type: String, required: true },
  roll: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  room: { type: Schema.Types.ObjectId, ref: 'Room', default: null },
  createdAt: { type: Date, default: Date.now }
});

export const Student = model('Student', StudentSchema);