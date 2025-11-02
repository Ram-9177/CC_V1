import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { RangeDto } from './dto/range.dto';
import { TimeSeriesDto } from './dto/timeseries.dto';

@ApiTags('Reports')
@ApiBearerAuth()
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('gate-passes')
  @ApiQuery({ name: 'from', required: false, description: 'ISO date for start of range' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date for end of range' })
  async gatePasses(@Query() query: RangeDto) {
    return this.reportsService.getGatePassStats(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('attendance')
  @ApiQuery({ name: 'from', required: false, description: 'ISO date for start of range' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date for end of range' })
  async attendance(@Query() query: RangeDto) {
    return this.reportsService.getAttendanceSummary(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('gate-passes/timeseries')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day','week','month'] })
  async gatePassesTimeSeries(@Query() query: TimeSeriesDto) {
    return this.reportsService.getGatePassTimeSeries(query);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('WARDEN','WARDEN_HEAD','SUPER_ADMIN')
  @Get('attendance/timeseries')
  @ApiQuery({ name: 'from', required: false })
  @ApiQuery({ name: 'to', required: false })
  @ApiQuery({ name: 'granularity', required: false, enum: ['day','week','month'] })
  async attendanceTimeSeries(@Query() query: TimeSeriesDto) {
    return this.reportsService.getAttendanceTimeSeries(query);
  }
}
