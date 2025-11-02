import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MealMenu } from './entities/meal-menu.entity';
import { MealIntent } from './entities/meal-intent.entity';
import { GatePass } from '../gate-passes/entities/gate-pass.entity';
import { MealsService } from './meals.service';
import { MealsController } from './meals.controller';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [TypeOrmModule.forFeature([MealMenu, MealIntent, GatePass]), UsersModule, NotificationsModule, EventsModule],
  providers: [MealsService],
  controllers: [MealsController]
})
export class MealsModule {}
