import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { GatePassesController } from '../../src/modules/gate-passes/gate-passes.controller';
import { GatePassesService } from '../../src/modules/gate-passes/gate-passes.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import { FeatureGuard } from '../../src/common/guards/feature.guard';
import request from 'supertest';

class GPServiceMock {
  create = jest.fn(async () => ({ id: 'gp1', passNumber: 'GP2025XXXX', status: 'PENDING' }));
  findAll = jest.fn(async () => ({ data: [], total: 0 }));
  findById = jest.fn(async () => ({ id: 'gp1', passNumber: 'GP2025XXXX', status: 'PENDING' }));
  approve = jest.fn(async () => ({ id: 'gp1', status: 'APPROVED', qrCode: 'data:image/png;base64,qr' }));
}

describe('GatePasses endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
      controllers: [GatePassesController],
      providers: [ { provide: GatePassesService, useClass: GPServiceMock } ],
    })
  .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
  .overrideGuard(RolesGuard).useValue({ canActivate: () => true })
  .overrideGuard(FeatureGuard).useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();
    app = moduleFixture.createNestApplication();
    // Inject a mock user for routes expecting req.user
    app.use((req: any, _res: any, next: any) => { (req as any).user = { id: 'u1', role: 'WARDEN_HEAD' }; next(); });
    await app.init();
  });

  afterAll(async () => { await app?.close(); });

  it('GET /gate-passes returns list', async () => {
    const res = await request(app.getHttpServer()).get('/gate-passes').expect(200);
    expect(res.body).toHaveProperty('data');
  });

  it('POST /gate-passes creates a gate pass', async () => {
    const res = await request(app.getHttpServer())
      .post('/gate-passes')
      .send({ reason: 'Visit', destination: 'City', fromDate: new Date().toISOString(), toDate: new Date().toISOString() })
      .expect(201);
    expect(res.body).toHaveProperty('id');
  });

  it('PUT /gate-passes/:id/approve approves a pass', async () => {
    const res = await request(app.getHttpServer())
      .put('/gate-passes/gp1/approve')
      .send({ notes: 'ok' })
      .expect(200);
    expect(res.body.status).toBe('APPROVED');
  });
});
