import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function VoteBooth({
  candidates = [],
  votes = {},
  totalVotes = 0,
  playerById,
  onSubmitVote,
  showResults = false,
  canSubmit = true,
  disabledHint = null,
  hintSuffix = '',
  votedCount = 0,
  totalVoters = 0,
}) {
  const handleVote = (candidateId) => {
    if (onSubmitVote && !showResults && canSubmit) onSubmitVote(candidateId);
  };

  const maxVotes = Math.max(1, ...Object.values(votes));

  return (
    <motion.div
      className="vote-booth"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 28 }}
    >
      <div className="vote-booth-header">
        <h3 className="vote-booth-title">
          {showResults ? 'Результаты голосования' : 'Кого изгоняем?'}
        </h3>
        {totalVoters > 0 && (
          <div
            className="vote-progress-pill"
            role="status"
            aria-label={`Проголосовали ${votedCount} из ${totalVoters}`}
          >
            <span className="vote-progress-voted">{votedCount}</span>
            <span className="vote-progress-sep">/</span>
            <span className="vote-progress-total">{totalVoters}</span>
            <span className="vote-progress-label">голосов</span>
          </div>
        )}
      </div>

      {!showResults && !canSubmit && disabledHint && (
        <div className="vote-readonly-notice" role="status">{disabledHint}</div>
      )}

      {!showResults && (
        <p className="vote-hint">
          Нажмите на игрока, чтобы проголосовать за изгнание.{hintSuffix}
        </p>
      )}

      {!showResults ? (
        <div className="vote-candidates-grid">
          {candidates.map((candidate) => {
            const p = typeof candidate === 'string'
              ? { id: candidate, name: playerById?.get?.(candidate)?.name || candidate }
              : candidate;
            const voteCount = votes[p.id] ?? 0;
            const barPercent = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const initial = (p.name || '?')[0].toUpperCase();

            return (
              <motion.button
                key={p.id}
                type="button"
                className={`vote-candidate-card${!canSubmit ? ' vote-candidate--readonly' : ''}`}
                whileHover={canSubmit ? { scale: 1.04 } : {}}
                whileTap={canSubmit ? { scale: 0.96 } : {}}
                onClick={() => handleVote(p.id)}
                disabled={!canSubmit}
                aria-label={`Голосовать за ${p.name}`}
              >
                <div className="vote-candidate-avatar">
                  {initial}
                  <AnimatePresence>
                    {voteCount > 0 && (
                      <motion.div
                        className="vote-count-badge"
                        key={voteCount}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                      >
                        {voteCount}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <span className="vote-candidate-name">{p.name || p.id}</span>
                {totalVotes > 0 && (
                  <div className="vote-candidate-bar-wrap">
                    <motion.div
                      className="vote-candidate-bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${barPercent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      ) : (
        <div className="vote-results">
          {[...candidates]
            .sort((a, b) => {
              const idA = typeof a === 'string' ? a : a.id;
              const idB = typeof b === 'string' ? b : b.id;
              return (votes[idB] ?? 0) - (votes[idA] ?? 0);
            })
            .map((candidate) => {
              const p = typeof candidate === 'string'
                ? { id: candidate, name: playerById?.get?.(candidate)?.name || candidate }
                : candidate;
              const voteCount = votes[p.id] ?? 0;
              const percent = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

              return (
                <div key={p.id} className="vote-result-row">
                  <span className="vote-result-name">{p.name || p.id}</span>
                  <div className="vote-result-bar-wrap">
                    <motion.div
                      className="vote-result-bar"
                      initial={{ width: 0 }}
                      animate={{ width: `${percent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
                    />
                  </div>
                  <span className="vote-result-count">{voteCount}</span>
                </div>
              );
            })}
        </div>
      )}
    </motion.div>
  );
}
