import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>
  ) {}

  async findById(id: string) {
    return this.usersRepo.findOne({ where: { id } });
  }

  async findByHallticket(hallticket: string) {
    const ht = (hallticket || '').trim().toUpperCase();
    return this.usersRepo.findOne({ where: { hallticket: ht } });
  }

  private normalizeRole(input?: any): UserRole | undefined {
    if (!input) return undefined;
    const s = String(input).trim().toUpperCase().replace(/[-\s]/g, '_');
    if ((Object as any).values(UserRole).includes(s)) return s as UserRole;
    return undefined;
  }

  async create(dto: CreateUserDto) {
    // Note: controller is responsible for authz; service can be used directly in tests
    const existing = await this.findByHallticket(dto.hallticket);
    if (existing) throw new Error('Hallticket already exists');

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = this.usersRepo.create({
      hallticket: (dto.hallticket || '').trim().toUpperCase(),
      password: hashed,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phoneNumber: dto.phoneNumber,
      email: dto.email?.toLowerCase(),
      roomNumber: dto.roomNumber,
      hostelBlock: dto.hostelBlock,
      role: (this.normalizeRole(dto.role) || UserRole.STUDENT)
    });
    return this.usersRepo.save(user);
  }

  allowedTargetRoles(actor: UserRole): UserRole[] {
    switch (actor) {
      case UserRole.SUPER_ADMIN:
        return [
          UserRole.STUDENT,
          UserRole.WARDEN,
          UserRole.WARDEN_HEAD,
          UserRole.GATEMAN,
          UserRole.CHEF,
          UserRole.SUPER_ADMIN,
        ];
      case UserRole.WARDEN_HEAD:
        return [UserRole.STUDENT, UserRole.WARDEN];
      case UserRole.WARDEN:
        return [UserRole.STUDENT];
      default:
        return [];
    }
  }

  ensureCreationAllowed(actorRole: UserRole, targetRole: UserRole) {
    const allowed = this.allowedTargetRoles(actorRole);
    if (!allowed.includes(targetRole)) {
      throw new ForbiddenException(`Role ${actorRole} cannot create users with role ${targetRole}`);
    }
  }

  async update(id: string, patch: Partial<User>) {
    await this.usersRepo.update(id, patch);
    return this.findById(id);
  }

  async deactivate(id: string) {
    await this.usersRepo.update(id, { isActive: false });
    return this.findById(id);
  }

  async listUsers(query: { role?: string; search?: string; page?: string; limit?: string }) {
    const page = parseInt(query.page as any, 10) || 1;
    const limit = parseInt(query.limit as any, 10) || 20;
    const skip = (page - 1) * limit;

    const qb = this.usersRepo.createQueryBuilder('user');
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.search) {
      qb.andWhere(`(
        user.hallticket ILIKE :s OR
        user.firstName ILIKE :s OR
        user.lastName ILIKE :s OR
        user.roomNumber ILIKE :s OR
        user.hostelBlock ILIKE :s
      )`, { s: `%${query.search}%` });
    }

    const [data, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return { data, total, page, totalPages: Math.ceil(total / limit) };
  }

  async exportUsers(query: { role?: string; search?: string }) {
    const qb = this.usersRepo.createQueryBuilder('user');
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.search) qb.andWhere(`(
      user.hallticket ILIKE :s OR user.firstName ILIKE :s OR user.lastName ILIKE :s OR
      user.roomNumber ILIKE :s OR user.hostelBlock ILIKE :s
    )`, { s: `%${query.search}%` });
    const users = await qb.getMany();
    const header = 'hallticket,firstName,lastName,role,roomNumber,hostelBlock,phoneNumber\n';
    const rows = users.map(u => `${u.hallticket},${u.firstName},${u.lastName},${u.role},${u.roomNumber || ''},${u.hostelBlock || ''},${u.phoneNumber || ''}`).join('\n');
    return header + rows;
  }

  async bulkImportFromCsv(buffer: Buffer, actorRole: UserRole) {
    // Use CSV parser helper
    const { records } = require('../../utils/csv').parseCsv(buffer);
    const results = { imported: 0, failed: 0, errors: [] as any[] };
    for (let i = 0; i < records.length; i++) {
      const obj = records[i] as Record<string, any>;
      try {
        if (!obj.hallticket) throw new Error('Missing hallticket');
        if (!obj.firstName) throw new Error('Missing firstName');
        if (!obj.lastName) throw new Error('Missing lastName');
        const hallticket = String(obj.hallticket).trim().toUpperCase();
        const role = this.normalizeRole(obj.role) || UserRole.STUDENT;
        const dto: any = {
          hallticket,
          password: obj.password || 'changeme123',
          firstName: obj.firstName,
          lastName: obj.lastName,
          phoneNumber: obj.phoneNumber,
          email: obj.email?.toLowerCase?.() || obj.email,
          roomNumber: obj.roomNumber,
          hostelBlock: obj.hostelBlock,
          role
        };
        // Enforce RBAC per row
        this.ensureCreationAllowed(actorRole, dto.role);
        await this.create(dto as any);
        results.imported++;
      } catch (err: any) {
        results.failed++;
        results.errors.push({ row: i + 2, hallticket: obj.hallticket, error: err.message || String(err) });
      }
    }
    return results;
  }

  async searchLite(query: { q?: string; limit?: number }) {
    const q = (query.q || '').trim();
    const limit = Math.min(Math.max(query.limit || 10, 1), 50);
    const qb = this.usersRepo.createQueryBuilder('user');
    if (q) {
      qb.andWhere(`(
        user.hallticket ILIKE :s OR user.firstName ILIKE :s OR user.lastName ILIKE :s OR
        user.roomNumber ILIKE :s OR user.hostelBlock ILIKE :s OR user.phoneNumber ILIKE :s
      )`, { s: `%${q}%` });
    }
    qb.orderBy('user.updatedAt', 'DESC').take(limit);
    const users = await qb.getMany();
    return users.map(u => ({
      id: u.id,
      hallticket: u.hallticket,
      firstName: u.firstName,
      lastName: u.lastName,
      role: u.role,
      roomNumber: u.roomNumber,
      hostelBlock: u.hostelBlock,
      phoneNumber: u.phoneNumber,
    }));
  }

  // Utility for targeted notifications: list active students with FCM tokens
  async listActiveStudentsWithFcmTokens() {
    const qb = this.usersRepo.createQueryBuilder('user')
      .where('user.role = :role', { role: UserRole.STUDENT })
      .andWhere('user.isActive = :isActive', { isActive: true })
      .andWhere('user.fcmToken IS NOT NULL');
    return qb.getMany();
  }
}
