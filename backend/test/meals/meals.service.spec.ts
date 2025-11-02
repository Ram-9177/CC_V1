import { MealsService } from '../../src/modules/meals/meals.service';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'm1', ...x })),
  update: jest.fn(async () => {}),
  delete: jest.fn(async () => {}),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => []),
    leftJoin: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(async () => []),
    getCount: jest.fn(async () => 0),
  }))
});

describe('MealsService', () => {
  it('creates a menu and submits intent', async () => {
    const menuRepo: any = mockRepo();
    const intentRepo: any = mockRepo();
  const usersService: any = { findById: jest.fn(async (id) => ({ id })) };
  const notifications: any = { sendToTopic: jest.fn(async () => ({ success: true })) };
  const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
  const gatePassRepo: any = mockRepo();
  // @ts-ignore private ctor args
  const svc = new MealsService(menuRepo, intentRepo, gatePassRepo, usersService, notifications, events);

    const created = await svc.createMenu('chef1', { date: '2025-10-31', mealType: 'DINNER', items: ['Rice'] } as any);
    expect(created.id).toBeDefined();
    expect(menuRepo.save).toHaveBeenCalled();

    menuRepo.findOne.mockResolvedValue({ id: 'menu1' });
    const intent = await svc.submitIntent('stu1', { menuId: 'menu1', intent: 'YES' } as any);
    expect(intent.intent).toBe('YES');
    expect(intentRepo.save).toHaveBeenCalled();
  });
});
