import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import databaseConfig from './config/database.config';
import { UsersModule } from './modules/users/users.module';
import { AuthModule } from './modules/auth/auth.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { GatePassesModule } from './modules/gate-passes/gate-passes.module';
import { EventsModule } from './modules/events/events.module';
import { ScheduledTasksService } from './tasks/scheduled-tasks.service';
import { MealsModule } from './modules/meals/meals.module';
import { NoticesModule } from './modules/notices/notices.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { HealthModule } from './modules/health/health.module';
import { MetricsModule } from './modules/metrics/metrics.module';
import { GatePass } from './modules/gate-passes/entities/gate-pass.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [databaseConfig] }),
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5432', 10),
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'password',
        database: process.env.DB_NAME || 'hostelconnect',
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: (process.env.DB_SYNC === 'true') ? true : false,
        logging: false
      })
    }),
    // Provide repository for scheduled tasks
    TypeOrmModule.forFeature([GatePass]),
  // Core modules
  ThrottlerModule.forRoot({ throttlers: [{ ttl: 60, limit: 20 }] }),
    ScheduleModule.forRoot(),
    UsersModule,
    AuthModule,
  GatePassesModule,
  EventsModule,
    require('./modules/attendance/attendance.module').AttendanceModule,
    require('./modules/notifications/notifications.module').NotificationsModule,
  require('./modules/reports/reports.module').ReportsModule,
    MealsModule,
  NoticesModule,
    require('./modules/gate-scans/gate-scans.module').GateScansModule,
    RoomsModule,
    HealthModule,
    MetricsModule,
    require('./modules/tenants/tenants.module').TenantsModule,
    require('./modules/colleges/colleges.module').CollegesModule,
    require('./modules/features/features.module').FeaturesModule
  ],
  controllers: [],
  providers: [ScheduledTasksService]
})
export class AppModule {}
