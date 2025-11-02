import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { CreateSessionDto } from './dto/create-session.dto';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';
import * as QRCode from 'qrcode';

@Injectable()
export class AttendanceService {
  constructor(
    @InjectRepository(AttendanceSession)
    private readonly sessionsRepo: Repository<AttendanceSession>,
    @InjectRepository(AttendanceRecord)
    private readonly recordsRepo: Repository<AttendanceRecord>,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
    private readonly notifications: NotificationService
  ) {}

  async createSession(creatorId: string, dto: CreateSessionDto) {
    const creator = await this.usersService.findById(creatorId);
    if (!creator) throw new NotFoundException('Creator not found');
    // Support old from/to or new scheduledAt
    let scheduledAt: Date | undefined;
    if (dto.scheduledAt) scheduledAt = new Date(dto.scheduledAt);
    else if (dto.from) scheduledAt = new Date(dto.from);

    if (dto.from && dto.to) {
      const from = new Date(dto.from);
      const to = new Date(dto.to);
      if (from >= to) throw new BadRequestException('start time must be before end time');
    }

    const s = this.sessionsRepo.create({
      title: dto.title,
      sessionType: dto.sessionType,
      scheduledAt,
      status: 'SCHEDULED',
      mode: dto.mode || 'QR',
      totalExpected: dto.totalExpected ?? 0,
      createdBy: creator
    });
    const saved = await this.sessionsRepo.save(s);
    return saved;
  }

  async joinSession(studentId: string, sessionId: string) {
    const student = await this.usersService.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    const session = await this.sessionsRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (typeof (session as any).status !== 'undefined' && session.status !== 'ACTIVE') {
      throw new BadRequestException('Session is not active');
    }
    // prevent duplicate join
    const existing = await this.recordsRepo.findOne({ where: { session: { id: session.id }, student: { id: student.id } } as any });
    if (existing) return existing;
    const record = this.recordsRepo.create({ session, student, status: 'PRESENT', method: 'QR' });
    const saved = await this.recordsRepo.save(record);
    try {
      const payload = { sessionId: session.id, studentId: student.id, recordId: saved.id };
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'attendance:marked', payload);
      this.eventsService.emitToRoom(`user:${student.id}`, 'attendance:marked', payload);
    } catch {}
    try {
      if ((student as any).fcmToken) {
        this.notifications.sendToDevice((student as any).fcmToken, { title: 'Attendance joined', body: `You have joined ${session.title}` });
      }
    } catch {}
    // increment totals (best-effort)
    try {
      session.totalPresent = (session.totalPresent || 0) + 1;
      await this.sessionsRepo.save(session);
    } catch {}
    return saved;
  }

  async listSessions(query: any) {
    const qb = this.sessionsRepo.createQueryBuilder('s');
    if (query.status) qb.andWhere('s.status = :st', { st: query.status });
    if (query.date) qb.andWhere('date(s.scheduledAt) = date(:dt)', { dt: query.date });
    if (query.dateFrom) qb.andWhere('s.scheduledAt >= :from', { from: new Date(query.dateFrom) });
    if (query.dateTo) qb.andWhere('s.scheduledAt <= :to', { to: new Date(query.dateTo) });
    if (query.search) {
      qb.andWhere('LOWER(s.title) LIKE :q', { q: `%${String(query.search).toLowerCase()}%` });
    }
    const allowedSort = ['createdAt', 'scheduledAt', 'status', 'title'] as const;
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = String(query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`s.${sortBy}`, sortDir as any);
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize, 10) || 10));
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize } as any;
  }

  async exportSessions(query: any): Promise<string> {
    const qb = this.sessionsRepo.createQueryBuilder('s');
    if (query.status) qb.andWhere('s.status = :st', { st: query.status });
    if (query.date) qb.andWhere('date(s.scheduledAt) = date(:dt)', { dt: query.date });
    if (query.dateFrom) qb.andWhere('s.scheduledAt >= :from', { from: new Date(query.dateFrom) });
    if (query.dateTo) qb.andWhere('s.scheduledAt <= :to', { to: new Date(query.dateTo) });
    if (query.search) {
      qb.andWhere('LOWER(s.title) LIKE :q', { q: `%${String(query.search).toLowerCase()}%` });
    }
    const allowedSort = ['createdAt', 'scheduledAt', 'status', 'title'] as const;
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = String(query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy(`s.${sortBy}`, sortDir as any);
    // Optional pagination for exporting current page only
    const page = query.page ? Math.max(1, parseInt(query.page, 10) || 1) : undefined;
    const pageSize = query.pageSize ? Math.max(1, Math.min(1000, parseInt(query.pageSize, 10) || 10)) : undefined;
    if (page && pageSize) qb.skip((page - 1) * pageSize).take(pageSize);
    const data = await qb.getMany();
    const header = [
      'id',
      'title',
      'status',
      'mode',
      'sessionType',
      'scheduledAt',
      'startedAt',
      'endedAt',
      'createdAt',
      'totalExpected',
      'totalPresent',
      'totalAbsent'
    ].join(',');
    const rows = data.map((s: any) => {
      const safe = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
      const dateStr = (d: any) => (d && d.toISOString ? d.toISOString() : (d ? String(d) : ''));
      const cols = [
        s.id,
        s.title,
        s.status,
        s.mode,
        s.sessionType || '',
        dateStr(s.scheduledAt),
        dateStr(s.startedAt),
        dateStr(s.endedAt),
        dateStr(s.createdAt),
        String(s.totalExpected ?? 0),
        String(s.totalPresent ?? 0),
        String(s.totalAbsent ?? Math.max(0, (s.totalExpected || 0) - (s.totalPresent || 0)))
      ];
      return cols.map((v) => `"${safe(v)}"`).join(',');
    });
    return [header, ...rows].join('\n');
  }

  async getSession(id: string) {
    const s = await this.sessionsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Session not found');
    const records = await this.recordsRepo.find({ where: { session: { id: s.id } } as any });
    return { ...s, records } as any;
  }

  async listSessionRecords(sessionId: string, query: any) {
    const session = await this.sessionsRepo.findOne({ where: { id: sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    const qb = this.recordsRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.student', 'u')
      .leftJoinAndSelect('r.session', 's')
      .where('s.id = :sid', { sid: sessionId })
      .orderBy('r.markedAt', 'DESC');
    if (query.status) qb.andWhere('r.status = :st', { st: query.status });
    if (query.search) {
      const q = `%${String(query.search).toLowerCase()}%`;
      qb.andWhere('(LOWER(u.firstName) LIKE :q OR LOWER(u.lastName) LIKE :q OR LOWER(u.hallticket) LIKE :q)', { q });
    }
    if (query.fromDate) qb.andWhere('r.markedAt >= :from', { from: new Date(query.fromDate) });
    if (query.toDate) qb.andWhere('r.markedAt <= :to', { to: new Date(query.toDate) });
    const allowedSort = ['markedAt', 'status', 'hallticket'] as const;
    const sortBy = allowedSort.includes(query.sortBy) ? query.sortBy : 'markedAt';
    const sortDir = String(query.sortDir || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    if (sortBy === 'markedAt') qb.orderBy('r.markedAt', sortDir as any);
    else if (sortBy === 'status') qb.orderBy('r.status', sortDir as any).addOrderBy('r.markedAt', 'DESC');
    else if (sortBy === 'hallticket') qb.orderBy('u.hallticket', sortDir as any).addOrderBy('r.markedAt', 'DESC');
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const pageSize = Math.max(1, Math.min(100, parseInt(query.pageSize, 10) || 10));
    qb.skip((page - 1) * pageSize).take(pageSize);
    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, pageSize } as any;
  }

  async startSession(id: string) {
    const s = await this.sessionsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Session not found');
    if (s.status === 'ACTIVE') return s;
    s.status = 'ACTIVE';
    s.startedAt = new Date();
    // Generate QR for QR and MIXED modes
    if (s.mode !== 'MANUAL') {
      try {
        s.qrCode = await QRCode.toDataURL(JSON.stringify({ sessionId: s.id }));
      } catch {}
    }
    const saved = await this.sessionsRepo.save(s);
    try {
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'attendance:session-started', { sessionId: saved.id });
      this.notifications.sendToTopic('attendance', { title: 'Attendance started', body: `${s.title} has started` });
    } catch {}
    return saved;
  }

  async endSession(id: string) {
    const s = await this.sessionsRepo.findOne({ where: { id } });
    if (!s) throw new NotFoundException('Session not found');
    s.status = 'COMPLETED';
    s.endedAt = new Date();
    // compute summary
    const [present, total] = await Promise.all([
      this.recordsRepo.count({ where: { session: { id: s.id }, status: 'PRESENT' } as any }),
      this.recordsRepo.count({ where: { session: { id: s.id } } as any })
    ]);
    s.totalPresent = present;
    s.totalAbsent = total - present;
    const saved = await this.sessionsRepo.save(s);
    try {
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'attendance:session-ended', { sessionId: saved.id });
    } catch {}
    return { ...saved, summary: { totalPresent: s.totalPresent, totalAbsent: s.totalAbsent, attendanceRate: total ? Math.round((present / total) * 1000) / 10 : 0 } } as any;
  }

  async markAttendance(markerId: string, body: { sessionId: string; studentId?: string; status?: 'PRESENT' | 'ABSENT' | 'LATE' | 'EXCUSED'; method: 'QR' | 'MANUAL' }) {
    const session = await this.sessionsRepo.findOne({ where: { id: body.sessionId } });
    if (!session) throw new NotFoundException('Session not found');
    if (session.status !== 'ACTIVE') throw new BadRequestException('Session is not active');
    const marker = await this.usersService.findById(markerId);
    if (!marker) throw new NotFoundException('Marker not found');
    const studentId = body.studentId || markerId;
    if (body.method === 'MANUAL' && !body.studentId) throw new BadRequestException('studentId required for manual mark');
    const student = await this.usersService.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    let record = await this.recordsRepo.findOne({ where: { session: { id: session.id }, student: { id: student.id } } as any });
    if (!record) {
      record = this.recordsRepo.create({ session, student });
    }
    record.status = body.status || 'PRESENT';
    record.method = body.method;
    record.markedBy = body.method === 'MANUAL' ? marker : undefined;
    const saved = await this.recordsRepo.save(record);
    try {
      const payload = { sessionId: session.id, studentId: student.id, status: record.status };
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'attendance:marked', payload);
      this.eventsService.emitToRoom(`user:${student.id}`, 'attendance:marked', payload);
    } catch {}
    return saved;
  }

  async myRecords(userId: string, query: { fromDate?: string; toDate?: string }) {
    const qb = this.recordsRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.session', 's')
      .leftJoinAndSelect('r.student', 'u')
      .where('u.id = :uid', { uid: userId })
      .orderBy('r.markedAt', 'DESC');
    if (query.fromDate) qb.andWhere('r.markedAt >= :from', { from: new Date(query.fromDate) });
    if (query.toDate) qb.andWhere('r.markedAt <= :to', { to: new Date(query.toDate) });
    const records = await qb.getMany();
    const totalSessions = records.length;
    const present = records.filter((r) => r.status === 'PRESENT').length;
    const absent = totalSessions - present;
    const attendanceRate = totalSessions ? Math.round((present / totalSessions) * 1000) / 10 : 0;
    return { data: records, summary: { totalSessions, present, absent, attendanceRate } };
  }

  async exportCsv(sessionId: string): Promise<string> {
    const records = await this.recordsRepo.find({ where: { session: { id: sessionId } } as any });
    const header = ['hallticket', 'firstName', 'lastName', 'status', 'markedAt', 'method', 'markedBy'].join(',');
    const rows = records.map((r) => {
      const s = (r as any).student || {};
      const mb = (r as any).markedBy || {};
      const safe = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
      return [s.hallticket, s.firstName, s.lastName, r.status, (r as any).markedAt?.toISOString?.() || '', r.method || '', mb.hallticket || '']
        .map((v) => `"${safe(v)}"`) // quote values
        .join(',');
    });
    return [header, ...rows].join('\n');
  }

  async exportSessionRecords(sessionId: string, query: any): Promise<string> {
    const s = await this.sessionsRepo.findOne({ where: { id: sessionId } });
    if (!s) throw new NotFoundException('Session not found');
    const qb = this.recordsRepo.createQueryBuilder('r')
      .leftJoinAndSelect('r.student', 'u')
      .leftJoinAndSelect('r.markedBy', 'mb')
      .leftJoin('r.session', 'ses')
      .where('ses.id = :sid', { sid: sessionId })
      .orderBy('r.markedAt', 'DESC');
    if (query.status) qb.andWhere('r.status = :st', { st: query.status });
    if (query.search) {
      const q = `%${String(query.search).toLowerCase()}%`;
      qb.andWhere('(LOWER(u.firstName) LIKE :q OR LOWER(u.lastName) LIKE :q OR LOWER(u.hallticket) LIKE :q)', { q });
    }
    const page = query.page ? Math.max(1, parseInt(query.page, 10) || 1) : undefined;
    const pageSize = query.pageSize ? Math.max(1, Math.min(1000, parseInt(query.pageSize, 10) || 10)) : undefined;
    if (page && pageSize) qb.skip((page - 1) * pageSize).take(pageSize);
    const records = await qb.getMany();
    const header = ['hallticket', 'firstName', 'lastName', 'status', 'markedAt', 'method', 'markedBy'].join(',');
    const rows = records.map((r: any) => {
      const s = r.student || {};
      const mb = r.markedBy || {};
      const safe = (v: any) => (v == null ? '' : String(v).replace(/"/g, '""'));
      return [s.hallticket, s.firstName, s.lastName, r.status, r.markedAt?.toISOString?.() || '', r.method || '', mb.hallticket || '']
        .map((v) => `"${safe(v)}"`)
        .join(',');
    });
    return [header, ...rows].join('\n');
  }
}
