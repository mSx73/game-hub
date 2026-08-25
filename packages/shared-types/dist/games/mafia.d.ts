/** Роли Мафии */
export declare const MAFIA_ROLES: readonly [
  'civilian',
  'sheriff',
  'doctor',
  'putana',
  'mafia',
  'don',
  'poisoner',
  'maniac',
  'citizen',
];
export type MafiaRole = (typeof MAFIA_ROLES)[number];
/** Фазы игры */
export declare const MAFIA_PHASES: readonly [
  'role-reveal',
  'night-start',
  'night-mafia',
  'night-don',
  'night-doctor',
  'night-sheriff',
  'night-maniac',
  'night-poisoner',
  'night-putana',
  'night-end',
  'morning',
  'discussion',
  'voting',
  'vote-result',
  'game-over',
  'gameOver',
  'waiting',
  'intro',
  'nightDonVote',
  'night',
  'day',
  'votingTieDiscussion',
  'votingRevote',
  'lastWords',
  'roundTransition',
];
export type MafiaPhase = (typeof MAFIA_PHASES)[number];
/** Команды */
export type Team = 'mafia' | 'civilian' | 'maniac' | 'neutral';
export interface MafiaSettings {
  roles: {
    mafia: number;
    sheriffs: number;
    doctors: number;
    maniacs: number;
    poisoners: number;
    putanas: number;
  };
  timers: {
    night: number;
    discussion: number;
    voting: number;
    roleReveal: number;
  };
  options: {
    firstNightNoKill: boolean;
    deadSeeRoles: boolean;
    equalVotesNoKill: boolean;
    selfHealDoctor: boolean;
    putanaBlocksMafiaKill: boolean;
    aiGameMaster: boolean;
  };
}
export type NightActionType = 'kill' | 'heal' | 'block' | 'poison' | 'check-sheriff' | 'check-don';
export interface NightAction {
  type: NightActionType;
  actor: string;
  actorRole?: MafiaRole;
  target: string;
  phase: MafiaPhase;
  timestamp: Date;
}
export interface DayAction {
  type: 'vote';
  actor: string;
  target: string;
  timestamp: Date;
}
export interface GameEvent {
  timestamp: Date;
  day: number;
  phase: MafiaPhase;
  type: string;
  data: Record<string, unknown>;
}
/** Действия от клиента */
export interface GameAction {
  type: NightActionType | 'vote';
  targetId?: string;
}
/** Результаты проверок */
export interface CheckResult {
  target: string;
  isMafia?: boolean;
  isSheriff?: boolean;
  message: string;
}
/** Необходимые действия для игрока */
export interface RequiredAction {
  type: 'select-target' | 'vote' | 'none';
  description: string;
  validTargets: string[];
  timeout: number;
}
export interface NightResults {
  kills: Set<string>;
  heals: Set<string>;
  poisons: Set<string>;
  blocks: Set<string>;
  checks?: Array<{
    sheriff?: string;
    don?: string;
    target: string;
    result: boolean;
  }>;
}
import type { RoomPlayer } from '../common/player';
export interface MafiaGameState {
  phase: MafiaPhase;
  day: number;
  round: number;
  players: RoomPlayer[];
  nightKills: string[];
  nightHeals: string[];
  nightPoisoned: string[];
  nightBlocked: string[];
  dayVotes: Map<string, string>;
  lastWill: Map<string, string>;
  gameLog: GameEvent[];
  pendingActions: Set<string>;
  completedActions: Set<string>;
  timer?: number;
  [key: string]: unknown;
}
/** Статистика конца игры */
export interface GameStats {
  totalRounds: number;
  gameDuration: number;
  winner: Team;
  players: Array<{
    name: string;
    role?: MafiaRole;
    team?: Team;
    survived: boolean;
    deathCause?: string;
  }>;
  mafiaAlive?: number;
  civilianAlive?: number;
  roundsPlayed?: number;
}
export type DeathCause =
  | 'mafia'
  | 'vote'
  | 'lynched'
  | 'maniac'
  | 'poison'
  | 'moderator'
  | 'host-kill'
  | 'poison-and-kill';
//# sourceMappingURL=mafia.d.ts.map
