import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationAudit } from './entities';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { DeviceToken } from './entities';
import { NotificationService } from './notification.service';

@Controller('notifications')
export class NotificationsController {
  constructor(
    @InjectRepository(NotificationAudit) private readonly auditRepo: Repository<NotificationAudit>,
    @InjectRepository(DeviceToken) private readonly tokenRepo: Repository<DeviceToken>,
    private readonly notifications: NotificationService,
  ) {}

  @Get('audit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN')
  async list(@Query('page') page = '1', @Query('limit') limit = '20') {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
    const [items, total] = await this.auditRepo.findAndCount({ skip: (p - 1) * l, take: l, order: { createdAt: 'DESC' } });
    return { items, total, page: p, limit: l };
  }

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async sendTest(@Req() req: any, @Body() body: { title: string; body?: string; url?: string }) {
    const user = req.user as any;
    const tokens = await this.tokenRepo.find({ where: { userId: user.id } });
    let ok = 0; let failed = 0;
    for (const t of tokens) {
      try {
        const data = { title: body.title || 'HostelConnect', body: body.body || '', data: { url: body.url || '/' } };
        if (t.platform === 'webpush') {
          const sub = JSON.parse(t.token);
          const res = await this.notifications.sendWebPush(sub, data);
          if ((res as any)?.success) ok++; else failed++;
        } else {
          const res = await this.notifications.sendToDevice(t.token, data);
          if ((res as any)?.success) ok++; else failed++;
        }
      } catch { failed++; }
    }
    return { sent: ok, failed };
  }

  @Post('broadcast')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('SUPER_ADMIN','WARDEN','WARDEN_HEAD')
  async broadcast(@Body() body: { role?: string; hostelId?: string; title: string; body?: string; url?: string }) {
    const where: any = {};
    if (body.role) where.role = body.role;
    if (body.hostelId) where.hostelId = body.hostelId;
    const tokens = await this.tokenRepo.find({ where });
    let ok = 0; let failed = 0;
    for (const t of tokens) {
      try {
        const data = { title: body.title || 'HostelConnect', body: body.body || '', data: { url: body.url || '/' } };
        if (t.platform === 'webpush') {
          const sub = JSON.parse(t.token);
          const res = await this.notifications.sendWebPush(sub, data);
          if ((res as any)?.success) ok++; else failed++;
        } else {
          const res = await this.notifications.sendToDevice(t.token, data);
          if ((res as any)?.success) ok++; else failed++;
        }
      } catch { failed++; }
    }
    return { sent: ok, failed };
  }

  @Get('tokens')
  @UseGuards(JwtAuthGuard)
  async listMyTokens(@Req() req: any) {
    const user = req.user as any;
    return this.tokenRepo.find({ where: { userId: user.id }, order: { createdAt: 'DESC' } });
  }

  @Post('register-token')
  @UseGuards(JwtAuthGuard)
  async registerToken(
    @Req() req: any,
    @Body() body: { platform: 'android' | 'ios' | 'webpush' | 'web'; token: string; role?: string; hostelId?: string }
  ) {
    const user = req.user as any;
    // upsert-like: avoid exact duplicates
    const existing = await this.tokenRepo.findOne({ where: { userId: user.id, token: body.token } });
    if (existing) return existing;
    const rec = this.tokenRepo.create({ userId: user.id, platform: body.platform, token: body.token, role: body.role || user.role, hostelId: body.hostelId || user.hostelId });
    return this.tokenRepo.save(rec);
  }

  @Delete('token/:id')
  @UseGuards(JwtAuthGuard)
  async deleteToken(@Req() req: any, @Param('id') id: string) {
    const user = req.user as any;
    const token = await this.tokenRepo.findOne({ where: { id } });
    if (!token || token.userId !== user.id) return { affected: 0 };
    await this.tokenRepo.delete(id);
    return { affected: 1 };
  }
}
