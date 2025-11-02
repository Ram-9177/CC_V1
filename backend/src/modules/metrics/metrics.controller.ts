import { Controller, Get, Header } from '@nestjs/common';

// Lazy-load prom-client if available to avoid hard dependency
let prom: any = null;
let register: any = null;
try {
   
  prom = require('prom-client');
  register = new prom.Registry();
  prom.collectDefaultMetrics({ register });
} catch {
  prom = null;
  register = null;
}

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', 'text/plain; version=0.0.4')
  async metrics(): Promise<string> {
    if (register && prom) {
      return register.metrics();
    }
    // Minimal fallback text exposition format
    const uptime = Math.floor(process.uptime());
    return `# HELP app_uptime_seconds Uptime of the Node.js process\n# TYPE app_uptime_seconds gauge\napp_uptime_seconds ${uptime}\n`;
  }
}
