import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';
import { EventsService } from '../events/events.service';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant) private readonly repo: Repository<Tenant>,
    private readonly events: EventsService
  ) {}

  create(body: Partial<Tenant>) {
    const t = this.repo.create({
      code: body.code!,
      name: body.name!,
      contactEmail: body.contactEmail,
      contactPhone: body.contactPhone,
      branding: body.branding || null,
      domains: body.domains || null,
    });
    return this.repo.save(t).then((saved) => {
      try { this.events.emitToRole('SUPER_ADMIN', 'tenant:created', { id: saved.id, code: saved.code, name: saved.name }); } catch {}
      return saved;
    });
  }

  findAll() { return this.repo.find(); }

  async findById(id: string) {
    const t = await this.repo.findOne({ where: { id } });
    if (!t) throw new NotFoundException('Tenant not found');
    return t;
  }

  async update(id: string, body: Partial<Tenant>) {
    const t = await this.findById(id);
    Object.assign(t, {
      name: body.name ?? t.name,
      contactEmail: body.contactEmail ?? t.contactEmail,
      contactPhone: body.contactPhone ?? t.contactPhone,
      branding: body.branding ?? t.branding,
      domains: body.domains ?? t.domains,
    });
    const saved = await this.repo.save(t);
    try { this.events.emitToRole('SUPER_ADMIN', 'tenant:updated', { id: saved.id }); } catch {}
    return saved;
  }

  async remove(id: string) {
    const t = await this.findById(id);
    await this.repo.remove(t);
    try { this.events.emitToRole('SUPER_ADMIN', 'tenant:deleted', { id }); } catch {}
    return { ok: true };
  }
}
