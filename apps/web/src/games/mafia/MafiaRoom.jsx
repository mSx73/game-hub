import React, { useEffect, useMemo, useRef, useState } from 'react';
import './MafiaRoom.css';

/* ============================================================================
 * MafiaRoom — фронт-модуль рендера фаз кастомной Мафии.
 * Полностью state-driven: получает gameState (phase, players, you, ...) и
 * колбэк onAction. Перерисовывает #game-table по gameState.phase и даёт
 * нужные действия (ночная цель / голос / завершить речь).
 *
 * Голос — внешний (Discord), поэтому пульс говорящего идёт от activeSpeaker
 * (серверная очередь речи), а не от аудио.
 * ==========================================================================*/

const ROLE_META = {
  civilian: { n: 'Мирный житель', i: '🧑', t: 'Город' },
  citizen: { n: 'Мирный житель', i: '🧑', t: 'Город' },
  mafia: { n: 'Мафия', i: '🔫', t: 'Мафия' },
  don: { n: 'Дон', i: '🎩', t: 'Мафия' },
  poisoner: { n: 'Отравитель', i: '☠️', t: 'Мафия' },
  sheriff: { n: 'Шериф', i: '⭐', t: 'Город' },
  doctor: { n: 'Доктор', i: '💊', t: 'Город' },
  putana: { n: 'Путана', i: '💋', t: 'Город' },
  maniac: { n: 'Маньяк', i: '🪓', t: 'Соло' },
  vampire: { n: 'Вампир', i: '🧛', t: 'Вампиры' },
  bodyguard: { n: 'Телохранитель', i: '🛡️', t: 'Город' },
  mayor: { n: 'Мэр', i: '🏛️', t: 'Город' },
  journalist: { n: 'Журналист', i: '📰', t: 'Город' },
};

const PHASE_VIEW = {
  lobby:               { icon: '🎭', label: 'Ожидание',                 mode: 'day' },
  roleReveal:          { icon: '🎭', label: 'Ваша роль',                mode: 'day' },
  intro:               { icon: '🎤', label: 'Знакомство',               mode: 'day' },
  night:               { icon: '🌙', label: 'Ночь · город спит',        mode: 'night' },
  day:                 { icon: '☀️', label: 'День · обсуждение',        mode: 'day' },
  voting:              { icon: '⚖️', label: 'Голосование',              mode: 'voting' },
  votingTieDiscussion: { icon: '⚖️', label: 'Ничья · речи кандидатов',  mode: 'voting' },
  votingRevote:        { icon: '⚖️', label: 'Переголосование',          mode: 'voting' },
  gameOver:            { icon: '🏁', label: 'Игра окончена',            mode: 'day' },
};

const ROLE_ACTION = {
  putana: 'block', doctor: 'heal', don: 'kill', mafia: 'kill',
  maniac: 'kill', vampire: 'bite', poisoner: 'poison', sheriff: 'check',
};
const ACTION_VERB = {
  block: 'Заблокировать', heal: 'Вылечить', kill: 'Убить',
  bite: 'Укусить', poison: 'Отравить', check: 'Проверить',
};
const WINNER_LABEL = { town: 'Победил город', mafia: 'Победила мафия', maniac: 'Победил маньяк', vampire: 'Победили вампиры' };

const fmtTime = (s) => {
  if (s == null || s < 0) return '';
  const m = Math.floor(s / 60), ss = s % 60;
  return `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
};

/** Подсветка «умирающих» карточек: 1.6с проигрываем is-dying, затем dead. */
function useDeathAnimation(players) {
  const [dying, setDying] = useState(() => new Set());
  const prevAlive = useRef(new Map());
  const timers = useRef(new Map());
  useEffect(() => {
    const next = new Map();
    for (const p of players) {
      const was = prevAlive.current.get(p.id);
      next.set(p.id, p.alive);
      if (was === true && p.alive === false) {
        setDying((s) => new Set(s).add(p.id));
        const t = setTimeout(() => setDying((s) => { const n = new Set(s); n.delete(p.id); return n; }), 1600);
        timers.current.set(p.id, t);
      }
    }
    prevAlive.current = next;
  }, [players]);
  useEffect(() => () => { for (const t of timers.current.values()) clearTimeout(t); }, []);
  return dying;
}

function Seat({ p, i, isSelf, isSpeaking, isTargetable, isTargeted, isDying, speech, onPick }) {
  const showBubble = speech && (Date.now() - speech.ts < 5500) && p.alive;
  const cls = [
    'seat',
    !p.alive && !isDying ? 'dead' : '',
    isDying ? 'is-dying' : '',
    isSpeaking ? 'is-speaking' : '',
    isTargetable ? 'is-targetable' : '',
    isSelf ? 'is-self' : '',
  ].filter(Boolean).join(' ');
  return (
    <div
      className={cls}
      style={{ '--i': i, ...(isTargeted ? { outline: '2px solid var(--blood)', outlineOffset: '3px', borderRadius: 'var(--radius)' } : {}) }}
      onClick={() => isTargetable && onPick(p.id)}
      role={isTargetable ? 'button' : undefined}
      tabIndex={isTargetable ? 0 : undefined}
      onKeyDown={(e) => isTargetable && (e.key === 'Enter' || e.key === ' ') && onPick(p.id)}
    >
      {showBubble && <div className="player-bubble">{speech.text}</div>}
      <div className="player-card">
        <div className="player-card__seat-no">{i + 1}</div>
        <div className="player-card__avatar">{p.avatar ? <img src={p.avatar} alt="" /> : (p.name?.[0]?.toUpperCase() || '?')}</div>
        <div className="player-card__name">{p.name}</div>
      </div>
    </div>
  );
}

export function MafiaRoom({ state = {}, onAction = () => {} }) {
  const {
    phase = 'lobby', day = 0, players = [], activeSpeaker = null,
    you = null, timer = null, candidates = null, winner = null, speeches = {}, feed = [], nightReport = null,
  } = state;
  const recentFeed = feed.filter((f) => Date.now() - f.ts < 7000).slice(-4);

  // Кинематографичный «итог ночи» на несколько секунд
  const [morning, setMorning] = useState(null);
  useEffect(() => {
    if (!nightReport?.ts) return undefined;
    setMorning(nightReport);
    const t = setTimeout(() => setMorning(null), 4500);
    return () => clearTimeout(t);
  }, [nightReport?.ts]);
  const view = PHASE_VIEW[phase] || PHASE_VIEW.day;
  const isNight = view.mode === 'night';
  const aliveCount = players.filter((p) => p.alive).length;
  const dying = useDeathAnimation(players);

  const [selected, setSelected] = useState(null);
  useEffect(() => { setSelected(null); }, [phase]);

  // Что сейчас делает «ты»?
  const interaction = useMemo(() => {
    if (!you || !you.alive) return { kind: 'spectate' };
    if (phase === 'night') {
      const action = ROLE_ACTION[you.role];
      if (!action) return { kind: 'wait', text: 'Город спит. Ждём особые роли…' };
      const targets = players.filter((p) => p.alive && p.id !== you.id).map((p) => p.id);
      return { kind: 'night', action, targets, verb: ACTION_VERB[action] };
    }
    if (phase === 'voting' || phase === 'votingRevote') {
      if (you.cannotVote) return { kind: 'wait', text: 'Путана лишила вас голоса на этот день.' };
      const pool = (phase === 'votingRevote' && candidates) ? candidates
        : players.filter((p) => p.alive && p.id !== you.id).map((p) => p.id);
      return { kind: 'vote', targets: pool };
    }
    if ((phase === 'day' || phase === 'votingTieDiscussion') && activeSpeaker === you.id) {
      return { kind: 'speaking' };
    }
    return { kind: 'wait', text: activeSpeaker ? 'Слово у другого игрока…' : 'Ждём…' };
  }, [phase, you, players, candidates, activeSpeaker]);

  const targetSet = useMemo(() => new Set(interaction.targets || []), [interaction]);

  const pick = (id) => setSelected((cur) => (cur === id ? null : id));
  const confirm = () => {
    if (!selected) return;
    if (interaction.kind === 'night') onAction({ type: interaction.action, target: selected });
    else if (interaction.kind === 'vote') onAction({ type: 'vote', target: selected });
    setSelected(null);
  };

  const acting = isNight && interaction.kind === 'night';
  const myRole = you?.role ? ROLE_META[you.role] : null;

  return (
    <div className={`mafia-room ${isNight ? 'is-night' : ''} ${acting ? 'mafia-room--acting' : ''}`}>
      <div className="mafia-room__moon" aria-hidden>🌙</div>
      <div className="mafia-room__curtain" aria-hidden />

      <div className="mafia-feed" aria-live="polite">
        {recentFeed.map((f) => (
          <div key={f.id} className={`mafia-toast mafia-toast--${f.kind}`}>{f.text}</div>
        ))}
      </div>

      {morning && (
        <div className="mafia-morning" role="status">
          <div className="mafia-morning__card">
            <div className="mafia-morning__sun">🌅</div>
            <div className="mafia-morning__title">Наступает утро</div>
            {morning.killed?.length ? (
              <div className="mafia-morning__dead">
                ☠️ Этой ночью погиб{morning.killed.length > 1 ? 'ли' : ''}:{' '}
                <b>{morning.killed.join(', ')}</b>
              </div>
            ) : (
              <div className="mafia-morning__safe">🕊️ Все дожили до утра</div>
            )}
          </div>
        </div>
      )}

      <header className="mafia-room__top">
        <div className="mafia-room__brand">MAFIA</div>
        {myRole && you.alive && (
          <div className={`mafia-room__role mafia-room__role--${you.team}`} title={`Команда: ${myRole.t}`}>
            <span aria-hidden>{myRole.i}</span> {myRole.n}
          </div>
        )}
        <div className="mafia-room__phase">
          <span aria-hidden>{view.icon}</span>
          {view.label}{day > 0 && phase !== 'gameOver' ? ` · День ${day}` : ''}
        </div>
        <div className="mafia-room__timer">{fmtTime(timer)}</div>
      </header>

      <div className="mafia-stage" style={{ '--n': players.length || 1 }}>
        <div id="game-table" className={`is-${view.mode}`}>
          {phase === 'gameOver' ? (
            <div className="gt-gameover">
              <div className="gt-emblem">🏆</div>
              <div className="gt-phase">{WINNER_LABEL[winner] || 'Игра окончена'}</div>
              <div className="gt-sub">Спасибо за игру</div>
            </div>
          ) : phase === 'roleReveal' && myRole ? (
            <div className="gt-rolereveal">
              <div className="gt-emblem">{myRole.i}</div>
              <div className="gt-phase">{myRole.n}</div>
              <div className={`gt-team gt-team--${you.team}`}>Команда: {myRole.t}</div>
            </div>
          ) : (
            <>
              <div className="gt-emblem">{view.icon}</div>
              <div className="gt-phase">{view.label}</div>
              <div className="gt-sub">{aliveCount} в живых</div>
            </>
          )}
        </div>

        {players.map((p, i) => (
          <Seat
            key={p.id}
            p={p}
            i={i}
            isSelf={you && p.id === you.id}
            isSpeaking={activeSpeaker === p.id && p.alive}
            isTargetable={(interaction.kind === 'night' || interaction.kind === 'vote') && targetSet.has(p.id)}
            isTargeted={selected === p.id}
            isDying={dying.has(p.id)}
            speech={speeches[p.id]}
            onPick={pick}
          />
        ))}
      </div>

      <ActionDock interaction={interaction} selected={selected} players={players} onConfirm={confirm} onAction={onAction} />
    </div>
  );
}

function ActionDock({ interaction, selected, players, onConfirm, onAction }) {
  const name = (id) => players.find((p) => p.id === id)?.name || '';
  if (interaction.kind === 'spectate') {
    return <div className="mafia-dock mafia-dock--hint">👁 Вы наблюдаете</div>;
  }
  if (interaction.kind === 'speaking') {
    return (
      <div className="mafia-dock">
        <span className="mafia-dock__label">🎤 Ваше слово — говорите в Discord</span>
        <button className="mafia-dock__btn" onClick={() => onAction({ type: 'finish-speaking' })}>Завершить речь ⏭</button>
      </div>
    );
  }
  if (interaction.kind === 'night' || interaction.kind === 'vote') {
    const isVote = interaction.kind === 'vote';
    return (
      <div className={`mafia-dock ${isVote ? 'mafia-dock--vote' : 'mafia-dock--night'}`}>
        <span className="mafia-dock__label">
          {isVote ? '⚖️ Кого изгоняем?' : `🎯 ${interaction.verb}: выберите цель`}
        </span>
        <button className="mafia-dock__btn" disabled={!selected} onClick={onConfirm}>
          {selected ? `${isVote ? 'Голос против' : interaction.verb} · ${name(selected)}` : 'Выберите игрока на столе'}
        </button>
      </div>
    );
  }
  return <div className="mafia-dock mafia-dock--hint">{interaction.text || 'Ждём…'}</div>;
}

export default MafiaRoom;
