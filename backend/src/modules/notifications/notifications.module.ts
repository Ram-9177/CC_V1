import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationAudit, DeviceToken } from './entities';
import { NotificationsController } from './notifications.controller';

@Module({
  imports: [TypeOrmModule.forFeature([NotificationAudit, DeviceToken])],
  providers: [NotificationService],
  controllers: [NotificationsController],
  exports: [NotificationService]
})
export class NotificationsModule {}
