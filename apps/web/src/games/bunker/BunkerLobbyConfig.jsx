import React from 'react';

/* Настройки «Бункера» в лобби (хост).
   value = { targetPlayerCount } — уходит в game:start payload.bunkerConfig.
   Если людей меньше цели — добираем ботами; если больше — боты не добавляются. */

export function BunkerLobbyConfig({ value, onChange, humanCount = 1 }) {
  const target = value.targetPlayerCount;
  const set = (v) => onChange({ ...value, targetPlayerCount: v });
  const bots = Math.max(0, target - humanCount);

  return (
    <div className="mafia-cfg" style={{ '--acc': '#f59e0b', '--acc2': '#92400e' }}>
      <div className="mafia-cfg__title">☢️ Настройка убежища</div>
      <div className="mafia-cfg__roles mafia-cfg__roles--list" style={{ gridTemplateColumns: '1fr' }}>
        <div className="mafia-cfg__role">
          <span className="mafia-cfg__role-name">👥 Участников всего</span>
          <div className="mafia-cfg__stepper">
            <button type="button" onClick={() => set(target - 1)} disabled={target <= 4}>−</button>
            <b>{target}</b>
            <button type="button" onClick={() => set(target + 1)} disabled={target >= 12}>+</button>
          </div>
        </div>
      </div>
      <div className="mafia-cfg__foot">
        🚪 Мест в бункере: {Math.max(1, Math.floor(target / 2))} из {target}.{' '}
        {bots > 0 ? `Ботов добавим: ${bots}.` : 'Ботов не будет — людей хватает.'}
      </div>
    </div>
  );
}

export default BunkerLobbyConfig;
