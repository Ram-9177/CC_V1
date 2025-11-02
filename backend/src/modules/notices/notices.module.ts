import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notice } from './entities/notice.entity';
import { NoticeRead } from './entities/notice-read.entity';
import { NoticesService } from './notices.service';
import { NoticesController } from './notices.controller';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([Notice, NoticeRead]), UsersModule, EventsModule, NotificationsModule],
  controllers: [NoticesController],
  providers: [NoticesService],
})
export class NoticesModule {}
