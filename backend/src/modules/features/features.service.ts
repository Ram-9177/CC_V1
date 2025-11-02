import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeatureFlag, FeatureScope } from './entities/feature-flag.entity';
import { EventsService } from '../events/events.service';

@Injectable()
export class FeaturesService {
  constructor(
    @InjectRepository(FeatureFlag) private readonly repo: Repository<FeatureFlag>,
    private readonly events: EventsService
  ) {}

  list(scope: FeatureScope, scopeId: string) {
    return this.repo.find({ where: { scope, scopeId } });
  }

  async upsert(scope: FeatureScope, scopeId: string, key: string, enabled: boolean, config?: any) {
    let flag = await this.repo.findOne({ where: { scope, scopeId, key } });
    if (!flag) {
      flag = this.repo.create({ scope, scopeId, key, enabled, config: config ?? null });
    } else {
      flag.enabled = enabled;
      flag.config = config ?? flag.config ?? null;
    }
    const saved = await this.repo.save(flag);
    try { this.events.emitToRole('SUPER_ADMIN', 'feature:updated', { scope, scopeId, key, enabled }); } catch {}
    return saved;
  }

  async remove(id: string) {
    const f = await this.repo.findOne({ where: { id } });
    if (!f) throw new NotFoundException('Flag not found');
    await this.repo.remove(f);
    try { this.events.emitToRole('SUPER_ADMIN', 'feature:updated', { scope: f.scope, scopeId: f.scopeId, key: f.key, enabled: null }); } catch {}
    return { ok: true };
  }

  async isEnabled(params: { key: string; collegeId?: string; tenantId?: string }): Promise<boolean> {
    const { key, collegeId, tenantId } = params;
    // priority: college flag, fallback to tenant flag, default true if none
    if (collegeId) {
      const byCollege = await this.repo.findOne({ where: { scope: 'COLLEGE', scopeId: collegeId, key } });
      if (byCollege) return !!byCollege.enabled;
    }
    if (tenantId) {
      const byTenant = await this.repo.findOne({ where: { scope: 'TENANT', scopeId: tenantId, key } });
      if (byTenant) return !!byTenant.enabled;
    }
    return true;
  }
}
