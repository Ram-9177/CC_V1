import { NoticesService } from '../../src/modules/notices/notices.service';

const mockRepo = () => ({
  create: jest.fn((x) => x),
  save: jest.fn(async (x) => ({ id: 'n1', ...x })),
  update: jest.fn(async () => {}),
  delete: jest.fn(async () => {}),
  findOne: jest.fn(),
  upsert: jest.fn(async () => {}),
  createQueryBuilder: jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn(async () => []),
    select: jest.fn().mockReturnThis(),
    getRawMany: jest.fn(async () => []),
  })),
});

describe('NoticesService markAllRead', () => {
  it('marks all visible notices as read', async () => {
    const noticeRepo: any = mockRepo();
    const readsRepo: any = mockRepo();
    const users: any = { findById: jest.fn() };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn() };
    // @ts-ignore private ctor args
    const svc = new NoticesService(noticeRepo, readsRepo, users, events, notifications);

    // Ensure createQueryBuilder returns a stable builder so we can stub getMany
    const qb: any = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([{ id: 'n1' }, { id: 'n2' }]),
      select: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    noticeRepo.createQueryBuilder = jest.fn(() => qb);

    const res = await svc.markAllRead({ id: 'u1', role: 'STUDENT' });
    expect(res.updated).toBe(2);
    expect(readsRepo.upsert).toHaveBeenCalled();
  });

  it('marks a single notice as read', async () => {
    const noticeRepo: any = mockRepo();
    const readsRepo: any = mockRepo();
    const users: any = { findById: jest.fn() };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn() };
    // @ts-ignore private ctor args
    const svc = new NoticesService(noticeRepo, readsRepo, users, events, notifications);

    const res = await svc.markRead({ id: 'u1' }, 'n1');
    expect(res.updated).toBe(1);
    expect(readsRepo.upsert).toHaveBeenCalled();
  });

  it('marks a single notice as unread', async () => {
    const noticeRepo: any = mockRepo();
    const readsRepo: any = mockRepo();
    const users: any = { findById: jest.fn() };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn() };
    // @ts-ignore private ctor args
    const svc = new NoticesService(noticeRepo, readsRepo, users, events, notifications);

    const res = await svc.markUnread({ id: 'u1' }, 'n1');
    expect(res.updated).toBe(1);
    expect(readsRepo.delete).toHaveBeenCalled();
  });
});
