import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Tenant } from './entities/tenant.entity';
import { TenantsService } from './tenants.service';
import { TenantsController } from './tenants.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([Tenant]), EventsModule],
  providers: [TenantsService],
  controllers: [TenantsController],
  exports: [TypeOrmModule]
})
export class TenantsModule {}
