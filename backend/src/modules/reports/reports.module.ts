import { Module } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsController } from './reports.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatePass } from '../gate-passes/entities/gate-pass.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';

@Module({
  imports: [TypeOrmModule.forFeature([GatePass, AttendanceRecord, AttendanceSession])],
  providers: [ReportsService],
  controllers: [ReportsController]
})
export class ReportsModule {}
