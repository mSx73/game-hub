import type { Room } from './room';
import type { ChatMessage } from './chat';
import type { RoomPlayer } from './player';
import type {
  MafiaGameState,
  MafiaPhase,
  MafiaRole,
  Team,
  GameStats,
  DeathCause,
  GameAction,
  RequiredAction,
} from '../games/mafia';
import type { GameSettings } from './game-settings';
export type { GameAction, RequiredAction };
export interface CreateRoomData {
  playerName: string;
  gameType: string;
  settings: GameSettings;
}
export interface JoinRoomData {
  code: string;
  playerName: string;
  asSpectator?: boolean;
}
export interface ActionResult {
  success: boolean;
  message?: string;
}
export interface ServerToClientEvents {
  'room:updated': (room: Room) => void;
  'room:player-joined': (player: RoomPlayer) => void;
  'room:player-left': (playerId: string) => void;
  'room:error': (error: string) => void;
  'game:started': (
    initialState:
      | MafiaGameState
      | {
          phase?: string;
          gameType?: string;
        }
  ) => void;
  'game:phase-changed': (phase: MafiaPhase, timer: number) => void;
  'game:state-updated': (state: Partial<MafiaGameState>) => void;
  'game:action-required': (action: RequiredAction) => void;
  'game:action-result': (result: ActionResult) => void;
  'game:player-killed': (playerId: string, cause: DeathCause) => void;
  'game:ended': (
    winnerOrData:
      | Team
      | {
          winner?: unknown;
          results?: unknown[];
        },
    stats?: GameStats
  ) => void;
  'game:night-resolved'?: (results: {
    killed: string[];
    healed: string[];
    poisoned: string[];
    checks?: Array<{
      sheriff?: string;
      don?: string;
      target: string;
      result: boolean;
    }>;
  }) => void;
  'game:pending-actions-updated'?: (playerIds: string[]) => void;
  'chat:message': (message: ChatMessage) => void;
  'chat:system': (text: string) => void;
  'ai:speak': (text: string) => void;
  'hat:words-added'?: (data: { playerId: string; count: number }) => void;
  'words:complete'?: (data: { total: number }) => void;
  'round:started'?: (data: { explainer: string; explainerName: string; team: number; timeLeft: number }) => void;
  'word:new'?: (data: { word: string }) => void;
  'timer:tick'?: (timeLeft: number) => void;
  'word:guessed'?: (data: { guesserId: string; guesserName: string; word: string; roundScore: number }) => void;
  'word:skipped'?: (word: string) => void;
  'round:ended'?: (data: { team: number; score: number; totalScore: number }) => void;
  'associations:words-collected'?: (data: { total: number }) => void;
  'associations:chain-started'?: (data: { firstWord: string; currentPlayer: string }) => void;
  'associations:turn-started'?: (data: {
    player: {
      id: string;
      name: string;
      score: number;
    };
    previousWord: string | null;
    timeLeft: number;
  }) => void;
  'associations:link-added'?: (link: unknown) => void;
  'associations:voting-started'?: (data: { link: unknown; timeLeft: number; options: string[] }) => void;
  'associations:voting-ended'?: (data: { valid: boolean; yesVotes: number; noVotes: number }) => void;
  'associations:bonus'?: (data: { player: string; reason: string }) => void;
  'associations:chain-broken'?: (data: { player: string; word: string }) => void;
}
export interface ClientToServerEvents {
  'room:create': (
    data: CreateRoomData,
    callback: (result: { success: boolean; room?: Room; error?: string }) => void
  ) => void;
  'room:join': (
    data: JoinRoomData,
    callback: (result: { success: boolean; room?: Room; error?: string }) => void
  ) => void;
  'room:leave': () => void;
  'room:update-settings': (settings: GameSettings) => void;
  'room:kick-player': (playerId: string) => void;
  'room:toggle-spectator': () => void;
  'game:start': () => void;
  'game:action': (
    action:
      | GameAction
      | {
          type: string;
          words?: string[];
          word?: string;
        }
  ) => void;
  'game:pause': () => void;
  'game:resume': () => void;
  'game:stop': () => void;
  'host:next-phase': () => void;
  'host:set-phase': (phase: MafiaPhase) => void;
  'host:kill-player': (playerId: string) => void;
  'host:revive-player': (playerId: string) => void;
  'host:change-role': (playerId: string, newRole: MafiaRole) => void;
  'chat:send': (text: string, channel?: 'all' | 'mafia' | 'dead') => void;
}
export interface InterServerEvents {
  ping: () => void;
}
export interface SocketData {
  playerName?: string;
  roomCode?: string;
}
//# sourceMappingURL=events.d.ts.map
