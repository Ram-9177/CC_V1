import { Body, Controller, ForbiddenException, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { GatePassesService } from './gate-passes.service';
import { CreateGatePassDto } from './dto/create-gate-pass.dto';
import { ApproveGatePassDto } from './dto/approve-gate-pass.dto';
import { RejectGatePassDto } from './dto/reject-gate-pass.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Throttle } from '@nestjs/throttler';
import { Feature } from '../../common/decorators/feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';

@Controller('gate-passes')
export class GatePassesController {
  constructor(private readonly service: GatePassesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('gatePass')
  async create(@Req() req: any, @Body() dto: CreateGatePassDto) {
    const user = req.user;
    return this.service.create(user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('gatePass')
  async list(@Query() query: any) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('gatePass')
  async get(@Param('id') id: string, @Req() req: any) {
    const me = req.user as any;
    const pass = await this.service.findById(id) as any;
    // Hide QR code from student until ad is watched and pass approved
    const isOwnerStudent = me && pass?.student?.id === me.id && (me.role === 'STUDENT');
    if (isOwnerStudent) {
      const adWatched = !!pass.adWatchedAt;
      const approved = pass.status === 'APPROVED';
      if (!adWatched || !approved) {
        delete pass.qrCode;
      }
    }
    return pass;
  }

  @Put(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
  @Feature('gatePass')
  @Roles('WARDEN','WARDEN_HEAD')
  async approve(@Param('id') id: string, @Req() req: any, @Body() dto: ApproveGatePassDto) {
    const user = req.user;
    return this.service.approve(id, user.id, dto as any);
  }

  @Put(':id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
  @Feature('gatePass')
  @Roles('WARDEN','WARDEN_HEAD')
  async reject(@Param('id') id: string, @Req() req: any, @Body() dto: RejectGatePassDto) {
    const user = req.user;
    return this.service.reject(id, user.id, dto as any);
  }

  @Put(':id/watch-ad')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('gatePass')
  @Throttle({ default: { limit: 5, ttl: 60 } })
  async watchAd(@Param('id') id: string, @Req() req: any, @Body() body: any) {
    const user = req.user;
    const duration = typeof body?.watchedDuration === 'number' && body.watchedDuration > 0
      ? body.watchedDuration
      : 20; // default 20s for non-skippable ad
    return this.service.watchAd(id, user.id, duration);
  }

  @Put(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
  @Feature('gatePass')
  @Roles('WARDEN','SUPER_ADMIN')
  async revoke(@Param('id') id: string, @Req() req: any, @Body() body: { reason?: string }) {
    const user = req.user;
    return this.service.revoke(id, user.id, body);
  }

  @Get(':id/qr')
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('gatePass')
  @Throttle({ default: { limit: 10, ttl: 60 } })
  async getQr(@Param('id') id: string, @Req() req: any) {
    const me = req.user as any;
    const pass = await this.service.findById(id) as any;
    if (!pass) throw new ForbiddenException();
    const isOwner = pass.student?.id === me?.id;
    if (!isOwner && me?.role !== 'WARDEN' && me?.role !== 'WARDEN_HEAD' && me?.role !== 'GATEMAN' && me?.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException();
    }
    const approved = pass.status === 'APPROVED';
    const adWatched = !!pass.adWatchedAt;
    if (!approved || !adWatched) throw new ForbiddenException('Ad not watched or pass not approved');
    // Return both keys for client compatibility
    return { qrCode: pass.qrCode, qr: pass.qrCode };
  }
}
