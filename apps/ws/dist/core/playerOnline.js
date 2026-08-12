/**
 * Единая проверка «игрок в ротации» — RoomManager ставит isOnline: false при disconnect.
 * Не использовать p.disconnected (никогда не выставляется).
 */
export function isPlayerOnline(player, room) {
  if (!player || player.isSpectator) return false;
  const rp = room?.players?.find((p) => p.id === player.id);
  const online = rp ? rp.isOnline !== false : player.isOnline !== false;
  return online;
}

export function filterOnlinePlayers(players, room) {
  return (players ?? []).filter((p) => isPlayerOnline(p, room));
}

export function pruneOfflineFromMap(playersMap, room) {
  if (!playersMap || !room?.players) return;
  for (const id of [...playersMap.keys()]) {
    const rp = room.players.find((p) => p.id === id);
    if (rp && rp.isOnline === false) playersMap.delete(id);
  }
}
