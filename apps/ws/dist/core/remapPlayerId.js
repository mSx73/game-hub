/**
 * Generic deep-remap socket-id игрока внутри игрового движка.
 *
 * Зачем: при reconnect (рефреш страницы) игрок получает НОВЫЙ socket.id.
 * RoomManager обновляет room.players, но движки хранят снапшоты/Map'ы,
 * ключованные старым id — все действия игрока начинают отвергаться.
 * Движок может реализовать свой remapPlayerId(oldId, newId); для остальных
 * RoomManager зовёт этот generic-фолбэк.
 *
 * Обходит собственные поля движка (глубина ≤ 3) и заменяет oldId → newId:
 *  - ключи и значения Map, элементы Set;
 *  - элементы массивов (строки-id) и поля объектов (id/playerId/author/actor/…);
 *  - строковые поля движка (activeSpeaker, spyId, hostId, …).
 * Socket.id — уникальная 20-символьная base64-строка, коллизии с игровым
 * контентом практически исключены.
 */
export function remapPlayerIdDeep(engine, oldId, newId) {
  if (!engine || !oldId || !newId || oldId === newId) return;
  const seen = new Set();

  const visit = (obj, depth) => {
    if (!obj || typeof obj !== 'object' || seen.has(obj) || depth > 3) return;
    seen.add(obj);

    if (obj instanceof Map) {
      if (obj.has(oldId)) {
        obj.set(newId, obj.get(oldId));
        obj.delete(oldId);
      }
      for (const [k, v] of obj) {
        if (v === oldId) obj.set(k, newId);
        else visit(v, depth + 1);
      }
      return;
    }
    if (obj instanceof Set) {
      if (obj.has(oldId)) {
        obj.delete(oldId);
        obj.add(newId);
      }
      return;
    }
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        if (obj[i] === oldId) obj[i] = newId;
        else visit(obj[i], depth + 1);
      }
      return;
    }
    // Обычный объект: заменяем строковые поля-указатели и идём вглубь.
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v === oldId) obj[k] = newId;
      else visit(v, depth + 1);
    }
  };

  visit(engine, 0);
}
