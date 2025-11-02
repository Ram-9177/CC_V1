import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AttendanceController } from '../../src/modules/attendance/attendance.controller';
import { AttendanceService } from '../../src/modules/attendance/attendance.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { FeatureGuard } from '../../src/common/guards/feature.guard';
import request from 'supertest';

class AttendanceServiceMock {
  listSessions = jest.fn(async () => ({ data: [], total: 0, page: 1, pageSize: 10 }));
  exportSessions = jest.fn(async () => 'id,title,status,mode,sessionType,scheduledAt,startedAt,endedAt,createdAt,totalExpected,totalPresent,totalAbsent\n');
}

describe('Attendance endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [AttendanceController],
      providers: [
        { provide: AttendanceService, useClass: AttendanceServiceMock },
      ],
    })
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
  .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
  .overrideGuard(FeatureGuard).useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /attendance/sessions lists sessions', async () => {
    const res = await request(app.getHttpServer())
      .get('/attendance/sessions')
      .expect(200);
    expect(res.body).toHaveProperty('data');
    expect(res.body).toHaveProperty('total');
  });

  it('GET /attendance/sessions/export returns CSV', async () => {
    const res = await request(app.getHttpServer())
      .get('/attendance/sessions/export')
      .set('Accept', 'text/csv')
      .expect(200);
    expect(res.text.startsWith('id,title,status,mode,sessionType')).toBe(true);
  });
});
