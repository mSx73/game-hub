import React, { useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PlayerSeat, calculateSeatPosition } from './components/PlayerSeat';
import { PhaseOverlay } from './components/PhaseOverlay';
import { TimerRing } from './components/TimerRing';
import { ActionPanel } from './components/ActionPanel';
import { RoleCard } from './components/RoleCard';
import { DeathReveal } from './components/DeathReveal';
import { VoteBooth } from './components/VoteBooth';

import { useSoundEffects } from './hooks/useSoundEffects';
import { usePhaseAnimation } from './hooks/usePhaseAnimation';
import './styles/mafia-table.css';
import './styles/animations.css';
import './styles/themes/noir-theme.css';
import './styles/themes/cyber-theme.css';

/* ─── Constants ─── */

const PHASE_LABELS = {
  waiting:              'Ожидание',
  'role-reveal':        'Раздача ролей',
  'night-start':        'Ночь',
  'don-election':       'Выбор дона',
  intro:                'Вступление',
  'night-mafia':        'Мафия действует',
  'night-don':          'Дон смотрит',
  'night-doctor':       'Доктор лечит',
  'night-sheriff':      'Шериф проверяет',
  'night-bodyguard':    'Телохранитель охраняет',
  'night-journalist':   'Журналист следит',
  'night-maniac':       'Маньяк охотится',
  'night-poisoner':     'Отравитель действует',
  'night-putana':       'Путана блокирует',
  'night-waiting':      'Ночь',
  'night-end':          'Конец ночи',
  morning:              'Утро',
  discussion:           'Обсуждение',
  voting:               'Голосование',
  votingTieDiscussion:  'Ничья',
  votingRevote:         'Переголосование',
  'vote-result':        'Итог голосования',
  gameOver:             'Конец игры',
};

const NIGHT_PHASES = new Set([
  'night-waiting', 'night-mafia', 'night-don', 'night-doctor',
  'night-sheriff', 'night-bodyguard', 'night-journalist',
  'night-maniac', 'night-poisoner', 'night-putana',
]);

const VOTING_PHASES = new Set(['voting', 'votingRevote', 'vote-result', 'votingTieDiscussion']);

const PHASE_DURATIONS = {
  'role-reveal': 8,   'don-election': 25, intro: 45,
  'night-mafia': 30,  'night-don': 30,    'night-doctor': 30,
  'night-sheriff': 30,'night-bodyguard': 30,'night-journalist': 30,
  'night-maniac': 30, 'night-poisoner': 30,'night-putana': 30,
  'night-end': 5,     morning: 10,         discussion: 60,
  voting: 30,         'vote-result': 15,
};

const ROLE_NAMES = {
  civilian:'Мирный',  citizen:'Мирный',   mafia:'Мафия',
  don:'Дон',          sheriff:'Шериф',     doctor:'Доктор',
  putana:'Путана',    poisoner:'Отравитель',maniac:'Маньяк',
  bodyguard:'Телохранитель', journalist:'Журналист', mayor:'Мэр',
};

const ROLE_COLORS = {
  civilian:'#6366f1', citizen:'#6366f1',  mafia:'#C0392B',
  don:'#7c3aed',      sheriff:'#F59E0B',   doctor:'#10B981',
  putana:'#ec4899',   poisoner:'#8b5cf6',  maniac:'#EF4444',
  bodyguard:'#0ea5e9',journalist:'#d97706',mayor:'#b45309',
};

const ROLE_DESCRIPTIONS = {
  civilian:   'Днём обсуждайте и голосуйте. Ночью вы спите.',
  citizen:    'Днём обсуждайте и голосуйте. Ночью вы спите.',
  mafia:      'Ночью выбирайте жертву. Днём притворяйтесь мирным.',
  don:        'Вы мафия. Ночью проверяйте, кто шериф.',
  sheriff:    'Ночью проверяйте игроков. Днём убеждайте город.',
  doctor:     'Ночью лечите игрока, чтобы спасти от убийства.',
  putana:     'Ночью посещайте игрока: его голос на след. день не учитывается.',
  poisoner:   'Ночью выбирайте цель для отравления.',
  maniac:     'Ночью выбирайте жертву. У вас своя победа.',
  bodyguard:  'Ночью выберите жителя: если его убивают — погибаете вместо него.',
  journalist: 'Ночью проверяйте: «красный» = любая мафия.',
  mayor:      'Днём ваш голос на изгнание считается за два.',
};

function getPhaseDuration(phase) {
  return PHASE_DURATIONS[phase] ?? 30;
}

function getPhaseType(phase) {
  if (NIGHT_PHASES.has(phase) || phase === 'night-start' || phase === 'night-end') return 'night';
  if (VOTING_PHASES.has(phase)) return 'voting';
  if (phase === 'gameOver') return 'gameover';
  return 'day';
}

/* ─── MafiaHeader ─── */

function MafiaHeader({ phase, phaseTimer, phaseTimerMax, myRole, aliveCount, totalCount, isModerator }) {
  const phaseLabel = PHASE_LABELS[phase] || phase;
  const phaseType = getPhaseType(phase);
  const roleKey = (myRole || '').toLowerCase();
  const roleColor = ROLE_COLORS[roleKey];
  const roleName = ROLE_NAMES[roleKey];
  const isNight = phaseType === 'night';
  const showTimer = phaseTimer > 0;
  const maxTime = phaseTimerMax > 0 ? phaseTimerMax : getPhaseDuration(phase);

  return (
    <header className="mafia-header">
      <div className="mafia-header__left">
        <AnimatePresence mode="wait">
          <motion.div
            key={phase}
            className={`mafia-phase-badge mafia-phase-badge--${phaseType}`}
            initial={{ opacity: 0, scale: 0.8, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 6 }}
            transition={{ duration: 0.25 }}
          >
            <span aria-hidden>{isNight ? '🌙' : phaseType === 'voting' ? '⚖️' : phaseType === 'gameover' ? '🏁' : '☀️'}</span>
            {phaseLabel}
          </motion.div>
        </AnimatePresence>

        {totalCount > 0 && (
          <div className="mafia-alive-count" aria-label={`Живых ${aliveCount} из ${totalCount}`}>
            <span className="mafia-alive-count__dot" />
            {aliveCount}/{totalCount}
          </div>
        )}
      </div>

      <div className="mafia-header__right">
        {showTimer && (
          <TimerRing time={phaseTimer} maxTime={maxTime} />
        )}

        {myRole && !isModerator && roleColor && (
          <div
            className="mafia-my-role-pill"
            style={{
              color: roleColor,
              borderColor: `${roleColor}55`,
              background: `${roleColor}12`,
            }}
            aria-label={`Ваша роль: ${roleName || myRole}`}
          >
            {ROLE_NAMES[(myRole||'').toLowerCase()] || myRole}
          </div>
        )}
        {isModerator && (
          <div className="mafia-my-role-pill" style={{ color: '#94A3B8', borderColor: '#94A3B855', background: '#94A3B812' }}>
            Ведущий
          </div>
        )}
      </div>
    </header>
  );
}

/* ─── Main Component ─── */

export function MafiaGameTable({
  playerId,
  isHost,
  isModerator = false,
  canSubmitVote = true,
  voteDisabledReason = null,
  phase,
  phaseTimer,
  phaseTimerMax = 0,
  actionStatus,
  players = [],
  actionPrompt,
  selectedTarget,
  playerById,
  onSelectTarget,
  onSubmitAction,
  myRole,
  roleCardDismissed,
  onRoleCardDismiss,
  lastDeathReveal,
  onDeathRevealComplete,
  voteCandidates,
  voteCounts,
  onVoteSubmit,
  votedCount = 0,
  totalVoters = 0,
  mafiaMates = [],
  investigationLog = [],
  theme = 'default',
  soundEnabled = true,
  rainbowMode = false,
  gameStats = null,
  speakingPlayerId = null,
  children,
}) {
  const { play, startAmbience } = useSoundEffects({ enabled: soundEnabled });

  usePhaseAnimation(phase, {
    onPhaseChange: (newPhase) => {
      play('phaseChange');
      if (newPhase === 'gameOver') play('winFanfare');
    },
  });

  useEffect(() => { startAmbience(phase); }, [phase, startAmbience]);
  useEffect(() => { if (lastDeathReveal) play('deathSting'); }, [lastDeathReveal, play]);
  useEffect(() => {
    if (phase !== 'role-reveal' || roleCardDismissed || !myRole) return;
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onRoleCardDismiss?.();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, roleCardDismissed, myRole, onRoleCardDismiss]);

  /* Merged player map for lookups */
  const mergedPlayerById = useMemo(() => {
    const map = new Map();
    (playerById ? Array.from(playerById.entries()) : []).forEach(([id, p]) => map.set(id, p));
    players.forEach((p) => map.set(p.id, p));
    return map;
  }, [playerById, players]);

  const isTargetable = (player) => {
    if (!actionPrompt?.validTargets?.length) return false;
    if (player.status === 'dead') return false;
    return actionPrompt.validTargets.includes(player.id);
  };

  const isVotingPhase = VOTING_PHASES.has(phase);
  const isVoteResultPhase = phase === 'vote-result';
  const votingCandidates = voteCandidates ?? actionPrompt?.validTargets ?? [];
  const showVoteBooth = (isVotingPhase || isVoteResultPhase) && votingCandidates.length > 0;
  const totalVotesCount = voteCounts ? Object.values(voteCounts).reduce((a, b) => a + b, 0) : 0;

  const isNightWaiting = phase === 'night-waiting';
  const isGameOver = phase === 'gameOver';

  const aliveCount = players.filter((p) => p.status === 'alive' || p.status === 'poisoned').length;
  const totalCount = players.length;

  const showInvestigationPanel =
    !isModerator && (myRole === 'sheriff' || myRole === 'don' || myRole === 'journalist');

  const themeClass = theme === 'noir' ? 'theme-noir' : theme === 'cyber' ? 'theme-cyber' : '';
  const rainbowClass = rainbowMode ? 'rainbow-mode' : '';

  const speakingIds = useMemo(
    () => (speakingPlayerId ? new Set([speakingPlayerId]) : new Set()),
    [speakingPlayerId],
  );

  return (
    <div className={`mafia-table-container ${themeClass} ${rainbowClass}`}>
      {/* Atmosphere */}
      <PhaseOverlay phase={phase} />

      {/* Sticky header */}
      <MafiaHeader
        phase={phase}
        phaseTimer={phaseTimer}
        phaseTimerMax={phaseTimerMax}
        myRole={myRole}
        aliveCount={aliveCount}
        totalCount={totalCount}
        isModerator={isModerator}
      />

      {/* Game body */}
      <div className="mafia-table-body">

        {/* Game over screen */}
        {isGameOver && (
          <motion.div
            className="mafia-gameover"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, type: 'spring' }}
          >
            <div className="mafia-gameover-icon">🏆</div>
            <div className="mafia-gameover-title">
              {actionStatus || 'Игра окончена'}
            </div>

            {gameStats && gameStats.length > 0 && (
              <div className="mafia-gameover-roles">
                {[...gameStats]
                  .sort((a, b) => {
                    const teamOrder = { mafia: 0, maniac: 1, civilian: 2 };
                    return (teamOrder[a.team] ?? 3) - (teamOrder[b.team] ?? 3);
                  })
                  .map((p, i) => {
                    const roleKey = (p.role || '').toLowerCase();
                    const color = ROLE_COLORS[roleKey] || '#6366f1';
                    const roleName = ROLE_NAMES[roleKey] || p.role;
                    return (
                      <motion.div
                        key={i}
                        className={`mafia-gameover-player ${p.survived ? 'mafia-gameover-player--alive' : 'mafia-gameover-player--dead'}`}
                        initial={{ opacity: 0, x: -12 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.06, duration: 0.3 }}
                      >
                        <span className="mafia-gameover-player__dot" style={{ background: color }} />
                        <span className="mafia-gameover-player__name">{p.name}</span>
                        <span className="mafia-gameover-player__role" style={{ color }}>{roleName}</span>
                        <span className={`mafia-gameover-player__status ${p.survived ? 'survived' : 'dead'}`}>
                          {p.survived ? '✓' : '✗'}
                        </span>
                      </motion.div>
                    );
                  })}
              </div>
            )}

            <div className="mafia-gameover-subtitle">Спасибо за игру!</div>
          </motion.div>
        )}

        {/* Oval table with player seats */}
        {!isGameOver && (
          <div className="mafia-table" role="group" aria-label="Игровой стол">
            {/* Night atmosphere in center */}
            {isNightWaiting && (
              <div className="mafia-night-waiting" aria-live="polite" aria-label="Ночь">
                <div className="mafia-night-moon" aria-hidden>🌙</div>
                <div className="mafia-night-text">{actionStatus || 'Ночь…'}</div>
                <div className="mafia-night-zzz" aria-hidden>
                  <span>z</span><span>z</span><span>z</span>
                </div>
              </div>
            )}

            {/* Center: timer + phase for non-night phases */}
            {!isNightWaiting && (
              <div className="mafia-table-center" aria-hidden>
                {/* decorative inner felt ring only */}
              </div>
            )}

            {/* Player seats around the oval */}
            {players.map((player, index) => (
              <PlayerSeat
                key={player.id}
                player={player}
                position={calculateSeatPosition(index, players.length)}
                isSelf={player.id === playerId}
                isTargetable={isTargetable(player)}
                isTargeted={selectedTarget === player.id}
                isVoteBlocked={!!player.cannotVoteNextDay}
                isSpeaking={speakingIds.has(player.id)}
                seatNumber={index + 1}
                onClick={onSelectTarget}
              />
            ))}
          </div>
        )}

        {/* Status line below table */}
        {actionStatus && !isNightWaiting && !isGameOver && (
          <motion.div
            key={actionStatus}
            className="mafia-status-line"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
          >
            {actionStatus}
          </motion.div>
        )}

        {/* Investigation log */}
        {showInvestigationPanel && (
          <aside
            className="mafia-investigation-log"
            aria-label="Журнал проверок"
          >
            <div className="mafia-investigation-log__title">
              {myRole === 'don' ? 'Проверки дона' : myRole === 'journalist' ? 'Проверки журналиста' : 'Проверки шерифа'}
            </div>
            <p className="mafia-investigation-log__hint">
              Итог ночной проверки сохраняется здесь.
            </p>
            {investigationLog.length === 0 ? (
              <p className="mafia-investigation-log__empty">Пока нет проверок в этой партии.</p>
            ) : (
              <ul className="mafia-investigation-log__list">
                {investigationLog.map((row, i) => (
                  <li key={`${row.t}-${i}`}>{row.text}</li>
                ))}
              </ul>
            )}
          </aside>
        )}

        {children}
      </div>

      {/* ── Role card reveal overlay ── */}
      {phase === 'role-reveal' && !roleCardDismissed && myRole && (
        <div className="mafia-role-reveal-overlay">
          <RoleCard
            role={myRole}
            isRevealed
            onDismiss={onRoleCardDismiss}
            description={ROLE_DESCRIPTIONS[myRole?.toLowerCase()]}
            mafiaMates={mafiaMates}
          />
        </div>
      )}

      {/* ── Death reveal ── */}
      {lastDeathReveal && (
        <DeathReveal
          player={lastDeathReveal.player}
          role={lastDeathReveal.role}
          cause={lastDeathReveal.cause}
          onComplete={onDeathRevealComplete}
        />
      )}

      {/* ── Vote booth (bottom sheet) ── */}
      {showVoteBooth && (
        <div className="mafia-vote-booth-wrapper">
          <VoteBooth
            candidates={votingCandidates}
            votes={voteCounts || {}}
            totalVotes={totalVotesCount}
            hintSuffix={myRole === 'mayor' ? ' Ваш голос мэра считается за два.' : ''}
            playerById={mergedPlayerById}
            onSubmitVote={(id) => {
              play('voteConfirm');
              onVoteSubmit?.(id);
            }}
            showResults={isVoteResultPhase}
            canSubmit={!isVoteResultPhase && canSubmitVote}
            disabledHint={voteDisabledReason}
            votedCount={votedCount}
            totalVoters={totalVoters}
          />
        </div>
      )}

      {/* ── Night action panel (bottom sheet) ── */}
      {!showVoteBooth && actionPrompt && !isModerator && (
        <ActionPanel
          prompt={actionPrompt}
          selectedTarget={selectedTarget}
          validTargets={actionPrompt?.validTargets}
          playerById={mergedPlayerById}
          onConfirm={(targetId) => onSubmitAction?.(targetId)}
          onSelectTarget={onSelectTarget}
        />
      )}
    </div>
  );
}
