import { Controller, Post, Body, UseGuards, Req, Get, Param, Put, Query } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { CreateSessionDto } from './dto/create-session.dto';
import { JoinSessionDto } from './dto/join-session.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiBearerAuth, ApiOkResponse, ApiProduces, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Feature } from '../../common/decorators/feature.decorator';
import { FeatureGuard } from '../../common/guards/feature.guard';

@ApiTags('Attendance')
@ApiBearerAuth()
@Controller('attendance')
export class AttendanceController {
  constructor(private readonly svc: AttendanceService) {}

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Post('sessions')
  async createSession(@Req() req: any, @Body() body: CreateSessionDto) {
    return this.svc.createSession(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Post('join')
  async joinSession(@Req() req: any, @Body() body: JoinSessionDto) {
    return this.svc.joinSession(req.user.id, body.sessionId);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Post('join-by-qr')
  async joinByQr(@Req() req: any, @Body() body: { sessionId: string }) {
    // convenience endpoint: client scans QR (contains sessionId) and posts it
    return this.svc.joinSession(req.user.id, body.sessionId);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('sessions')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false, description: 'createdAt | scheduledAt | status | title' })
  @ApiQuery({ name: 'sortDir', required: false, description: 'ASC | DESC' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' }
      }
    }
  })
  async listSessions(@Query() query: any) {
    return this.svc.listSessions(query);
  }

  // Keep this route before ':id' to avoid matching 'export' as an id
  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('sessions/export')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'date', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'sortBy', required: false, description: 'createdAt | scheduledAt | status | title' })
  @ApiQuery({ name: 'sortDir', required: false, description: 'ASC | DESC' })
  @ApiQuery({ name: 'page', required: false, description: 'Optional: when provided, exports only that page' })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string', example: 'id,title,status,mode,sessionType,scheduledAt,startedAt,endedAt,createdAt,totalExpected,totalPresent,totalAbsent\n...' } })
  async exportSessions(@Query() query: any) {
    return this.svc.exportSessions(query);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('sessions/:id')
  async getSession(@Param('id') id: string) {
    return this.svc.getSession(id);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('sessions/:id/records')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'fromDate', required: false })
  @ApiQuery({ name: 'toDate', required: false })
  @ApiQuery({ name: 'sortBy', required: false, description: 'markedAt | status | hallticket' })
  @ApiQuery({ name: 'sortDir', required: false, description: 'ASC | DESC' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiOkResponse({
    schema: {
      type: 'object',
      properties: {
        data: { type: 'array', items: { type: 'object' } },
        total: { type: 'number' },
        page: { type: 'number' },
        pageSize: { type: 'number' }
      }
    }
  })
  async listRecords(@Param('id') id: string, @Query() query: any) {
    return this.svc.listSessionRecords(id, query);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('sessions/:id/export')
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string', example: 'hallticket,firstName,lastName,status,markedAt,method,markedBy\n...' } })
  async exportFiltered(@Param('id') id: string, @Query() query: any) {
    return this.svc.exportSessionRecords(id, query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
  @Feature('attendance')
  @Roles('WARDEN','WARDEN_HEAD')
  @Put('sessions/:id/start')
  async start(@Param('id') id: string) {
    return this.svc.startSession(id);
  }

  @UseGuards(JwtAuthGuard, RolesGuard, FeatureGuard)
  @Feature('attendance')
  @Roles('WARDEN','WARDEN_HEAD')
  @Put('sessions/:id/end')
  async end(@Param('id') id: string) {
    return this.svc.endSession(id);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Post('mark')
  async mark(@Req() req: any, @Body() body: { sessionId: string; studentId?: string; status?: 'PRESENT'|'ABSENT'|'LATE'|'EXCUSED'; method: 'QR'|'MANUAL' }) {
    return this.svc.markAttendance(req.user.id, body);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('my-records')
  async myRecords(@Req() req: any, @Query() query: { fromDate?: string; toDate?: string }) {
    return this.svc.myRecords(req.user.id, query);
  }

  @UseGuards(JwtAuthGuard, FeatureGuard)
  @Feature('attendance')
  @Get('export')
  @ApiProduces('text/csv')
  @ApiOkResponse({ schema: { type: 'string', example: 'hallticket,firstName,lastName,status,markedAt,method,markedBy\n...' } })
  async export(@Query('sessionId') sessionId: string) {
    const csv = await this.svc.exportCsv(sessionId);
    // Nest can infer content type from string but we'll return an object to allow caller to set header if needed
    return csv;
  }
}
