import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../../src/modules/users/users.module';
import { AuthModule } from '../../src/modules/auth/auth.module';
import { AttendanceModule } from '../../src/modules/attendance/attendance.module';
import { GatePassesModule } from '../../src/modules/gate-passes/gate-passes.module';
import { GateScansModule } from '../../src/modules/gate-scans/gate-scans.module';
import { EventsModule } from '../../src/modules/events/events.module';
import { UsersService } from '../../src/modules/users/users.service';
import { AuthService } from '../../src/modules/auth/auth.service';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { GatePassesService } from '../../src/modules/gate-passes/gate-passes.service';

describe('E2E core flows (in-memory sqlite)', () => {
  let usersService: UsersService;
  let authService: AuthService;
  let attendanceService: AttendanceService;
  let gatePassesService: GatePassesService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
          synchronize: true,
          dropSchema: true
        }),
        UsersModule,
        AuthModule,
        AttendanceModule,
        GatePassesModule,
        GateScansModule,
        EventsModule
      ]
    }).compile();

    usersService = moduleRef.get(UsersService);
    authService = moduleRef.get(AuthService);
    attendanceService = moduleRef.get(AttendanceService);
    gatePassesService = moduleRef.get(GatePassesService);
  });

  it('creates a user, logs in, creates session and gate-pass', async () => {
    const createDto = { hallticket: 'HT123', password: 'pass123', firstName: 'Test', lastName: 'User' };
    const user = await usersService.create(createDto as any);
    expect(user).toBeDefined();
    const login = await authService.login({ id: user.id, hallticket: user.hallticket } as any);
    expect(login.accessToken).toBeDefined();

    const session = await attendanceService.createSession(user.id, { title: 'Lecture', from: new Date().toISOString(), to: new Date().toISOString() } as any);
    expect(session).toBeDefined();

    const pass = await gatePassesService.create(user.id, { reason: 'Home', destination: 'City', fromDate: new Date().toISOString(), toDate: new Date().toISOString(), isEmergency: false } as any);
    expect(pass).toBeDefined();
  }, 20000);
});
