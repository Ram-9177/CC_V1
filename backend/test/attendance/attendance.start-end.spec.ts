import { AttendanceService } from '../../src/modules/attendance/attendance.service';

jest.mock('qrcode', () => ({
  toDataURL: jest.fn().mockResolvedValue('data:image/png;base64,qr')
}));

function mockRepo() {
  return {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      getManyAndCount: jest.fn().mockResolvedValue([[], 0])
    }))
  } as any;
}

describe('AttendanceService start/end', () => {
  let service: AttendanceService;
  let sessionsRepo: any;
  let recordsRepo: any;
  let usersService: any;
  let eventsService: any;
  let notifications: any;

  beforeEach(() => {
    sessionsRepo = mockRepo();
    recordsRepo = mockRepo();
    usersService = { findById: jest.fn() } as any;
    eventsService = { emitToRoles: jest.fn() } as any;
    notifications = { sendToTopic: jest.fn(), sendToDevice: jest.fn() } as any;
    // @ts-ignore
    service = new AttendanceService(sessionsRepo, recordsRepo, usersService, eventsService, notifications);
  });

  it('starts a MIXED session and generates QR', async () => {
    const session = { id: 's1', status: 'SCHEDULED', mode: 'MIXED' } as any;
    sessionsRepo.findOne.mockResolvedValue(session);
    sessionsRepo.save.mockImplementation(async (s: any) => s);
    const res = await service.startSession('s1');
    expect(res.status).toBe('ACTIVE');
    expect(res.startedAt).toBeInstanceOf(Date);
    expect(res.qrCode).toMatch(/^data:image\/png;base64/);
    expect(eventsService.emitToRoles).toHaveBeenCalledWith(['WARDEN','WARDEN_HEAD'], 'attendance:session-started', expect.any(Object));
  });

  it('ends a session and emits ended event with summary', async () => {
    const session = { id: 's1', status: 'ACTIVE', mode: 'MIXED', totalPresent: 0, totalAbsent: 0 } as any;
    sessionsRepo.findOne.mockResolvedValue(session);
    recordsRepo.count
      .mockResolvedValueOnce(5) // present
      .mockResolvedValueOnce(8); // total
    sessionsRepo.save.mockImplementation(async (s: any) => s);
    const res: any = await service.endSession('s1');
    expect(res.status).toBe('COMPLETED');
    expect(res.summary.totalPresent).toBe(5);
    expect(res.summary.totalAbsent).toBe(3);
    expect(typeof res.summary.attendanceRate).toBe('number');
    expect(eventsService.emitToRoles).toHaveBeenCalledWith(['WARDEN','WARDEN_HEAD'], 'attendance:session-ended', expect.any(Object));
  });
});
