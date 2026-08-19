export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  channel: 'all' | 'mafia' | 'dead' | 'system';
  timestamp: Date;
  isSystem: boolean;
}
//# sourceMappingURL=chat.d.ts.map
