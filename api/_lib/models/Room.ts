import { Schema, model } from 'mongoose';

const RoomSchema = new Schema({
  number: { type: String, required: true, unique: true },
  capacity: { type: Number, required: true, default: 1 },
  occupants: [{ type: Schema.Types.ObjectId, ref: 'Student' }]
});

export const Room = model('Room', RoomSchema);