import { AttendanceService } from '../../src/modules/attendance/attendance.service';

function chainableQB<T extends object>(data: any[]) {
  const qb: any = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    getManyAndCount: jest.fn().mockResolvedValue([data, data.length]),
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

describe('AttendanceService records listing and export', () => {
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

  it('lists session records with filters and pagination', async () => {
    sessionsRepo.findOne.mockResolvedValue({ id: 's1' });
    const data = [
      { id: 'r1', status: 'PRESENT', markedAt: new Date(), student: { hallticket: 'HT001', firstName: 'A', lastName: 'B' } },
      { id: 'r2', status: 'ABSENT', markedAt: new Date(), student: { hallticket: 'HT002', firstName: 'C', lastName: 'D' } }
    ];
    const qb = chainableQB(data);
    recordsRepo.createQueryBuilder.mockReturnValue(qb);

    const res: any = await service.listSessionRecords('s1', { page: '1', pageSize: '10', sortBy: 'markedAt', sortDir: 'DESC', status: 'PRESENT', search: 'HT001' });
    expect(recordsRepo.createQueryBuilder).toHaveBeenCalledWith('r');
    expect(res.total).toBe(data.length);
    expect(Array.isArray(res.data)).toBe(true);
  });

  it('exports filtered session records as CSV', async () => {
    sessionsRepo.findOne.mockResolvedValue({ id: 's1' });
    const data = [
      { status: 'PRESENT', markedAt: new Date(), method: 'QR', student: { hallticket: 'HT001', firstName: 'A', lastName: 'B' }, markedBy: { hallticket: 'WARDEN1' }},
      { status: 'ABSENT', markedAt: new Date(), method: 'MANUAL', student: { hallticket: 'HT002', firstName: 'C', lastName: 'D' }, markedBy: null },
    ];
    const qb = chainableQB(data);
    recordsRepo.createQueryBuilder.mockReturnValue(qb);

    const csv = await service.exportSessionRecords('s1', { status: 'PRESENT' });
    expect(typeof csv).toBe('string');
    expect(csv.split('\n')[0]).toMatch(/^hallticket,firstName,lastName,status,markedAt,method,markedBy/);
    expect(csv).toContain('"HT001"');
    expect(csv).toContain('"PRESENT"');
  });
});
