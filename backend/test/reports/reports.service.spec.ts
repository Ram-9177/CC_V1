import { ReportsService } from '../../src/modules/reports/reports.service';

function makeQB() {
  const state: any = {
    count: 0,
    rows: [] as any[]
  };
  const qb: any = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    clone: jest.fn(function () { return qb; }),
    getCount: jest.fn(async () => state.count),
    getRawMany: jest.fn(async () => state.rows)
  };
  return { qb, state };
}

describe('ReportsService', () => {
  it('returns zeros when no data', async () => {
    const { qb: gpQB, state: gpState } = makeQB();
    const { qb: recQB, state: recState } = makeQB();
    const { qb: sessQB, state: sessState } = makeQB();

    gpState.count = 0; gpState.rows = [];
    recState.count = 0; recState.rows = [];
    sessState.count = 0; sessState.rows = [];

    const gatePassRepo: any = { createQueryBuilder: jest.fn(() => gpQB) };
    const attendanceRecordRepo: any = { createQueryBuilder: jest.fn(() => recQB) };
    const attendanceSessionRepo: any = { createQueryBuilder: jest.fn(() => sessQB) };

    // @ts-ignore private constructor args
    const svc = new ReportsService(gatePassRepo, attendanceRecordRepo, attendanceSessionRepo);

    const gp = await svc.getGatePassStats({});
    expect(gp.total).toBe(0);
    expect(gp.byStatus).toEqual({});

    const att = await svc.getAttendanceSummary({});
    expect(att.sessions).toBe(0);
    expect(att.records).toBe(0);
    expect(att.byStatus).toEqual({});
  });

  it('aggregates gate passes and attendance by status', async () => {
    const { qb: gpQB, state: gpState } = makeQB();
    const { qb: recQB, state: recState } = makeQB();
    const { qb: sessQB, state: sessState } = makeQB();

    gpState.count = 5;
    gpState.rows = [ { status: 'APPROVED', count: '2' }, { status: 'PENDING', count: '3' } ];
    recState.count = 3;
    recState.rows = [ { status: 'PRESENT', count: '2' }, { status: 'ABSENT', count: '1' } ];
    sessState.count = 4;

    const gatePassRepo: any = { createQueryBuilder: jest.fn(() => gpQB) };
    const attendanceRecordRepo: any = { createQueryBuilder: jest.fn(() => recQB) };
    const attendanceSessionRepo: any = { createQueryBuilder: jest.fn(() => sessQB) };

    // @ts-ignore
    const svc = new ReportsService(gatePassRepo, attendanceRecordRepo, attendanceSessionRepo);

    const gp = await svc.getGatePassStats({ from: '2025-01-01', to: '2025-12-31' });
    expect(gp.total).toBe(5);
    expect(gp.byStatus).toEqual({ APPROVED: 2, PENDING: 3 });

    const att = await svc.getAttendanceSummary({ from: '2025-01-01', to: '2025-12-31' });
    expect(att.sessions).toBe(4);
    expect(att.records).toBe(3);
    expect(att.byStatus).toEqual({ PRESENT: 2, ABSENT: 1 });
  });

  it('returns time-series data for gate passes and attendance', async () => {
    // Gate passes
    const gp = makeQB();
    gp.state.rows = [
      { bucket: '2025-01-01T00:00:00.000Z', count: '2' },
      { bucket: '2025-01-02T00:00:00.000Z', count: '3' }
    ];

    // Attendance sessions
    const sess = makeQB();
    sess.state.rows = [
      { bucket: '2025-01-01T00:00:00.000Z', count: '1' },
      { bucket: '2025-01-03T00:00:00.000Z', count: '2' }
    ];

    // Attendance records
    const rec = makeQB();
    rec.state.rows = [
      { bucket: '2025-01-02T00:00:00.000Z', count: '5' }
    ];

    const gatePassRepo: any = { createQueryBuilder: jest.fn(() => gp.qb) };
    const attendanceRecordRepo: any = { createQueryBuilder: jest.fn(() => rec.qb) };
    const attendanceSessionRepo: any = { createQueryBuilder: jest.fn(() => sess.qb) };

    // @ts-ignore
    const svc = new ReportsService(gatePassRepo, attendanceRecordRepo, attendanceSessionRepo);

    const gpTs = await svc.getGatePassTimeSeries({ from: '2025-01-01', to: '2025-01-31', granularity: 'day' });
    expect(gpTs).toEqual([
      { bucket: '2025-01-01T00:00:00.000Z', count: 2 },
      { bucket: '2025-01-02T00:00:00.000Z', count: 3 }
    ]);

    const attTs = await svc.getAttendanceTimeSeries({ from: '2025-01-01', to: '2025-01-31', granularity: 'day' });
    expect(attTs.sessions).toEqual([
      { bucket: '2025-01-01T00:00:00.000Z', count: 1 },
      { bucket: '2025-01-03T00:00:00.000Z', count: 2 }
    ]);
    expect(attTs.records).toEqual([
      { bucket: '2025-01-02T00:00:00.000Z', count: 5 }
    ]);
  });
});
