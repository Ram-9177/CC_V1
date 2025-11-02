import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CollegesService } from './colleges.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';

@ApiTags('colleges')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@Controller('colleges')
export class CollegesController {
  constructor(private readonly svc: CollegesService) {}

  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Get()
  @ApiQuery({ name: 'tenantId', required: false })
  list(@Query('tenantId') tenantId?: string) { return this.svc.findAll({ tenantId }); }

  @Get(':id')
  get(@Param('id') id: string) { return this.svc.findById(id); }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: any) { return this.svc.update(id, body); }

  @Delete(':id')
  del(@Param('id') id: string) { return this.svc.remove(id); }
}
