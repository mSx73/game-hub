import { getMafiaActionTypeForPhase, MAFIA_SOCKET_EVENTS } from '@playforfun/shared-types';

describe('Mafia shared contract', () => {
  test('maps phases to expected action types', () => {
    expect(getMafiaActionTypeForPhase('night-mafia')).toBe('kill');
    expect(getMafiaActionTypeForPhase('voting')).toBe('vote');
    expect(getMafiaActionTypeForPhase('vote-result')).toBeNull();
  });

  test('contains snapshot event', () => {
    expect(MAFIA_SOCKET_EVENTS.SNAPSHOT).toBe('game:snapshot');
  });
});

