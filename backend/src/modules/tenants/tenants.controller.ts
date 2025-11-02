import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('tenants')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('tenants')
export class TenantsController {
  constructor(private readonly svc: TenantsService) {}

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Get()
  list() { return this.svc.findAll(); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.findById(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  del(@Param('id') id: string) { return this.svc.remove(id); }
}
