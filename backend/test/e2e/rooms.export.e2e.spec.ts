import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { RoomsController } from '../../src/modules/rooms/rooms.controller';
import { RoomsService } from '../../src/modules/rooms/rooms.service';
import { UsersService } from '../../src/modules/users/users.service';
import { JwtAuthGuard } from '../../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../src/common/guards/roles.guard';
import request from 'supertest';

class RoomsServiceMock {
  exportAllRoomsCsv = jest.fn(async () => 'id,block,number,floor,capacity,occupants,available\n');
  exportAllOccupantsCsv = jest.fn(async () => 'roomId,block,number,floor,capacity,hallticket,firstName,lastName,bedLabel\n');
}

describe('Rooms export endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleBuilder = Test.createTestingModule({
  controllers: [RoomsController],
  providers: [ { provide: RoomsService, useClass: RoomsServiceMock }, { provide: UsersService, useValue: { findByHallticket: jest.fn() } } ],
    })
    .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
    .overrideGuard(RolesGuard).useValue({ canActivate: () => true });

    const moduleFixture: TestingModule = await moduleBuilder.compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('GET /rooms/export returns CSV', async () => {
    const res = await request(app.getHttpServer())
      .get('/rooms/export')
      .set('Accept', 'text/csv')
      .expect(200);
    expect(res.text.startsWith('id,block,number,floor,capacity,occupants,available')).toBe(true);
  });

  it('GET /rooms/occupants/export returns CSV', async () => {
    const res = await request(app.getHttpServer())
      .get('/rooms/occupants/export')
      .set('Accept', 'text/csv')
      .expect(200);
    expect(res.text.startsWith('roomId,block,number,floor,capacity,hallticket,firstName,lastName,bedLabel')).toBe(true);
  });
});
