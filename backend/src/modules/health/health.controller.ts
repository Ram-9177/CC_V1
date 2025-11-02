import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  private readonly startedAt = Date.now();
  constructor(private readonly dataSource: DataSource) {}

  @Get()
  async get() {
    const now = Date.now();
    let db = 'unknown';
    try {
      // simple lightweight query
      await this.dataSource.query('SELECT 1');
      db = 'ok';
    } catch {
      db = 'error';
    }
    return {
      status: 'ok',
      time: new Date(now).toISOString(),
      uptimeSec: Math.floor((now - this.startedAt) / 1000),
      db,
    };
  }
}
