import { Test, TestingModule } from '@nestjs/testing';
import { NotificationService } from '../../src/modules/notifications/notification.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotificationAudit } from '../../src/modules/notifications/entities/notification-audit.entity';

// Provide env so NotificationService initializes firebase-admin in tests
process.env.FIREBASE_SERVICE_ACCOUNT = Buffer.from(JSON.stringify({ project_id: 'test' })).toString('base64');

// Mock firebase-admin
jest.mock('firebase-admin', () => {
  return {
    credential: {
      cert: (obj: any) => ({ _cert: true, obj })
    },
    initializeApp: jest.fn(),
    messaging: () => ({
      send: jest.fn().mockResolvedValue('mock-message-id')
    })
  };
});

describe('NotificationService', () => {
  let service: NotificationService;
  const auditSave = jest.fn().mockImplementation((v: any) => Promise.resolve({ ...v, id: 'uuid' }));

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationService,
        {
          provide: getRepositoryToken(NotificationAudit),
          useValue: {
            create: (v: any) => v,
            save: auditSave
          }
        }
      ]
    }).compile();

    service = module.get<NotificationService>(NotificationService);
  });

  it('sends to device and records audit', async () => {
  // ensure initialized in this environment
    const res = await service.sendToDevice('token-123', { title: 'Hello', body: 'World' });
    expect(res).toHaveProperty('success', true);
    // audit save called at least once
    expect(auditSave).toHaveBeenCalled();
  });
});
