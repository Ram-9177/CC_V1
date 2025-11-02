import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { Room } from '../src/modules/rooms/entities/room.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { EventsService } from '../src/modules/events/events.service';

class EventsServiceMock { emitToRoles = jest.fn(); }

function csv(text: string) {
  return Buffer.from(text, 'utf8');
}

describe('RoomsService bulkAssignFromCsv', () => {
  let service: RoomsService;
  let roomsRepo: Repository<Room>;
  let usersRepo: Repository<User>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RoomsService,
        { provide: getRepositoryToken(Room), useValue: {
          findOne: jest.fn(),
          create: jest.fn((x) => x),
          save: jest.fn(async (x) => ({ id: x.id || `${x.block}-${x.number}`, ...x })),
        }},
        { provide: getRepositoryToken(User), useValue: {
          findOne: jest.fn(),
          find: jest.fn(),
          count: jest.fn(),
          save: jest.fn(async (x) => x),
        }},
        { provide: EventsService, useClass: EventsServiceMock },
      ]
    }).compile();

    service = moduleRef.get(RoomsService);
    roomsRepo = moduleRef.get(getRepositoryToken(Room));
    usersRepo = moduleRef.get(getRepositoryToken(User));
  });

  it('assigns valid rows and reports failures', async () => {
    (usersRepo.findOne as any).mockImplementation(async ({ where }: any) => {
      if (where.hallticket === 'HT001') return { id: 'u1', hallticket: 'HT001', isActive: true };
      if (where.hallticket === 'HT003') return { id: 'u3', hallticket: 'HT003', isActive: true };
      return null;
    });
    (roomsRepo.findOne as any).mockResolvedValue(null);
    (usersRepo.count as any).mockResolvedValue(0);

    const text = [
      'hallticket,block,number,bedLabel,floor',
      'HT001,A,101,A,1',
      'MISSING,B,201,B,2',
      'HT003,A,101,C,1',
    ].join('\n');

    const res = await service.bulkAssignFromCsv(csv(text));
    expect(res.assigned).toBe(2);
    expect(res.failed).toBe(1);
    expect(res.errors.length).toBe(1);
  });
});
