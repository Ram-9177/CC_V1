import { GateScansService } from '../../src/modules/gate-scans/gate-scans.service';

const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => ({ leftJoinAndSelect: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]) }))
});

const mockUsersService = () => ({ findById: jest.fn() });

describe('GateScansService', () => {
  let service: GateScansService;
  let scansRepo: any;
  let passesRepo: any;
  let usersService: any;

  beforeEach(() => {
    scansRepo = mockRepo();
    passesRepo = mockRepo();
    usersService = mockUsersService();
    // @ts-ignore
    service = new GateScansService(scansRepo, passesRepo, usersService);
  });

  it('creates a scan and updates pass lastActivityAt', async () => {
    const pass = { id: 'gp1', lastActivityAt: null };
    passesRepo.findOne.mockResolvedValue(pass);
    usersService.findById.mockResolvedValue({ id: 'u1' });
    scansRepo.create.mockReturnValue({});
    scansRepo.save.mockResolvedValue({ id: 's1' });

    const result = await service.create('u1', { gatePassId: 'gp1', scanType: 'ENTRY' as any });
    expect(scansRepo.create).toHaveBeenCalled();
    expect(scansRepo.save).toHaveBeenCalled();
    expect(passesRepo.save).toHaveBeenCalled();
    expect(result.valid).toBe(true);
  });
});
