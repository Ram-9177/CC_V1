import { NoticesService } from '../../src/modules/notices/notices.service';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'n1', ...x })),
  update: jest.fn(async () => {}),
  delete: jest.fn(async () => {}),
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => []),
  })),
});

describe('NoticesService', () => {
  it('creates a notice and emits events', async () => {
    const repo: any = mockRepo();
    const reads: any = mockRepo();
    const users: any = { findById: jest.fn(async (id) => ({ id, firstName: 'Test', lastName: 'User' })) };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn(async () => ({ success: true })) };
    // @ts-ignore private ctor args
    const svc = new NoticesService(repo, reads, users, events, notifications);

    const created = await svc.create('warden1', { title: 'Hello', content: 'World', roles: ['STUDENT'] } as any);
    expect(created.id).toBeDefined();
    expect(repo.save).toHaveBeenCalled();
    expect(events.emitToRoles).toHaveBeenCalledWith(['STUDENT'], 'notice:created', expect.objectContaining({ id: 'n1', title: 'Hello' }));
    expect(notifications.sendToTopic).toHaveBeenCalled();
  });

  it('lists notices for user without error', async () => {
    const repo: any = mockRepo();
    const users: any = { findById: jest.fn() };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn() };
    // @ts-ignore private ctor args
    const svc = new NoticesService(repo, users, events, notifications);

    const list = await svc.listForUser({ role: 'STUDENT', hostelId: 'H1', blockId: 'B1' });
    expect(Array.isArray(list)).toBe(true);
    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });
});
