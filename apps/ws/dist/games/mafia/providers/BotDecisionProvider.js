class DeterministicBotDecisionProvider {
  chooseTarget(candidates = []) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    return [...candidates].sort((a, b) => String(a).localeCompare(String(b)))[0];
  }
}

class MentionWeightedBotDecisionProvider extends DeterministicBotDecisionProvider {
  chooseTarget(candidates = [], context = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) return null;
    const mentionStats = context?.mentionStats || {};
    let best = null;
    let bestScore = -1;
    for (const c of candidates) {
      const score = Number(mentionStats[c]?.count || 0);
      if (score > bestScore) {
        bestScore = score;
        best = c;
      }
    }
    return best || super.chooseTarget(candidates);
  }
}

export function createBotDecisionProvider(mode = process.env.MAFIA_AI_BOTS_MODE || 'deterministic') {
  if (mode === 'mentions') return new MentionWeightedBotDecisionProvider();
  return new DeterministicBotDecisionProvider();
}

