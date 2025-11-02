import { Test } from '@nestjs/testing';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomsService } from '../src/modules/rooms/rooms.service';
import { Room } from '../src/modules/rooms/entities/room.entity';
import { User } from '../src/modules/users/entities/user.entity';
import { EventsService } from '../src/modules/events/events.service';

class EventsServiceMock {
  emitToRoles = jest.fn();
}

describe('RoomsService', () => {
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
          save: jest.fn(async (x) => ({ id: x.id || 'r1', capacity: x.capacity || 4, block: x.block || 'A', number: x.number || '101', ...x })),
          createQueryBuilder: jest.fn(),
        }},
        { provide: getRepositoryToken(User), useValue: {
          find: jest.fn(),
          findOne: jest.fn(),
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

  it('should prevent assigning when room is full', async () => {
    (roomsRepo.findOne as any).mockResolvedValue({ id: 'r1', block: 'A', number: '101', capacity: 1 });
    (usersRepo.count as any).mockResolvedValue(1); // already full
    const user: any = { id: 'u1', hallticket: 'HT001', isActive: true };
    await expect(service.assignUserToRoom({ user, room: { id: 'r1', block: 'A', number: '101', capacity: 1 } as any }))
      .rejects.toThrow('Room is full');
  });

  it('should prevent assigning to occupied bed', async () => {
    (usersRepo.count as any).mockImplementation(({ where }: any) => {
      if (where.bedLabel) return 1; // bed occupied
      return 0;
    });
    const user: any = { id: 'u1', hallticket: 'HT001', isActive: true };
    await expect(service.assignUserToRoom({ user, room: { id: 'r1', block: 'A', number: '101', capacity: 4 } as any, bedLabel: 'A' }))
      .rejects.toThrow('Bed already occupied');
  });

  it('should unassign clearing room fields', async () => {
    const user: any = { id: 'u1', hallticket: 'HT001', isActive: true, roomId: 'r1', bedLabel: 'B', roomNumber: '101', hostelBlock: 'A' };
    await service.unassignUserFromRoom(user);
    expect(user.roomId).toBeNull();
    expect(user.bedLabel).toBeNull();
    expect(user.roomNumber).toBeNull();
    expect(user.hostelBlock).toBeNull();
  });

  it('should export all rooms CSV with occupancy', async () => {
    (roomsRepo as any).find = jest.fn().mockResolvedValue([
      { id: 'r1', block: 'A', number: '101', floor: '1', capacity: 4 },
      { id: 'r2', block: 'A', number: '102', floor: '1', capacity: 2 },
    ]);
    (usersRepo as any).count = jest.fn().mockImplementation(async ({ where }: any) => {
      if (where.roomId === 'r1') return 3;
      if (where.roomId === 'r2') return 2;
      return 0;
    });
    const csv = await service.exportAllRoomsCsv();
    expect(csv).toContain('id,block,number,floor,capacity,occupants,available');
    expect(csv).toContain('r1,A,101,1,4,3,1');
    expect(csv).toContain('r2,A,102,1,2,2,0');
  });
});
