import { AttendanceService } from '../../src/modules/attendance/attendance.service';

const mockRepo = () => ({ create: jest.fn(), save: jest.fn(), findOne: jest.fn(), createQueryBuilder: jest.fn(() => ({ getManyAndCount: jest.fn().mockResolvedValue([[], 0]) })) });
const mockUsersService = () => ({ findById: jest.fn() });
const mockEventsService = () => ({ emit: jest.fn() });

describe('AttendanceService', () => {
  let service: AttendanceService;
  let sessionsRepo: any;
  let recordsRepo: any;
  let usersService: any;

  beforeEach(() => {
    sessionsRepo = mockRepo();
    recordsRepo = mockRepo();
  usersService = mockUsersService();
  const eventsService = mockEventsService();
  // @ts-ignore
  service = new AttendanceService(sessionsRepo, recordsRepo, usersService, eventsService);
  });

  it('creates a session and generates a QR', async () => {
    usersService.findById.mockResolvedValue({ id: 'u1' });
  sessionsRepo.create.mockReturnValue({});
  sessionsRepo.save.mockResolvedValue({ id: 's1' });
  const dto = { title: 'Lecture', from: new Date().toISOString(), to: new Date(Date.now() + 60000).toISOString() };
    const result = await service.createSession('u1', dto as any);
    expect(sessionsRepo.create).toHaveBeenCalled();
    expect(sessionsRepo.save).toHaveBeenCalled();
  });

  it('joins a session', async () => {
    usersService.findById.mockResolvedValue({ id: 'u1' });
  sessionsRepo.findOne.mockResolvedValue({ id: 's1' });
  recordsRepo.findOne.mockResolvedValue(null);
  recordsRepo.create.mockReturnValue({});
  recordsRepo.save.mockResolvedValue({ id: 'r1' });
    const res = await service.joinSession('u1', 's1');
    expect(recordsRepo.create).toHaveBeenCalled();
    expect(recordsRepo.save).toHaveBeenCalled();
  });
});
