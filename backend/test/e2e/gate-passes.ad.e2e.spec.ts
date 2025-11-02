import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GatePassesController } from '../../src/modules/gate-passes/gate-passes.controller';
import { GatePassesService } from '../../src/modules/gate-passes/gate-passes.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { FeatureGuard } from '../../src/common/guards/feature.guard';
import request from 'supertest';

const STUDENT_ID = 'stu1';
const BASE_PASS = {
  id: 'gp1',
  status: 'APPROVED',
  student: { id: STUDENT_ID },
  qrCode: 'data:image/png;base64,qr',
  adWatchedAt: null,
};

class GPServiceMock {
  findById = jest.fn(async (): Promise<any> => ({ ...BASE_PASS }));
  watchAd = jest.fn(async (_id: string, _sid: string, dur: number) => {
    if (dur < 20) return { adWatchedAt: null, qrCodeUnlocked: false };
    return { adWatchedAt: new Date(), qrCodeUnlocked: true, qrCode: 'data:image/png;base64,qr' } as any;
  });
}

describe('GatePass ad gating (e2e)', () => {
  let app: INestApplication;
  let service: GPServiceMock;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [GatePassesController],
      providers: [ { provide: GatePassesService, useClass: GPServiceMock } ],
    })
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: (ctx: any) => { const req = ctx.switchToHttp().getRequest(); req.user = { id: STUDENT_ID, role: 'STUDENT' }; return true; } })
  .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
  .overrideGuard(FeatureGuard).useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    service = app.get(GatePassesService) as any;
  });

  afterAll(async () => { await app?.close(); });

  it('hides qr in GET /gate-passes/:id for student until ad watched', async () => {
    const res = await request(app.getHttpServer()).get('/gate-passes/gp1').expect(200);
    expect(res.body.qrCode).toBeUndefined();
  });

  it('denies /qr until ad watched; then allows', async () => {
    // before watch
    await request(app.getHttpServer()).get('/gate-passes/gp1/qr').expect(403);
    // simulate ad watched by mocking service response with adWatchedAt
  service.findById = jest.fn(async (): Promise<any> => ({ ...BASE_PASS, adWatchedAt: new Date() }));
    const ok = await request(app.getHttpServer()).get('/gate-passes/gp1/qr').expect(200);
    expect(ok.body.qrCode).toBeDefined();
  });
});
