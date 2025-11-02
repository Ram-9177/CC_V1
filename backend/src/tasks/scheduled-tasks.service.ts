import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GatePass, GatePassStatus } from '../modules/gate-passes/entities/gate-pass.entity';
import { NotificationService } from '../modules/notifications/notification.service';
import { EventsService } from '../modules/events/events.service';

@Injectable()
export class ScheduledTasksService {
  private readonly logger = new Logger(ScheduledTasksService.name);

  constructor(
    @InjectRepository(GatePass)
    private readonly gatePassRepo: Repository<GatePass>,
    private readonly notifications: NotificationService,
    private readonly events: EventsService
  ) {}

  @Cron('0 * * * *') // Every hour
  async autoRevokeGatePasses() {
    this.logger.log('Running autoRevokeGatePasses job');
    const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const passes = await this.gatePassRepo.find({ where: { status: GatePassStatus.ACTIVE } });
    const toRevoke = passes.filter((p) => p.lastActivityAt && p.lastActivityAt < cutoff);
    for (const p of toRevoke) {
      p.status = GatePassStatus.REVOKED;
      p.autoRevokedAt = new Date();
      await this.gatePassRepo.save(p);
      this.logger.log(`Auto-revoked gate pass ${p.passNumber}`);
      // Realtime event for clients to refresh
      try {
        this.events.emitToRoles(['WARDEN','WARDEN_HEAD','GATEMAN'], 'gate-pass:revoked', p);
        if ((p as any).student?.id) this.events.emitToRoom(`user:${(p as any).student.id}`, 'gate-pass:revoked', p);
      } catch {}
      // Notify the student if they have an FCM token
      try {
        const token = (p as any).student?.fcmToken;
        if (token) {
          this.notifications.sendToDevice(token, {
            title: 'Gate pass revoked',
            body: `Your gate pass ${p.passNumber} was auto-revoked due to inactivity`
          });
        }
      } catch {}
    }
  }

  @Cron('0 0 * * *') // Daily at midnight
  async expireGatePasses() {
    this.logger.log('Running expireGatePasses job');
    const now = new Date();
    const passes = await this.gatePassRepo.createQueryBuilder('p').where('p.toDate < :now', { now }).andWhere('p.status != :expired', { expired: GatePassStatus.EXPIRED }).getMany();
    for (const p of passes) {
      p.status = GatePassStatus.EXPIRED;
      await this.gatePassRepo.save(p);
      this.logger.log(`Expired gate pass ${p.passNumber}`);
    }
  }

}
