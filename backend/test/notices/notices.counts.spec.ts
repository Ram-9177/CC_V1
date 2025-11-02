import { NoticesService } from '../../src/modules/notices/notices.service';

const mockRepo = () => {
  let qbCallCount = 0;
  let cloneCallCount = 0;
  return {
    create: jest.fn((x) => x),
    save: jest.fn(async (x) => ({ id: 'n1', ...x })),
    update: jest.fn(async () => {}),
    delete: jest.fn(async () => {}),
    findOne: jest.fn(),
    createQueryBuilder: jest.fn(() => {
      qbCallCount += 1;
      // Base QB (first call) used for total/high clones
      if (qbCallCount === 1) {
        const base: any = {
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          offset: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          getMany: jest.fn(async () => []),
          getRawMany: jest.fn(async () => [{ total: '10' }]), // not used directly
          clone: jest.fn(() => {
            cloneCallCount += 1;
            // First clone -> total
            if (cloneCallCount === 1) {
              return {
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                limit: jest.fn().mockReturnThis(),
                offset: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                getRawMany: jest.fn(async () => [{ total: '10' }]),
              } as any;
            }
            // Second clone -> high
            return {
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              orderBy: jest.fn().mockReturnThis(),
              limit: jest.fn().mockReturnThis(),
              offset: jest.fn().mockReturnThis(),
              select: jest.fn().mockReturnThis(),
              getRawMany: jest.fn(async () => [{ high: '3' }]),
            } as any;
          }),
        };
        return base;
      }
      // Second QB (expired)
      const expired: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        getMany: jest.fn(async () => []),
        getRawMany: jest.fn(async () => [{ exp: '2' }]),
        clone: jest.fn(function () { return this; }),
      };
      return expired;
    }),
  };
};

describe('NoticesService counts', () => {
  it('returns counts structure', async () => {
    const noticeRepo: any = mockRepo();
    const readsRepo: any = mockRepo();
    const users: any = { findById: jest.fn() };
    const events: any = { emit: jest.fn(), emitToRoles: jest.fn() };
    const notifications: any = { sendToTopic: jest.fn() };
    // @ts-ignore private ctor args
    const svc = new NoticesService(noticeRepo, readsRepo, users, events, notifications);

  // nothing else to mock; repo.createQueryBuilder is stateful above

    const res = await svc.counts({});
    expect(res).toEqual({ total: 10, highPriority: 3, expired: 2 });
  });
});
