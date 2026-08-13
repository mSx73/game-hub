import React from 'react';

/* Настройки «Угадай мелодию» в лобби (хост).
   value = { rounds, attemptTime, hints, mode, categories } — уходит в game:start payload.melodyConfig. */

const NOTE_CATEGORIES = ['Классика', 'Народные и детские', 'Праздничные', 'Рок', 'Поп-хиты', 'Игры и кино'];

export function MelodyLobbyConfig({ value, onChange }) {
  const set = (k, v) => onChange({ ...value, [k]: v });
  const cats = value.categories || [];
  const toggleCat = (c) => set('categories', cats.includes(c) ? cats.filter((x) => x !== c) : [...cats, c]);
  const Stepper = ({ val, dec, inc, canDec, canInc, suffix = '' }) => (
    <div className="mafia-cfg__stepper">
      <button type="button" onClick={dec} disabled={!canDec}>−</button>
      <b>{val}{suffix}</b>
      <button type="button" onClick={inc} disabled={!canInc}>+</button>
    </div>
  );

  return (
    <div className="mafia-cfg" style={{ '--acc': '#ec4899' }}>
      <div className="mafia-cfg__title">🎧 Настройка эфира</div>
      <div className="mafia-cfg__roles mafia-cfg__roles--list" style={{ gridTemplateColumns: '1fr' }}>
        <div className="mafia-cfg__seg" role="radiogroup" aria-label="Режим игры">
          <button
            type="button"
            className={value.mode === 'chart' ? 'is-active' : ''}
            onClick={() => set('mode', 'chart')}
          >
            🎧 Реальные треки
          </button>
          <button
            type="button"
            className={value.mode !== 'chart' ? 'is-active' : ''}
            onClick={() => set('mode', 'notes')}
          >
            🎹 По нотам
          </button>
        </div>
        {value.mode !== 'chart' && (
          <div className="mafia-cfg__cats">
            <span className="mafia-cfg__role-name">🏷 Категории <small>(пусто = все)</small></span>
            <div className="mafia-cfg__cats-chips">
              {NOTE_CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={cats.includes(c) ? 'is-on' : ''}
                  onClick={() => toggleCat(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="mafia-cfg__role">
          <span className="mafia-cfg__role-name">🎵 Раундов</span>
          <Stepper val={value.rounds}
            dec={() => set('rounds', value.rounds - 1)} inc={() => set('rounds', value.rounds + 1)}
            canDec={value.rounds > 3} canInc={value.rounds < 15} />
        </div>
        <div className="mafia-cfg__role">
          <span className="mafia-cfg__role-name">⏱ Время на попытку</span>
          <Stepper val={value.attemptTime} suffix="с"
            dec={() => set('attemptTime', value.attemptTime - 5)} inc={() => set('attemptTime', value.attemptTime + 5)}
            canDec={value.attemptTime > 10} canInc={value.attemptTime < 40} />
        </div>
        <div className="mafia-cfg__role">
          <span className="mafia-cfg__role-name">💡 Подсказки DJ</span>
          <div className="mafia-cfg__stepper">
            <button type="button" onClick={() => set('hints', !value.hints)}>
              {value.hints ? 'вкл ✓' : 'выкл ✗'}
            </button>
          </div>
        </div>
      </div>
      <div className="mafia-cfg__foot">
        {value.mode === 'chart'
          ? '🎧 Реальные треки (превью iTunes): угадал с 3 секунд — 30 очков, с 7 — 20, с 15 — 10.'
          : '🎼 Угадал с 4 нот — 30 очков, с 8 — 20, со всей мелодии — 10.'}
      </div>
    </div>
  );
}

export default MelodyLobbyConfig;
