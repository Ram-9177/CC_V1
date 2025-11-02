import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FeatureFlag } from './entities/feature-flag.entity';
import { FeaturesService } from './features.service';
import { FeaturesController } from './features.controller';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([FeatureFlag]), EventsModule],
  providers: [FeaturesService],
  controllers: [FeaturesController],
  exports: [FeaturesService]
})
export class FeaturesModule {}
