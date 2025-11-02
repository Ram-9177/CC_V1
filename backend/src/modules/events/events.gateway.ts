import { WebSocketGateway, WebSocketServer, OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect } from '@nestjs/websockets';
import { Server } from 'socket.io';
import { EventsService } from './events.service';
import { JwtService } from '@nestjs/jwt';

type SocketClient = any;

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  constructor(private readonly eventsService: EventsService, private readonly jwtService: JwtService) {}

  afterInit(server: Server) {
    // Wire the server into EventsService for centralized emits
    this.eventsService.setServer(server);
  }

  async handleConnection(client: SocketClient) {
    // Expect token in handshake.auth.token or Authorization header
    const token = client.handshake?.auth?.token || (client.handshake?.headers?.authorization || '').split(' ')[1];
    if (!token) {
      client.disconnect(true);
      return;
    }
    try {
      const payload = this.jwtService.verify(token, { secret: process.env.JWT_SECRET || 'keyboardcat' });
      // attach user payload to socket
      client.data = client.data || {};
      client.data.user = payload;

      // auto-join role and user rooms for targeted broadcasts
      const role = client.data.user?.role;
      const userId = client.data.user?.id || client.data.user?.sub || client.data.user?.userId;
      if (role) client.join(`role:${role}`);
      if (userId) client.join(`user:${userId}`);

      // allow clients to request joining rooms but enforce role checks
      client.on('joinRoom', (payload: any) => {
        try {
          const { room, roles } = payload || {};
          const role = client.data.user?.role;
          if (!room) return;
          if (Array.isArray(roles) && roles.length > 0) {
            if (!role || !roles.includes(role)) {
              client.emit('error', { message: 'forbidden' });
              return;
            }
          }
          client.join(room);
          client.emit('joined', { room });
        } catch {
          // ignore
        }
      });
    } catch {
      // invalid token
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: SocketClient) {
    // noop for now - future: cleanup
  }
}
