import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GateScan } from './entities/gate-scan.entity';
import { GateScansService } from './gate-scans.service';
import { GateScansController } from './gate-scans.controller';
import { GatePass } from '../gate-passes/entities/gate-pass.entity';
import { UsersModule } from '../users/users.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([GateScan, GatePass]), UsersModule, EventsModule],
  providers: [GateScansService],
  controllers: [GateScansController]
})
export class GateScansModule {}
