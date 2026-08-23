/**
 * Единая проверка «игрок в ротации» — RoomManager ставит isOnline: false при disconnect.
 * Не использовать p.disconnected (никогда не выставляется).
 */
export function isPlayerOnline(player, room) {
  if (!player || player.isSpectator) return false;
  const rp = room?.players?.find((p) => p.id === player.id);
  // Player left the room (removed from room.players) — treat as offline.
  if (!rp) return false;
  return rp.isOnline !== false;
}

export function filterOnlinePlayers(players, room) {
  return (players ?? []).filter((p) => isPlayerOnline(p, room));
}

export function pruneOfflineFromMap(playersMap, room) {
  if (!playersMap || !room?.players) return;
  for (const id of [...playersMap.keys()]) {
    const rp = room.players.find((p) => p.id === id);
    if (!rp || rp.isOnline === false) playersMap.delete(id);
  }
}
