import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FEATURES_KEY } from '../decorators/feature.decorator';
import { FeaturesService } from '../../modules/features/features.service';

@Injectable()
export class FeatureGuard implements CanActivate {
  constructor(private reflector: Reflector, private features: FeaturesService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(FEATURES_KEY, [context.getHandler(), context.getClass()]);
    if (!required || required.length === 0) return true;
    const req = context.switchToHttp().getRequest();
    const user = req.user || {};
    // discover tenant/college from user or headers
    const collegeId = user.collegeId || req.headers['x-college-id'];
    const tenantId = user.tenantId || req.headers['x-tenant-id'];
    for (const key of required) {
      const ok = await this.features.isEnabled({ key, collegeId, tenantId });
      if (!ok) throw new ForbiddenException(`Feature '${key}' is disabled`);
    }
    return true;
  }
}
