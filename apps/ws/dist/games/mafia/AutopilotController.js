import { getMafiaActionTypeForPhase } from '@playforfun/shared-types';

const DEFAULT_AUTOPILOT_PHASE_TIMEOUTS = Object.freeze({
  'role-reveal': 8,
  'don-election': 25,
  intro: 45,
  'night-start': 5,
  'night-putana': 30,
  'night-doctor': 30,
  'night-mafia': 30,
  'night-maniac': 30,
  'night-poisoner': 30,
  'night-sheriff': 30,
  'night-don': 30,
  'night-bodyguard': 30,
  'night-journalist': 30,
  'night-end': 5,
  morning: 10,
  discussion: 60,
  voting: 30,
  votingTieDiscussion: 30,
  votingRevote: 30,
  'vote-result': 8,
});

export class AutopilotController {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.enabled = !!options.enabled;
    this.logger = options.logger || console;
    this.phaseTimer = null;
    this.pendingTimer = null;
    this.pendingGraceMs = Number.isFinite(options.pendingGraceMs) ? options.pendingGraceMs : 5000;
    this.boundOnPhaseChanged = this.onPhaseChanged.bind(this);
    this.boundOnPendingActions = this.onPendingActions.bind(this);
    this.boundOnAllVotesCollected = this.onAllVotesCollected.bind(this);
    this.boundOnGameEnded = this.cleanup.bind(this);
    this.onMetric = typeof options.onMetric === 'function' ? options.onMetric : null;
  }

  attach() {
    if (!this.enabled) return;
    this.engine.on('game:phase-changed', this.boundOnPhaseChanged);
    this.engine.on('game:pending-actions-updated', this.boundOnPendingActions);
    this.engine.on('game:all-votes-collected', this.boundOnAllVotesCollected);
    this.engine.on('game:ended', this.boundOnGameEnded);
  }

  cleanup() {
    if (this.phaseTimer) {
      clearTimeout(this.phaseTimer);
      this.phaseTimer = null;
    }
    if (this.pendingTimer) {
      clearTimeout(this.pendingTimer);
      this.pendingTimer = null;
    }
    this.engine.off('game:phase-changed', this.boundOnPhaseChanged);
    this.engine.off('game:pending-actions-updated', this.boundOnPendingActions);
    this.engine.off('game:all-votes-collected', this.boundOnAllVotesCollected);
    this.engine.off('game:ended', this.boundOnGameEnded);
  }

  onPhaseChanged(phase, timerSec) {
    if (!this.enabled) return;
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    if (phase === 'gameOver') return;
    const durationSec = timerSec > 0 ? timerSec : (DEFAULT_AUTOPILOT_PHASE_TIMEOUTS[phase] || 20);
    this.phaseTimer = setTimeout(() => {
      try {
        if (this.engine.getState().phase === phase) this.engine.forceNextPhase();
      } catch (err) {
        this.logger.warn?.(`[Autopilot] phase fallback failed: ${err.message}`);
      }
    }, Math.max(1, durationSec) * 1000);
  }

  onPendingActions(playerIds) {
    if (!this.enabled) return;
    if (!Array.isArray(playerIds) || playerIds.length === 0) return;
    if (this.pendingTimer) clearTimeout(this.pendingTimer);
    this.pendingTimer = setTimeout(() => {
      this.resolvePendingActions(playerIds);
    }, this.pendingGraceMs);
  }

  onAllVotesCollected() {
    if (!this.enabled) return;
    try {
      this.engine.forceNextPhase();
      this.recordMetric('all_votes_collected_advance');
    } catch (err) {
      this.logger.warn?.(`[Autopilot] unable to force next phase: ${err.message}`);
    }
  }

  resolvePendingActions(playerIds) {
    const state = this.engine.getState();
    const phase = state.phase;
    for (const playerId of playerIds) {
      if (!state.pendingActions.has(playerId)) continue;
      const action = this.buildFallbackAction(playerId, state);
      if (!action) continue;
      const accepted = this.engine.handleAction(playerId, action);
      this.recordMetric(accepted ? 'fallback_action_applied' : 'fallback_action_rejected');
    }
    if (this.engine.getState().pendingActions.size > 0) {
      this.engine.forceNextPhase();
      this.recordMetric('forced_phase_advance_pending');
    }
  }

  buildFallbackAction(playerId, state) {
    const phase = state.phase;
    const actionType = getMafiaActionTypeForPhase(phase);
    if (!actionType) return null;
    const targetId = this.pickTargetForPhase(playerId, state);
    if (!targetId) return null;
    return { type: actionType, targetId };
  }

  pickTargetForPhase(playerId, state) {
    const phase = state.phase;
    const includeSelf = phase === 'night-doctor' || phase === 'don-election';
    const aliveOnly = state.players.filter((p) => p.status === 'alive').map((p) => p.id);
    const townIds = state.players
      .filter((p) => p.status === 'alive' || p.status === 'poisoned')
      .map((p) => p.id);
    const mafiaIds = state.players
      .filter((p) => (p.status === 'alive' || p.status === 'poisoned') && p.team === 'mafia')
      .map((p) => p.id);

    let candidates;
    if (phase === 'voting' || phase === 'votingRevote') {
      candidates = townIds.filter((id) => id !== playerId);
      if (phase === 'votingRevote' && Array.isArray(this.engine.pendingRevoteCandidates) && this.engine.pendingRevoteCandidates.length > 0) {
        const revoteSet = new Set(this.engine.pendingRevoteCandidates);
        candidates = candidates.filter((id) => revoteSet.has(id));
      }
    } else if (phase === 'don-election') {
      candidates = mafiaIds;
    } else {
      candidates = includeSelf ? aliveOnly : aliveOnly.filter((id) => id !== playerId);
    }

    if (!candidates || candidates.length === 0) return null;
    return [...candidates].sort((a, b) => String(a).localeCompare(String(b)))[0];
  }

  recordMetric(name) {
    if (!this.onMetric) return;
    this.onMetric(name);
  }
}

