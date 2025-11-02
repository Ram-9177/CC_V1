import { Injectable } from '@nestjs/common';
import { Server } from 'socket.io';

@Injectable()
export class EventsService {
  private server?: Server;

  setServer(server: Server) {
    this.server = server;
  }

  emit(event: string, payload?: any) {
    if (this.server) {
      this.server.emit(event, payload);
      return true;
    }
    // fallback/no-op while server isn't wired (keeps tests deterministic)
     
    console.log('[EventsService] (no server) emit', event);
    return false;
  }

  emitToRoom(room: string, event: string, payload?: any) {
    if (!this.server) return false;
    this.server.to(room).emit(event, payload);
    return true;
  }

  emitToRole(role: string, event: string, payload?: any) {
    return this.emitToRoom(`role:${role}`, event, payload);
  }

  emitToRoles(roles: string[], event: string, payload?: any) {
    if (!this.server) return false;
    roles.forEach((r) => this.server!.to(`role:${r}`).emit(event, payload));
    return true;
  }
}
