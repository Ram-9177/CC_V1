import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GatePass, GatePassStatus } from './entities/gate-pass.entity';
import { CreateGatePassDto } from './dto/create-gate-pass.dto';
import * as QRCode from 'qrcode';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class GatePassesService {
  constructor(
    @InjectRepository(GatePass)
    private readonly repo: Repository<GatePass>,
    private readonly usersService: UsersService,
    private readonly eventsService: EventsService,
    private readonly notifications: NotificationService
  ) {}

  private async generatePassNumber() {
    // Simple pass number: GP + timestamp
    const prefix = 'GP' + new Date().getFullYear();
    const random = Math.floor(Math.random() * 9000) + 1000;
    return `${prefix}${random}`;
  }

  async create(studentId: string, dto: CreateGatePassDto) {
    const student = await this.usersService.findById(studentId);
    if (!student) throw new NotFoundException('Student not found');
    const passNumber = await this.generatePassNumber();
    const pass = this.repo.create({
      passNumber,
      student,
      reason: dto.reason,
      destination: dto.destination,
      fromDate: new Date(dto.fromDate),
      toDate: new Date(dto.toDate),
      status: dto.isEmergency ? GatePassStatus.APPROVED : GatePassStatus.PENDING,
      isEmergency: !!dto.isEmergency
    });
    const saved = await this.repo.save(pass);
    // Auto-approve emergency passes
    if (saved.isEmergency) {
      const approved = await this.approve(saved.id, studentId, { notes: 'Auto-approved emergency pass' });
      // emit event
      try {
        const payload = approved;
        this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD','GATEMAN'], 'gate-pass:created', payload);
        if ((approved as any).student?.id) this.eventsService.emitToRoom(`user:${(approved as any).student.id}`, 'gate-pass:created', payload);
  } catch {}
      // notify student if they have fcm token
      try {
        if ((approved as any).student?.fcmToken) {
          this.notifications.sendToDevice((approved as any).student.fcmToken, {
            title: 'Gate pass approved',
            body: `Your emergency gate pass ${approved.passNumber} was approved`
          });
        }
  } catch {}
      return approved;
    }
    // emit pending created
    try {
      const payload = saved;
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'gate-pass:created', payload);
      if ((saved as any).student?.id) this.eventsService.emitToRoom(`user:${(saved as any).student.id}`, 'gate-pass:created', payload);
  } catch {}
    return saved;
  }

  async findAll(query: any) {
    const qb = this.repo.createQueryBuilder('p').leftJoinAndSelect('p.student', 'student');
    if (query.status) qb.where('p.status = :status', { status: query.status });
    if (query.studentId) qb.andWhere('student.id = :sid', { sid: query.studentId });
    const [data, total] = await qb.getManyAndCount();
    return { data, total };
  }

  async findById(id: string) {
    const p = await this.repo.findOne({ where: { id } });
    if (!p) throw new NotFoundException('Gate pass not found');
    return p;
  }

  async approve(id: string, approverId: string, _body: { notes?: string }) {
    const pass = await this.findById(id);
    if (pass.status !== GatePassStatus.PENDING && pass.status !== GatePassStatus.REVOKED) {
      // allow re-approve? Keep simple
    }
    const approver = await this.usersService.findById(approverId);
    pass.approvedBy = approver as any;
    pass.approvedAt = new Date();
    pass.status = GatePassStatus.APPROVED;
    // generate QR
    pass.qrCode = await QRCode.toDataURL(JSON.stringify({ id: pass.id, passNumber: pass.passNumber }));
    const saved = await this.repo.save(pass);
    try {
      const payload = saved;
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD','GATEMAN'], 'gate-pass:approved', payload);
      if ((saved as any).student?.id) this.eventsService.emitToRoom(`user:${(saved as any).student.id}`, 'gate-pass:approved', payload);
  } catch {}
    try {
      if ((saved as any).student?.fcmToken) {
        this.notifications.sendToDevice((saved as any).student.fcmToken, {
          title: 'Gate pass approved',
          body: `Your gate pass ${saved.passNumber} has been approved`
        });
      }
  } catch {}
    return saved;
  }

  async reject(id: string, rejectedById: string, dto: { reason: string }) {
    const pass = await this.findById(id);
    pass.status = GatePassStatus.REJECTED;
    pass.rejectedReason = dto.reason;
    pass.approvedBy = (await this.usersService.findById(rejectedById)) as any;
    const saved = await this.repo.save(pass);
    try {
      const payload = saved;
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD'], 'gate-pass:rejected', payload);
      if ((saved as any).student?.id) this.eventsService.emitToRoom(`user:${(saved as any).student.id}`, 'gate-pass:rejected', payload);
  } catch {}
    return saved;
  }

  async watchAd(id: string, studentId: string, watchedDurationSeconds: number) {
    const pass = await this.findById(id);
    if (pass.student.id !== studentId) throw new ForbiddenException('Not your gate pass');
    // require at least 20s
    if (watchedDurationSeconds < 20) return { adWatchedAt: null, qrCodeUnlocked: false };
    pass.adWatchedAt = new Date();
    // Only allow QR if approved
    const unlocked = pass.status === GatePassStatus.APPROVED;
    await this.repo.save(pass);
    return { adWatchedAt: pass.adWatchedAt, qrCodeUnlocked: unlocked, qrCode: unlocked ? pass.qrCode : null };
  }

  async revoke(id: string, _revokedById: string, _dto: { reason?: string }) {
    const pass = await this.findById(id);
    pass.status = GatePassStatus.REVOKED;
    pass.autoRevokedAt = new Date();
    const saved = await this.repo.save(pass);
    try {
      const payload = saved;
      this.eventsService.emitToRoles(['WARDEN','WARDEN_HEAD','GATEMAN'], 'gate-pass:revoked', payload);
      if ((saved as any).student?.id) this.eventsService.emitToRoom(`user:${(saved as any).student.id}`, 'gate-pass:revoked', payload);
  } catch {}
    return saved;
  }
}
