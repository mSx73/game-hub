import React from 'react';

/* Настройка партии кастомной Мафии в лобби (только хост).
   value = { players, roles:{mafia,sheriffs,doctors,putanas,poisoners,maniacs,vampires} } */

const SPECIALS = [
  { key: 'mafia', label: 'Мафия', icon: '🔫', min: 1, max: 5, hint: 'первый — Дон' },
  { key: 'sheriffs', label: 'Шериф', icon: '⭐', min: 0, max: 3 },
  { key: 'doctors', label: 'Доктор', icon: '💊', min: 0, max: 2 },
  { key: 'putanas', label: 'Путана', icon: '💋', min: 0, max: 2 },
  { key: 'poisoners', label: 'Отравитель', icon: '☠️', min: 0, max: 2 },
  { key: 'maniacs', label: 'Маньяк', icon: '🪓', min: 0, max: 2 },
  { key: 'vampires', label: 'Вампир', icon: '🧛', min: 0, max: 2 },
];

export function MafiaLobbyConfig({ value, onChange }) {
  const { players, roles } = value;
  const specialsTotal = SPECIALS.reduce((s, r) => s + (roles[r.key] || 0), 0);
  const civ = Math.max(0, players - specialsTotal);

  const setPlayers = (n) => {
    const p = Math.max(4, Math.min(12, n));
    if (specialsTotal > p) return; // нельзя меньше, чем спецролей
    onChange({ ...value, players: p });
  };
  const setRole = (k, n, min, max) => {
    const v = Math.max(min, Math.min(max, n));
    const next = { ...roles, [k]: v };
    if (SPECIALS.reduce((s, r) => s + (next[r.key] || 0), 0) > players) return;
    onChange({ ...value, roles: next });
  };

  const Stepper = ({ val, dec, inc, canDec, canInc }) => (
    <div className="mafia-cfg__stepper">
      <button type="button" onClick={dec} disabled={!canDec}>−</button>
      <b>{val}</b>
      <button type="button" onClick={inc} disabled={!canInc}>+</button>
    </div>
  );

  return (
    <div className="mafia-cfg">
      <div className="mafia-cfg__title">⚙️ Настройка партии</div>

      <div className="mafia-cfg__players">
        <span>Игроков <small>(добьём ботами)</small></span>
        <Stepper
          val={players}
          dec={() => setPlayers(players - 1)} inc={() => setPlayers(players + 1)}
          canDec={players > 4 && players > specialsTotal} canInc={players < 12}
        />
      </div>

      <div className="mafia-cfg__roles">
        {SPECIALS.map((s) => (
          <div key={s.key} className="mafia-cfg__role">
            <span className="mafia-cfg__role-name">
              {s.icon} {s.label}{s.hint && <small> · {s.hint}</small>}
            </span>
            <Stepper
              val={roles[s.key] || 0}
              dec={() => setRole(s.key, (roles[s.key] || 0) - 1, s.min, s.max)}
              inc={() => setRole(s.key, (roles[s.key] || 0) + 1, s.min, s.max)}
              canDec={(roles[s.key] || 0) > s.min}
              canInc={(roles[s.key] || 0) < s.max && specialsTotal < players}
            />
          </div>
        ))}
      </div>

      <div className="mafia-cfg__foot">🧑 Мирных: <b>{civ}</b></div>
    </div>
  );
}

export default MafiaLobbyConfig;
