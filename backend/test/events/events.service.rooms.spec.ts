import { EventsService } from '../../src/modules/events/events.service';

describe('EventsService room/role emits', () => {
  it('emits to a specific room', () => {
    const svc = new EventsService();
    const toMock = jest.fn().mockReturnValue({ emit: jest.fn() });
    const emitMock = jest.fn();
    // @ts-ignore
    svc['server'] = { to: (room: string) => ({ emit: emitMock }) } as any;

    svc.emitToRoom('role:CHEF', 'meals.intent.updated', { mealType: 'DINNER' });
    expect(emitMock).toHaveBeenCalledWith('meals.intent.updated', { mealType: 'DINNER' });
  });

  it('emits to a role room convenience', () => {
    const svc = new EventsService();
    const emitMock = jest.fn();
    // @ts-ignore
    svc['server'] = { to: (room: string) => ({ emit: emitMock }) } as any;

    svc.emitToRole('CHEF', 'meals.intent.updated', { mealType: 'BREAKFAST' });
    expect(emitMock).toHaveBeenCalledWith('meals.intent.updated', { mealType: 'BREAKFAST' });
  });
});
