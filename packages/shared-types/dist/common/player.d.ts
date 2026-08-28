export interface Player {
  id: string;
  name: string;
  avatar?: string;
  isOnline: boolean;
  joinedAt: Date;
  lastActivity: Date;
}
export interface RoomPlayer extends Player {
  role?: string;
  status: 'alive' | 'dead' | 'poisoned' | 'disconnected';
  team?: 'mafia' | 'civilian' | 'neutral' | 'maniac';
  isHost: boolean;
  isSpectator: boolean;
  cannotVoteNextDay?: boolean;
  isBlockedTonight?: boolean;
  votesReceived: number;
  hasVoted: boolean;
  voteTarget?: string;
  deathCause?: 'mafia' | 'lynched' | 'poison' | 'maniac' | 'host-kill' | 'poison-and-kill';
}
//# sourceMappingURL=player.d.ts.map
