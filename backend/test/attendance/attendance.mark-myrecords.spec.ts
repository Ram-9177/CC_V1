import { AttendanceService } from '../../src/modules/attendance/attendance.service';

jest.mock('qrcode', () => ({ toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,qr') }));

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

function qbForMyRecords(data: any[]) {
  return {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(data),
  } as any;
}

describe('AttendanceService markAttendance and myRecords', () => {
  let service: AttendanceService;
  let sessionsRepo: any;
  let recordsRepo: any;
  let usersService: any;

  beforeEach(() => {
    sessionsRepo = mockRepo();
    recordsRepo = mockRepo();
    usersService = { findById: jest.fn() } as any;
    const eventsService: any = { emitToRoles: jest.fn(), emitToRoom: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn(), sendToDevice: jest.fn() };
    // @ts-ignore
    service = new AttendanceService(sessionsRepo, recordsRepo, usersService, eventsService, notifications);
  });

  it('marks attendance via MANUAL and prevents marking when session is not active', async () => {
    sessionsRepo.findOne.mockResolvedValue({ id: 's1', status: 'SCHEDULED' });
    await expect(service.markAttendance('warden1', { sessionId: 's1', studentId: 'stu1', method: 'MANUAL', status: 'PRESENT' })).rejects.toBeTruthy();

    sessionsRepo.findOne.mockResolvedValue({ id: 's1', status: 'ACTIVE' });
    usersService.findById.mockImplementation(async (id: string) => ({ id }));
    recordsRepo.findOne.mockResolvedValue(null);
    recordsRepo.create.mockImplementation((o: any) => o);
    recordsRepo.save.mockImplementation(async (o: any) => ({ ...o, id: 'r1' }));
    const res = await service.markAttendance('warden1', { sessionId: 's1', studentId: 'stu1', method: 'MANUAL', status: 'PRESENT' });
    expect(res.id).toBe('r1');
    expect(res.status).toBe('PRESENT');
  });

  it('myRecords returns data with summary', async () => {
    const data = [
      { status: 'PRESENT', markedAt: new Date(), session: {}, student: {} },
      { status: 'ABSENT', markedAt: new Date(), session: {}, student: {} },
      { status: 'PRESENT', markedAt: new Date(), session: {}, student: {} },
    ];
    const qb = qbForMyRecords(data as any);
    recordsRepo.createQueryBuilder.mockReturnValue(qb);
    const res: any = await service.myRecords('u1', {});
    expect(res.summary.totalSessions).toBe(3);
    expect(res.summary.present).toBe(2);
    expect(res.summary.absent).toBe(1);
    expect(typeof res.summary.attendanceRate).toBe('number');
  });
});
