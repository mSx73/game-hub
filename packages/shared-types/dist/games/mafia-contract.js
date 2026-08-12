export const MAFIA_SOCKET_EVENTS = Object.freeze({
  SNAPSHOT: 'game:snapshot',
  STARTED: 'game:started',
  STATE_UPDATE: 'game:state-update',
  PHASE_CHANGED: 'game:phase-changed',
  ACTION_REQUIRED: 'game:action-required',
  ACTION_RESULT: 'game:action-result',
  ACTION_REJECTED: 'game:action-rejected',
  NIGHT_RESOLVED: 'game:night-resolved',
  PLAYER_KILLED: 'game:player-killed',
  PLAYER_REVIVED: 'game:player-revived',
  VOTE_TIE: 'game:vote-tie',
  CITY_NO_EXECUTION: 'game:city-sleeps-no-execution',
  MULTIPLE_LYNCHED: 'game:multiple-lynched',
  ENDED: 'game:ended',
  AI_SPEAK: 'ai:speak',
});

export const MAFIA_ACTION_TYPES = Object.freeze({
  VOTE: 'vote',
  ELECT_DON: 'elect-don',
  KILL: 'kill',
  CHECK_DON: 'check-don',
  HEAL: 'heal',
  CHECK_SHERIFF: 'check-sheriff',
  CHECK_JOURNALIST: 'check-journalist',
  GUARD: 'guard',
  POISON: 'poison',
  BLOCK: 'block',
  LAST_WILL: 'last-will',
});

export const MAFIA_PHASE_LABELS = Object.freeze({
  waiting: 'Ожидание',
  playing: 'Игра',
  'role-reveal': 'Раздача ролей',
  'don-election': 'Выбор дона',
  intro: 'Вступление',
  'night-start': 'Ночь',
  'night-putana': 'Ночь: путана',
  'night-doctor': 'Ночь: доктор',
  'night-mafia': 'Ночь: мафия',
  'night-maniac': 'Ночь: маньяк',
  'night-poisoner': 'Ночь: отравитель',
  'night-sheriff': 'Ночь: шериф',
  'night-don': 'Ночь: дон',
  'night-bodyguard': 'Ночь: телохранитель',
  'night-journalist': 'Ночь: журналист',
  'night-end': 'Конец ночи',
  morning: 'Утро',
  discussion: 'Обсуждение',
  voting: 'Голосование',
  votingTieDiscussion: 'Обсуждение ничьей',
  votingRevote: 'Переголосование',
  'vote-result': 'Итог голосования',
  gameOver: 'Конец игры',
});

export function getMafiaActionTypeForPhase(phase) {
  switch (phase) {
    case 'voting':
    case 'votingRevote':
      return MAFIA_ACTION_TYPES.VOTE;
    case 'don-election':
      return MAFIA_ACTION_TYPES.ELECT_DON;
    case 'night-mafia':
    case 'night-maniac':
      return MAFIA_ACTION_TYPES.KILL;
    case 'night-don':
      return MAFIA_ACTION_TYPES.CHECK_DON;
    case 'night-doctor':
      return MAFIA_ACTION_TYPES.HEAL;
    case 'night-sheriff':
      return MAFIA_ACTION_TYPES.CHECK_SHERIFF;
    case 'night-bodyguard':
      return MAFIA_ACTION_TYPES.GUARD;
    case 'night-journalist':
      return MAFIA_ACTION_TYPES.CHECK_JOURNALIST;
    case 'night-poisoner':
      return MAFIA_ACTION_TYPES.POISON;
    case 'night-putana':
      return MAFIA_ACTION_TYPES.BLOCK;
    default:
      return null;
  }
}

export function isMafiaNightPhase(phase) {
  return typeof phase === 'string' && phase.startsWith('night-') && phase !== 'night-start' && phase !== 'night-end';
}

