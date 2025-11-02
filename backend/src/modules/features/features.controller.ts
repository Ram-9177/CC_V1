import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { FeaturesService } from './features.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('features')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('features')
export class FeaturesController {
  constructor(private readonly svc: FeaturesService) {}

  @Get()
  @ApiQuery({ name: 'scope', required: true, description: 'TENANT | COLLEGE' })
  @ApiQuery({ name: 'scopeId', required: true })
  list(@Query('scope') scope: 'TENANT'|'COLLEGE', @Query('scopeId') scopeId: string) {
    return this.svc.list(scope, scopeId);
  }

  @Post('upsert')
  upsert(@Body() body: { scope: 'TENANT'|'COLLEGE'; scopeId: string; key: string; enabled: boolean; config?: any; }) {
    return this.svc.upsert(body.scope, body.scopeId, body.key, body.enabled, body.config);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.remove(id); }
}
