import { Body, Controller, Delete, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';

@ApiTags('Notices')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notices')
export class NoticesController {
  constructor(private readonly svc: NoticesService) {}

  @UseGuards(RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @Post()
  create(@Req() req: any, @Body() dto: CreateNoticeDto) {
    return this.svc.create(req.user.id, dto);
  }

  // Returns notices targeted to the current user (role/hostel/block), excluding expired
  @Get()
  myNotices(@Req() req: any) {
    return this.svc.listForUser(req.user);
  }

  // Admin/author listing with filters
  @UseGuards(RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @Get('all')
  findAll(
    @Query('role') role?: string,
    @Query('hostelId') hostelId?: string,
    @Query('blockId') blockId?: string,
    @Query('includeExpired') includeExpired?: any,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.findAll({ role, hostelId, blockId, includeExpired: includeExpired === 'true', q, limit: limit ? parseInt(limit, 10) : undefined, offset: offset ? parseInt(offset, 10) : undefined });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @UseGuards(RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateNoticeDto) {
    return this.svc.update(id, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.svc.remove(id);
  }

  // Mark all visible notices as read for current user
  @Post('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.svc.markAllRead(req.user);
  }

  // Mark a single notice as read for current user
  @Post(':id/mark-read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.svc.markRead(req.user, id);
  }

  // Mark a single notice as unread for current user
  @Post(':id/mark-unread')
  async markUnread(@Req() req: any, @Param('id') id: string) {
    return this.svc.markUnread(req.user, id);
  }

  // Count of unread notices for current user
  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.svc.unreadCount(req.user);
  }

  // Aggregate counts for admin/author with filters
  @UseGuards(RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','CHEF','SUPER_ADMIN')
  @Get('counts')
  counts(
    @Query('role') role?: string,
    @Query('hostelId') hostelId?: string,
    @Query('blockId') blockId?: string,
    @Query('includeExpired') includeExpired?: any,
    @Query('q') q?: string,
  ) {
    return this.svc.counts({ role, hostelId, blockId, includeExpired: includeExpired === 'true', q });
  }
}
