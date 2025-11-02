import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { College } from './entities/college.entity';
import { Tenant } from '../tenants/entities/tenant.entity';
import { EventsService } from '../events/events.service';

@Injectable()
export class CollegesService {
  constructor(
    @InjectRepository(College) private readonly repo: Repository<College>,
    @InjectRepository(Tenant) private readonly tenants: Repository<Tenant>,
    private readonly events: EventsService
  ) {}

  async create(body: { tenantId: string; code: string; name: string; address?: string }) {
    const tenant = await this.tenants.findOne({ where: { id: body.tenantId } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    const c = this.repo.create({ code: body.code, name: body.name, address: body.address, tenant });
    const saved = await this.repo.save(c);
    try { this.events.emitToRole('SUPER_ADMIN', 'college:created', { id: saved.id, tenantId: tenant.id }); } catch {}
    return saved;
  }

  findAll(query?: { tenantId?: string }) {
    if (query?.tenantId) return this.repo.find({ where: { tenant: { id: query.tenantId } as any } });
    return this.repo.find();
  }

  async findById(id: string) {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException('College not found');
    return c;
  }

  async update(id: string, body: Partial<College>) {
    const c = await this.findById(id);
    Object.assign(c, { name: body.name ?? c.name, address: body.address ?? c.address });
    const saved = await this.repo.save(c);
    try { this.events.emitToRole('SUPER_ADMIN', 'college:updated', { id: saved.id }); } catch {}
    return saved;
  }

  async remove(id: string) {
    const c = await this.findById(id);
    await this.repo.remove(c);
    try { this.events.emitToRole('SUPER_ADMIN', 'college:deleted', { id }); } catch {}
    return { ok: true };
  }
}
