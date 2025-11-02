import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GatePass, GatePassStatus } from '../gate-passes/entities/gate-pass.entity';
import { AttendanceRecord } from '../attendance/entities/attendance-record.entity';
import { AttendanceSession } from '../attendance/entities/attendance-session.entity';

@Injectable()
export class ReportsService {
  constructor(
    @InjectRepository(GatePass) private readonly gatePassRepo: Repository<GatePass>,
    @InjectRepository(AttendanceRecord) private readonly attendanceRecordRepo: Repository<AttendanceRecord>,
    @InjectRepository(AttendanceSession) private readonly attendanceSessionRepo: Repository<AttendanceSession>
  ) {}

  // Gate Passes: total count and breakdown by status in an optional date range
  async getGatePassStats(opts: { from?: string; to?: string }) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;

    const whereParts: string[] = [];
    const params: Record<string, any> = {};
    if (from) {
      whereParts.push('gp.createdAt >= :from');
      params.from = from;
    }
    if (to) {
      whereParts.push('gp.createdAt <= :to');
      params.to = to;
    }

    const baseQb = this.gatePassRepo.createQueryBuilder('gp');
    if (whereParts.length) baseQb.where(whereParts.join(' AND '), params);

    const total = await baseQb.clone().getCount();
    const rows = await baseQb
      .clone()
      .select('gp.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('gp.status')
      .getRawMany<{ status: GatePassStatus; count: string }>();

    const byStatus: Record<string, number> = {};
    rows.forEach((r) => (byStatus[r.status] = Number(r.count)));

    return { total, byStatus };
  }

  // Attendance: sessions, records, and breakdown by record status in an optional date range
  async getAttendanceSummary(opts: { from?: string; to?: string }) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;

    const sessionQb = this.attendanceSessionRepo.createQueryBuilder('s');
    const recordQb = this.attendanceRecordRepo.createQueryBuilder('r');

    if (from) {
      sessionQb.andWhere('s.createdAt >= :from', { from });
      recordQb.andWhere('r.markedAt >= :from', { from });
    }
    if (to) {
      sessionQb.andWhere('s.createdAt <= :to', { to });
      recordQb.andWhere('r.markedAt <= :to', { to });
    }

    const [sessions, records, rows] = await Promise.all([
      sessionQb.getCount(),
      recordQb.getCount(),
      recordQb
        .clone()
        .select('r.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('r.status')
        .getRawMany<{ status: string; count: string }>()
    ]);

    const byStatus: Record<string, number> = {};
    rows.forEach((r) => (byStatus[r.status] = Number(r.count)));

    return { sessions, records, byStatus };
  }

  private normalizeGranularity(g?: string): 'day' | 'week' | 'month' {
    const val = (g || 'day').toLowerCase();
    if (val === 'week' || val === 'month') return val;
    return 'day';
  }

  async getGatePassTimeSeries(opts: { from?: string; to?: string; granularity?: string }) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;
    const gran = this.normalizeGranularity(opts.granularity);

    const qb = this.gatePassRepo.createQueryBuilder('gp');
    if (from) qb.andWhere('gp.createdAt >= :from', { from });
    if (to) qb.andWhere('gp.createdAt <= :to', { to });

    const rows = await qb
      .select(`DATE_TRUNC('${gran}', gp.createdAt)`, 'bucket')
      .addSelect('COUNT(*)', 'count')
      .groupBy('bucket')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: string; count: string }>();

    return rows.map((r) => ({ bucket: r.bucket, count: Number(r.count) }));
  }

  async getAttendanceTimeSeries(opts: { from?: string; to?: string; granularity?: string }) {
    const from = opts.from ? new Date(opts.from) : undefined;
    const to = opts.to ? new Date(opts.to) : undefined;
    const gran = this.normalizeGranularity(opts.granularity);

    const sessQb = this.attendanceSessionRepo.createQueryBuilder('s');
    if (from) sessQb.andWhere('s.createdAt >= :from', { from });
    if (to) sessQb.andWhere('s.createdAt <= :to', { to });

    const recQb = this.attendanceRecordRepo.createQueryBuilder('r');
    if (from) recQb.andWhere('r.markedAt >= :from', { from });
    if (to) recQb.andWhere('r.markedAt <= :to', { to });

    const [sessions, records] = await Promise.all([
      sessQb
        .select(`DATE_TRUNC('${gran}', s.createdAt)`, 'bucket')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: string; count: string }>(),
      recQb
        .select(`DATE_TRUNC('${gran}', r.markedAt)`, 'bucket')
        .addSelect('COUNT(*)', 'count')
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: string; count: string }>()
    ]);

    return {
      sessions: sessions.map((r) => ({ bucket: r.bucket, count: Number(r.count) })),
      records: records.map((r) => ({ bucket: r.bucket, count: Number(r.count) }))
    };
  }
}
