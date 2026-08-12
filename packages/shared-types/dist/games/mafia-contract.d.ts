export declare const MAFIA_SOCKET_EVENTS: Readonly<{
  SNAPSHOT: 'game:snapshot';
  STARTED: 'game:started';
  STATE_UPDATE: 'game:state-update';
  PHASE_CHANGED: 'game:phase-changed';
  ACTION_REQUIRED: 'game:action-required';
  ACTION_RESULT: 'game:action-result';
  ACTION_REJECTED: 'game:action-rejected';
  NIGHT_RESOLVED: 'game:night-resolved';
  PLAYER_KILLED: 'game:player-killed';
  PLAYER_REVIVED: 'game:player-revived';
  VOTE_TIE: 'game:vote-tie';
  CITY_NO_EXECUTION: 'game:city-sleeps-no-execution';
  MULTIPLE_LYNCHED: 'game:multiple-lynched';
  ENDED: 'game:ended';
  AI_SPEAK: 'ai:speak';
}>;

export declare const MAFIA_ACTION_TYPES: Readonly<{
  VOTE: 'vote';
  ELECT_DON: 'elect-don';
  KILL: 'kill';
  CHECK_DON: 'check-don';
  HEAL: 'heal';
  CHECK_SHERIFF: 'check-sheriff';
  CHECK_JOURNALIST: 'check-journalist';
  GUARD: 'guard';
  POISON: 'poison';
  BLOCK: 'block';
  LAST_WILL: 'last-will';
}>;

export declare const MAFIA_PHASE_LABELS: Readonly<Record<string, string>>;

export declare function getMafiaActionTypeForPhase(phase: string): string | null;
export declare function isMafiaNightPhase(phase: string): boolean;

