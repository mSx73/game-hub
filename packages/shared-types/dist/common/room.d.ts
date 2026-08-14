import type { RoomPlayer } from './player';
import type { ChatMessage } from './chat';
import type { GameSettings } from './game-settings';
export type GameType =
  | 'mafia'
  | 'crocodile'
  | 'crocodile-verbs'
  | 'crocodile-nouns'
  | 'hat'
  | 'associations'
  | 'monopoly'
  | 'kowall'
  | 'truth-or-dare';
export interface Room {
  code: string;
  gameType: GameType;
  status: 'waiting' | 'playing' | 'paused' | 'finished';
  createdAt: Date;
  updatedAt: Date;
  hostId: string;
  players: RoomPlayer[];
  spectators: RoomPlayer[];
  maxPlayers: number;
  settings: GameSettings;
  currentGame?: unknown;
  chatHistory: ChatMessage[];
}
//# sourceMappingURL=room.d.ts.map
