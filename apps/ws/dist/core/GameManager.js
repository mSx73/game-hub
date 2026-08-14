/**
 * Centralized game action router.
 * All client game actions should pass through this controller.
 */
export class GameManager {
  constructor({ io, roomManager, newGameTypes = new Set() }) {
    this.io = io;
    this.roomManager = roomManager;
    this.newGameTypes = newGameTypes;
  }

  handleAction(socket, action, callback) {
    const room = this.roomManager.getRoomByPlayer(socket.id);
    if (!room || room.status !== 'playing') return false;

    const engine = this.roomManager.getGameEngine(room.code);
    if (!engine) return false;

    const gameType = room.gameType;
    if (this.newGameTypes.size > 0 && !this.newGameTypes.has(gameType)) return false;

    if (typeof engine.handleAction === 'function') {
      engine.handleAction(socket.id, action);
      callback?.({ success: true });
      return true;
    }

    const t = action?.type;
    switch (t) {
      case 'vote':
        if (gameType === 'rhyme' && engine.vote) engine.vote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'bluff' && engine.castVote) engine.castVote(socket.id, action.defIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'fibbing' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'connect' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'caption' && engine.castVote) engine.castVote(socket.id, action.answerIdx ?? action.index ?? action.targetIndex);
        else if (gameType === 'psych' && engine.castVote) engine.castVote(socket.id, { index: action.answerIdx ?? action.answerIndex, playerId: action.targetId });
        else if (gameType === 'prediction' && engine.submitVote) engine.submitVote(socket.id, action.targetId ?? action.votedForId);
        else if (gameType === 'impostor' && engine.vote) engine.vote(socket.id, action.targetId ?? action.votedForId);
        else if (gameType === 'collage' && engine.submitCollageVote) engine.submitCollageVote(socket.id, action.pieceIndex ?? action.index ?? action.answerIdx);
        else if (gameType === 'fakeartist' && engine.vote) engine.vote(socket.id, action.targetId);
        else if (engine.vote) engine.vote(socket.id, action.targetId ?? action.vote ?? action.answerId ?? action.index);
        else if (engine.castVote) engine.castVote(socket.id, action.targetId ?? action.targetIndex ?? action.index);
        else if (engine.submitVote) engine.submitVote(socket.id, action.targetId ?? action.votedForId);
        break;
      case 'answer':
        if (engine.submitAnswer) {
          if (gameType === 'quiz') {
            const idx = action.answerIndex ?? action.index;
            if (typeof idx === 'number' && !Number.isNaN(idx)) engine.submitAnswer(socket.id, idx);
          } else {
            engine.submitAnswer(socket.id, action.text ?? action.value ?? action.answer);
          }
        }
        break;
      case 'submit-facts':
        if (engine.submitFacts) engine.submitFacts(socket.id, action.facts, action.lieIndex);
        break;
      case 'guess':
        if (engine.submitGuess) engine.submitGuess(socket.id, action.guess ?? action.value ?? action.guessIndex);
        break;
      case 'submit-association':
        if (engine.submitAssociation) engine.submitAssociation(socket.id, action.word);
        break;
      case 'add-words':
        if (engine.addWords && Array.isArray(action.words)) engine.addWords(socket.id, action.words);
        break;
      case 'submit-sentence':
        if (gameType === 'collage' && engine.submitPiece) engine.submitPiece(socket.id, action.text);
        else if (engine.submitSentence) engine.submitSentence(socket.id, action.text);
        break;
      case 'ask':
        if (engine.askQuestion) engine.askQuestion(socket.id, action.question);
        break;
      case 'pass':
        if (engine.passTurn) engine.passTurn(socket.id);
        break;
      case 'clue':
        if (engine.submitClue) engine.submitClue(socket.id, action.clue ?? action.text);
        break;
      default:
        return false;
    }

    callback?.({ success: true });
    return true;
  }
}
