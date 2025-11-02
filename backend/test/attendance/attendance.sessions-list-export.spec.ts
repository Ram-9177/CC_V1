import { AttendanceService } from '../../src/modules/attendance/attendance.service';

function chainableQB<T extends object>(data: any[], total?: number) {
  const qb: any = {
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, total ?? data.length]),
    getMany: jest.fn().mockResolvedValue(data),
  };
  return qb;
}

function mockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn()
  } as any;
}

describe('AttendanceService list/export sessions', () => {
  let service: AttendanceService;
  let sessionsRepo: any;
  let recordsRepo: any;

  beforeEach(() => {
    sessionsRepo = mockRepo();
    recordsRepo = mockRepo();
    const usersService: any = { findById: jest.fn() };
    const eventsService: any = { emitToRoles: jest.fn(), emitToRoom: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn(), sendToDevice: jest.fn() };
    // @ts-ignore
    service = new AttendanceService(sessionsRepo, recordsRepo, usersService, eventsService, notifications);
  });

  it('lists sessions with pagination and sorting', async () => {
    const items = [
      { id: 's1', title: 'Morning Roll', createdAt: new Date(), scheduledAt: new Date(), status: 'SCHEDULED' },
      { id: 's2', title: 'Evening Roll', createdAt: new Date(), scheduledAt: new Date(), status: 'ACTIVE' },
    ];
    const qb = chainableQB(items, 2);
    sessionsRepo.createQueryBuilder.mockReturnValue(qb);

    const res: any = await service.listSessions({ page: '1', pageSize: '10', sortBy: 'createdAt', sortDir: 'DESC' });
    expect(sessionsRepo.createQueryBuilder).toHaveBeenCalledWith('s');
    expect(qb.orderBy).toHaveBeenCalled();
    expect(qb.skip).toHaveBeenCalledWith(0);
    expect(qb.take).toHaveBeenCalledWith(10);
    expect(res.total).toBe(2);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('exports sessions as CSV with header and quoted values', async () => {
    const now = new Date();
    const items = [
      { id: 's1', title: 'Morning', status: 'COMPLETED', mode: 'QR', sessionType: 'ROLL', scheduledAt: now, startedAt: now, endedAt: now, createdAt: now, totalExpected: 10, totalPresent: 7 },
    ];
    const qb = chainableQB(items);
    sessionsRepo.createQueryBuilder.mockReturnValue(qb);

    const csv = await service.exportSessions({});
    expect(typeof csv).toBe('string');
    expect(csv.split('\n')[0]).toMatch(/^id,title,status,mode,sessionType/);
    expect(csv).toContain('"Morning"');
    expect(csv).toContain('"COMPLETED"');
  });
});
