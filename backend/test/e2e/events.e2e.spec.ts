import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { EventsService } from '../../src/modules/events/events.service';
import { EventsGateway } from '../../src/modules/events/events.gateway';
import { io, Socket } from 'socket.io-client';

describe('WebSocket Rooms and Role Emits (e2e)', () => {
  let app: INestApplication;
  let port: number;
  let eventsService: EventsService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: process.env.JWT_SECRET || 'keyboardcat',
        }),
      ],
      providers: [EventsService, EventsGateway],
    }).compile();

    app = moduleFixture.createNestApplication();
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.init();
    const server = await app.listen(0);
    // @ts-ignore - get actual port
    port = server.address().port;
    eventsService = app.get(EventsService);
  });

  afterAll(async () => {
    await app?.close();
  });

  function makeToken(payload: any) {
    const jwt = new JwtService({});
    // Gateway verifies with process.env.JWT_SECRET || 'keyboardcat'
    return jwt.sign(payload, { secret: process.env.JWT_SECRET || 'keyboardcat' });
  }

  it('joins role room and receives targeted role emit', async () => {
  const token = makeToken({ sub: 'chef-1', role: 'CHEF' });
    const url = `http://127.0.0.1:${port}`;

    const client: Socket = io(url, {
      transports: ['websocket'],
      auth: { token },
      forceNew: true,
      autoConnect: true,
    });

    // Promise that resolves when client receives the event
    const received = new Promise<{ mealType: string }>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('timeout')), 5000);
      client.on('meals.intent.updated', (data: any) => {
        clearTimeout(timeout);
        resolve(data);
      });
    });

    // Wait for connect then emit to CHEF role
    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => resolve());
      client.on('connect_error', (e: any) => reject(e));
    });

    eventsService.emitToRole('CHEF', 'meals.intent.updated', { mealType: 'LUNCH' });

    const data = await received;
    expect(data.mealType).toBe('LUNCH');

    client.disconnect();
  }, 15000);
});
