import { GatePassesService } from '../../src/modules/gate-passes/gate-passes.service';

// Minimal mocks for repository and UsersService
const mockRepo = () => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn()
});

const mockUsersService = () => ({
  findById: jest.fn()
});

describe('GatePassesService', () => {
  let service: GatePassesService;
  let repo: any;
  let usersService: any;

  beforeEach(() => {
    repo = mockRepo();
    usersService = mockUsersService();
    // @ts-ignore
    service = new GatePassesService(repo, usersService);
  });

  it('creates an emergency gate pass and auto-approves', async () => {
    const student = { id: 'stu1' };
    usersService.findById.mockResolvedValue(student);
    repo.create.mockReturnValue({});
    repo.save.mockResolvedValue({ id: 'gp1', isEmergency: true, student });
    // spy on approve
    service.approve = jest.fn().mockResolvedValue(true);

    const dto = { reason: 'Home', destination: 'City', fromDate: new Date().toISOString(), toDate: new Date().toISOString(), isEmergency: true };
    const result = await service.create('stu1', dto as any);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalled();
    expect(service.approve).toHaveBeenCalled();
  });
});
