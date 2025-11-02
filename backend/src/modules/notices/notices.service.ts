import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice) private readonly repo: Repository<Notice>,
    @InjectRepository(NoticeRead) private readonly reads: Repository<NoticeRead>,
    private readonly users: UsersService,
    private readonly events: EventsService,
    private readonly notifications: NotificationService,
  ) {}

  async create(authorId: string, dto: CreateNoticeDto) {
  const author = await this.users.findById(authorId);
    const notice = this.repo.create({
      title: dto.title,
      content: dto.content,
      priority: dto.priority,
      roles: dto.roles,
      hostelIds: dto.hostelIds,
      blockIds: dto.blockIds,
      attachments: dto.attachments,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
      author: author as any,
    });
    const saved = await this.repo.save(notice);

    // Emit to target roles (fallback to STUDENT if none specified)
    const roles = (saved.roles && saved.roles.length > 0) ? saved.roles : ['STUDENT'];
    this.events.emitToRoles(roles, 'notice:created', { id: saved.id, title: saved.title, priority: saved.priority });

    // Optional: push notification via topics per role
    try {
      for (const r of roles) {
        await this.notifications.sendToTopic(`role_${r}`, { title: saved.title, body: saved.content.slice(0, 120) });
      }
    } catch {}

    return saved;
  }

  async listForUser(user: any) {
    const qb = this.repo.createQueryBuilder('n');
    qb.where('(n.expiresAt IS NULL OR n.expiresAt > now())');
    // role targeting
    if (user?.role) {
      qb.andWhere('(n.roles IS NULL OR :role = ANY(n.roles))', { role: user.role });
    }
    // hostel/block targeting
    if (user?.hostelId) {
      qb.andWhere('(n.hostelIds IS NULL OR :hid = ANY(n.hostelIds))', { hid: user.hostelId });
    }
    if (user?.blockId) {
      qb.andWhere('(n.blockIds IS NULL OR :bid = ANY(n.blockIds))', { bid: user.blockId });
    }
    qb.orderBy('n.createdAt', 'DESC').limit(100);
    const notices = await qb.getMany();
    // Attach read status if user is present
    if (user?.id && notices.length) {
      const ids = notices.map(n => n.id);
      const readRows = await this.reads
        .createQueryBuilder('r')
        .select(['r.noticeId AS noticeId'])
        .where('r.userId = :uid', { uid: user.id })
        .andWhere('r.noticeId = ANY(:ids)', { ids })
        .getRawMany<{ noticeId: string }>();
      const readSet = new Set(readRows.map(r => r.noticeId));
      // @ts-ignore annotate for frontend convenience
      return notices.map((n: any) => ({ ...n, read: readSet.has(n.id) }));
    }
    return notices as any;
  }

  async findAll(params: { role?: string; hostelId?: string; blockId?: string; includeExpired?: boolean; q?: string; limit?: number; offset?: number }) {
    const qb = this.repo.createQueryBuilder('n');
    if (!params.includeExpired) {
      qb.where('(n.expiresAt IS NULL OR n.expiresAt > now())');
    }
    if (params.role) qb.andWhere('(n.roles IS NULL OR :role = ANY(n.roles))', { role: params.role });
    if (params.hostelId) qb.andWhere('(n.hostelIds IS NULL OR :hid = ANY(n.hostelIds))', { hid: params.hostelId });
    if (params.blockId) qb.andWhere('(n.blockIds IS NULL OR :bid = ANY(n.blockIds))', { bid: params.blockId });
    if (params.q) qb.andWhere('(n.title ILIKE :q OR n.content ILIKE :q)', { q: `%${params.q}%` });
    qb.orderBy('n.createdAt', 'DESC');
    if (typeof params.limit === 'number') qb.limit(Math.max(1, Math.min(200, params.limit)));
    if (typeof params.offset === 'number') qb.offset(Math.max(0, params.offset));
    return qb.getMany();
  }

  async findOne(id: string) {
    return this.repo.findOne({ where: { id } });
  }

  async update(id: string, dto: UpdateNoticeDto) {
    const existing = await this.findOne(id);
    if (!existing) return null;
    Object.assign(existing, {
      ...dto,
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : existing.expiresAt,
    });
    const saved = await this.repo.save(existing);
    const roles = (saved.roles && saved.roles.length > 0) ? saved.roles : ['STUDENT'];
    this.events.emitToRoles(roles, 'notice:updated', { id: saved.id, title: saved.title, priority: saved.priority });
    return saved;
  }

  async remove(id: string) {
    const existing = await this.findOne(id);
    if (!existing) return { affected: 0 };
    await this.repo.delete(id);
    const roles = (existing.roles && existing.roles.length > 0) ? existing.roles : ['STUDENT'];
    this.events.emitToRoles(roles, 'notice:deleted', { id });
    return { affected: 1 };
  }

  async markAllRead(user: any) {
    if (!user?.id) return { updated: 0 };
    // Get visible notices
    const visible = await this.listForUser(user);
    const ids = (visible || []).map((n: any) => n.id);
    if (!ids.length) return { updated: 0 };
  const rows = ids.map((noticeId: string) => ({ noticeId, userId: user.id, readAt: new Date() }));
    // Upsert to avoid duplicates
    await this.reads.upsert(rows, ['noticeId', 'userId']);
    return { updated: rows.length };
  }

  async markRead(user: any, noticeId: string) {
    if (!user?.id || !noticeId) return { updated: 0 };
    await this.reads.upsert([{ noticeId, userId: user.id, readAt: new Date() }], ['noticeId', 'userId']);
    return { updated: 1 };
  }

  async markUnread(user: any, noticeId: string) {
    if (!user?.id || !noticeId) return { updated: 0 };
    await this.reads.delete({ noticeId, userId: user.id } as any);
    return { updated: 1 };
  }

  async unreadCount(user: any) {
    if (!user?.id) return { count: 0 };
    // Visible notices for user (excluding expired) minus reads
    const visibleQb = this.repo.createQueryBuilder('n');
    visibleQb.where('(n.expiresAt IS NULL OR n.expiresAt > now())');
    if (user?.role) visibleQb.andWhere('(n.roles IS NULL OR :role = ANY(n.roles))', { role: user.role });
    if (user?.hostelId) visibleQb.andWhere('(n.hostelIds IS NULL OR :hid = ANY(n.hostelIds))', { hid: user.hostelId });
    if (user?.blockId) visibleQb.andWhere('(n.blockIds IS NULL OR :bid = ANY(n.blockIds))', { bid: user.blockId });
    const allIds = (await visibleQb.select('n.id', 'id').getRawMany<{ id: string }>()).map(r => r.id);
    if (!allIds.length) return { count: 0 };
    const readRows = await this.reads.createQueryBuilder('r').select('r.noticeId', 'id').where('r.userId = :uid', { uid: user.id }).andWhere('r.noticeId = ANY(:ids)', { ids: allIds }).getRawMany<{ id: string }>();
    const readSet = new Set(readRows.map(r => r.id));
    const count = allIds.filter(id => !readSet.has(id)).length;
    return { count };
  }

  async counts(params: { role?: string; hostelId?: string; blockId?: string; includeExpired?: boolean; q?: string }) {
    const base = this.repo.createQueryBuilder('n');
    if (!params.includeExpired) base.where('(n.expiresAt IS NULL OR n.expiresAt > now())');
    if (params.role) base.andWhere('(n.roles IS NULL OR :role = ANY(n.roles))', { role: params.role });
    if (params.hostelId) base.andWhere('(n.hostelIds IS NULL OR :hid = ANY(n.hostelIds))', { hid: params.hostelId });
    if (params.blockId) base.andWhere('(n.blockIds IS NULL OR :bid = ANY(n.blockIds))', { bid: params.blockId });
    if (params.q) base.andWhere('(n.title ILIKE :q OR n.content ILIKE :q)', { q: `%${params.q}%` });

    const totalQb = base.clone();
    const highQb = base.clone().andWhere('n.priority = :p', { p: 'HIGH' });
    const expiredQb = this.repo.createQueryBuilder('n2');
    expiredQb.where('n2.expiresAt IS NOT NULL AND n2.expiresAt <= now()');
    if (params.role) expiredQb.andWhere('(n2.roles IS NULL OR :role = ANY(n2.roles))', { role: params.role });
    if (params.hostelId) expiredQb.andWhere('(n2.hostelIds IS NULL OR :hid = ANY(n2.hostelIds))', { hid: params.hostelId });
    if (params.blockId) expiredQb.andWhere('(n2.blockIds IS NULL OR :bid = ANY(n2.blockIds))', { bid: params.blockId });
    if (params.q) expiredQb.andWhere('(n2.title ILIKE :q OR n2.content ILIKE :q)', { q: `%${params.q}%` });

    const [{ total }] = await totalQb.select('COUNT(*)', 'total').getRawMany<{ total: string }>();
    const [{ high }] = await highQb.select('COUNT(*)', 'high').getRawMany<{ high: string }>();
    const [{ exp }] = await expiredQb.select('COUNT(*)', 'exp').getRawMany<{ exp: string }>();
    return { total: Number(total || 0), highPriority: Number(high || 0), expired: Number(exp || 0) };
  }
}
