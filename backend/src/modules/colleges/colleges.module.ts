import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { College } from './entities/college.entity';
import { CollegesService } from './colleges.service';
import { CollegesController } from './colleges.controller';
import { Tenant } from '../tenants/entities/tenant.entity';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([College, Tenant]), EventsModule],
  providers: [CollegesService],
  controllers: [CollegesController],
  exports: [TypeOrmModule]
})
export class CollegesModule {}
