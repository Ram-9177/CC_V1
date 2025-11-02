import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { AttendanceSession } from './entities/attendance-session.entity';
import { AttendanceRecord } from './entities/attendance-record.entity';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([AttendanceSession, AttendanceRecord]), UsersModule, EventsModule, NotificationsModule],
  providers: [AttendanceService],
  controllers: [AttendanceController]
})
export class AttendanceModule {}
