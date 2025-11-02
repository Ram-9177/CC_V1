import { Body, Controller, Post, UseGuards, Req, Get, Query } from '@nestjs/common';
import { GateScansService } from './gate-scans.service';
import { CreateGateScanDto } from './dto/create-gate-scan.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('gate-scans')
export class GateScansController {
  constructor(private readonly service: GateScansService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@Req() req: any, @Body() dto: CreateGateScanDto) {
    const user = req.user;
    return this.service.create(user.id, dto as any);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async list(@Query() query: any) {
    return this.service.list(query);
  }
}
