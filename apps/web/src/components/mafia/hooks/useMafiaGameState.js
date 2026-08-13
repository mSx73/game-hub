import { useCallback } from 'react';
import { MAFIA_PHASE_LABELS } from '@playforfun/shared-types';

export function useMafiaGameState({
  roomId,
  setGameState,
  setPhase,
  setPhaseTimer,
  setPhaseTimerMax,
  setActionPrompt,
  setActionStatus,
  setGameHistory,
  setMafiaInvestigationLog,
  setRoleCardDismissed,
  toast,
}) {
  const syncSnapshot = useCallback((state) => {
    if (!state || typeof state !== 'object') return;
    setGameState(state);
    if (state?.phase) setPhase(state.phase);
    if (typeof state?.phaseTimer === 'number') setPhaseTimer(state.phaseTimer);
  }, [setGameState, setPhase, setPhaseTimer]);

  const handleMafiaRolePersistence = useCallback((state) => {
    if (state?.gameType !== 'mafia') return;
    if (state?.isModerator) {
      setRoleCardDismissed(true);
      try {
        localStorage.removeItem('mafia-current-role');
      } catch {
        // noop
      }
      return;
    }
    if (state?.myRole) {
      try {
        localStorage.setItem('mafia-current-role', JSON.stringify({
          role: state.myRole,
          timestamp: Date.now(),
          roomId,
        }));
      } catch {
        // noop
      }
    }
  }, [roomId, setRoleCardDismissed]);

  const onGameStarted = useCallback((state) => {
    syncSnapshot(state);
    if (state?.gameType === 'mafia') {
      setMafiaInvestigationLog([]);
      setGameHistory([]);
      setPhase(state?.phase || 'role-reveal');
    } else {
      setPhase(state?.phase || 'playing');
    }
    handleMafiaRolePersistence(state);
  }, [handleMafiaRolePersistence, setGameHistory, setMafiaInvestigationLog, setPhase, syncSnapshot]);

  const onGameSnapshot = useCallback((state) => {
    syncSnapshot(state);
  }, [syncSnapshot]);

  const onGameStateUpdate = useCallback((state) => {
    syncSnapshot(state);
  }, [syncSnapshot]);

  const onPhaseChanged = useCallback((nextPhase, timer, opts) => {
    setPhase(nextPhase);
    setPhaseTimer(timer || 0);
    if (typeof setPhaseTimerMax === 'function') setPhaseTimerMax(timer || 0);
    setActionPrompt(null);
    setActionStatus('');
    if (opts?.waitingMessage) setActionStatus(opts.waitingMessage);
    setGameHistory((prev) => [
      ...prev.slice(-39),
      { t: Date.now(), text: `Фаза: ${MAFIA_PHASE_LABELS[nextPhase] || nextPhase}` },
    ]);
  }, [setActionPrompt, setActionStatus, setGameHistory, setPhase, setPhaseTimer, setPhaseTimerMax]);

  const onActionRequired = useCallback((payload, setSelectedTarget) => {
    setActionPrompt(payload || null);
    setSelectedTarget(payload?.validTargets?.[0] || '');
  }, [setActionPrompt]);

  const onActionResult = useCallback((payload) => {
    setActionStatus(payload?.message || (payload?.success ? 'Действие принято' : 'Действие отклонено'));
    if (payload?.success && payload?.kind === 'investigation' && payload?.message) {
      setMafiaInvestigationLog((prev) => [...prev.slice(-14), { t: Date.now(), text: payload.message }]);
      toast?.info?.(payload.message, { duration: 6000 });
    }
  }, [setActionStatus, setMafiaInvestigationLog, toast]);

  return {
    onGameStarted,
    onGameSnapshot,
    onGameStateUpdate,
    onPhaseChanged,
    onActionRequired,
    onActionResult,
  };
}

