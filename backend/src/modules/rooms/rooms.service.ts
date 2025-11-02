import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Room } from './entities/room.entity';
import { User } from '../users/entities/user.entity';
import { EventsService } from '../events/events.service';

@Injectable()
export class RoomsService {
  constructor(
    @InjectRepository(Room)
    private readonly roomsRepo: Repository<Room>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    private readonly events: EventsService
  ) {}

  async upsertRoom(input: { block: string; number: string; floor?: string; capacity?: number }) {
    const block = (input.block || '').trim();
    const number = (input.number || '').trim();
    if (!block || !number) throw new BadRequestException('block and number are required');
    let room = await this.roomsRepo.findOne({ where: { block, number } });
    if (!room) {
      room = this.roomsRepo.create({ block, number, floor: input.floor, capacity: input.capacity ?? 4 });
    } else {
      room.floor = input.floor ?? room.floor;
      room.capacity = input.capacity ?? room.capacity;
    }
  const saved = await this.roomsRepo.save(room);
  this.events.emitToRoles(['WARDEN','WARDEN_HEAD'], 'room:upserted', { roomId: saved.id, block: saved.block, number: saved.number });
  return saved;
  }

  async listRooms(query: { block?: string; search?: string }) {
    const qb = this.roomsRepo.createQueryBuilder('r');
    if (query.block) qb.andWhere('r.block = :b', { b: query.block });
    if (query.search) qb.andWhere('(r.block ILIKE :s OR r.number ILIKE :s)', { s: `%${query.search}%` });
    const rooms = await qb.orderBy('r.block', 'ASC').addOrderBy('r.number', 'ASC').getMany();
    // attach occupancy counts
    const withCounts = await Promise.all(rooms.map(async (room) => {
      const count = await this.usersRepo.count({ where: { roomId: room.id, isActive: true } as any });
      return { ...room, occupants: count } as any;
    }));
    return withCounts;
  }

  async getRoom(id: string) {
    const room = await this.roomsRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    const occupants = await this.usersRepo.find({ where: { roomId: room.id, isActive: true } as any });
    return { ...room, occupants } as any;
  }

  async exportRoomOccupantsCsv(id: string) {
    const room = await this.roomsRepo.findOne({ where: { id } });
    if (!room) throw new NotFoundException('Room not found');
    const occupants = await this.usersRepo.find({ where: { roomId: room.id, isActive: true } as any });
    const header = 'hallticket,firstName,lastName,bedLabel,hostelBlock,roomNumber\n';
    const rows = occupants.map(u => [
      u.hallticket,
      u.firstName || '',
      u.lastName || '',
      u.bedLabel || '',
      u.hostelBlock || room.block || '',
      u.roomNumber || room.number || ''
    ].map(v => String(v).replace(/\n/g, ' ')).join(',')).join('\n');
    return header + rows + (rows ? '\n' : '');
  }

  async exportAllRoomsCsv() {
    // Build CSV of all rooms with occupancy summary
    const rooms = await this.roomsRepo.find({ order: { block: 'ASC', number: 'ASC' } as any });
    const header = 'id,block,number,floor,capacity,occupants,available\n';
    const rows: string[] = [];
    for (const room of rooms) {
      const occupants = await this.usersRepo.count({ where: { roomId: room.id, isActive: true } as any });
      const available = Math.max(0, (room.capacity ?? 4) - occupants);
      rows.push([
        room.id,
        room.block,
        room.number,
        room.floor || '',
        String(room.capacity ?? 4),
        String(occupants),
        String(available)
      ].map(v => String(v).replace(/\n/g, ' ')).join(','));
    }
    return header + rows.join('\n') + (rows.length ? '\n' : '');
  }

  async exportAllOccupantsCsv() {
    // CSV of all occupants across rooms with denormalized room details
    const header = 'roomId,block,number,floor,capacity,hallticket,firstName,lastName,bedLabel\n';
    const rooms = await this.roomsRepo.find({ order: { block: 'ASC', number: 'ASC' } as any });
    const rows: string[] = [];
    for (const room of rooms) {
      const occupants = await this.usersRepo.find({ where: { roomId: room.id, isActive: true } as any });
      for (const u of occupants) {
        rows.push([
          room.id,
          room.block,
          room.number,
          room.floor || '',
          String(room.capacity ?? 4),
          u.hallticket || '',
          u.firstName || '',
          u.lastName || '',
          (u.bedLabel || '').toString().toUpperCase()
        ].map(v => String(v).replace(/\n/g, ' ')).join(','));
      }
    }
    return header + rows.join('\n') + (rows.length ? '\n' : '');
  }

  async assignUserToRoom(params: { user: User; room: Room; bedLabel?: string }) {
    const { user, room, bedLabel } = params;
    // If bedLabel requested, ensure it's not already occupied
    if (bedLabel) {
      const occupied = await this.usersRepo.count({ where: { roomId: room.id, bedLabel: bedLabel.toUpperCase?.() || bedLabel } as any });
      if (occupied > 0) throw new BadRequestException('Bed already occupied');
    }
    // Capacity check (simple): count occupants
    const count = await this.usersRepo.count({ where: { roomId: room.id, isActive: true } as any });
    if (count >= (room.capacity ?? 4)) throw new BadRequestException('Room is full');

    user.roomId = room.id;
    user.hostelBlock = room.block;
    user.roomNumber = room.number;
    user.bedLabel = bedLabel ? bedLabel.toUpperCase() : undefined;
  await this.usersRepo.save(user);
  this.events.emitToRoles(['WARDEN','WARDEN_HEAD'], 'room:assigned', { roomId: room.id, userId: user.id, hallticket: user.hallticket, bedLabel: user.bedLabel });
  return { userId: user.id, roomId: room.id, bedLabel: user.bedLabel };
  }

  async unassignUserFromRoom(user: User) {
    user.roomId = null as any;
    user.hostelBlock = null as any;
    user.roomNumber = null as any;
    user.bedLabel = null as any;
  await this.usersRepo.save(user);
  this.events.emitToRoles(['WARDEN','WARDEN_HEAD'], 'room:unassigned', { userId: user.id, hallticket: user.hallticket });
  return { userId: user.id, roomId: null };
  }

  async bulkAssignFromCsv(buffer: Buffer) {
    const { records } = require('../../utils/csv').parseCsv(buffer);
    const result = { assigned: 0, failed: 0, errors: [] as any[] };
    for (let i = 0; i < records.length; i++) {
      const r = records[i] as any;
      try {
        const hallticket = String(r.hallticket || '').trim().toUpperCase();
        const block = String(r.block || '').trim();
        const number = String(r.number || '').trim();
        const bedLabel = r.bedLabel ? String(r.bedLabel).trim().toUpperCase() : undefined;
        const floor = r.floor ? String(r.floor).trim() : undefined;
        if (!hallticket || !block || !number) throw new BadRequestException('Missing hallticket/block/number');
        const user = await this.usersRepo.findOne({ where: { hallticket } });
        if (!user) throw new NotFoundException(`User ${hallticket} not found`);
        const room = await this.upsertRoom({ block, number, floor });
        await this.assignUserToRoom({ user, room, bedLabel });
        result.assigned++;
      } catch (err: any) {
        result.failed++;
        result.errors.push({ row: i + 2, error: err.message || String(err) });
      }
    }
    this.events.emitToRoles(['WARDEN','WARDEN_HEAD'], 'room:bulkAssigned', { summary: { assigned: result.assigned, failed: result.failed } });
    return result;
  }
}
