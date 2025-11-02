import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GatePass } from './entities/gate-pass.entity';
import { GatePassesService } from './gate-passes.service';
import { GatePassesController } from './gate-passes.controller';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../events/events.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [TypeOrmModule.forFeature([GatePass]), UsersModule, EventsModule, NotificationsModule],
  providers: [GatePassesService],
  controllers: [GatePassesController]
})
export class GatePassesModule {}

