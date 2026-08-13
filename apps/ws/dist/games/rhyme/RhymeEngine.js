import { EventEmitter } from 'events';
import { getRandomWords } from '../../utils/wordDictionary.js';

export class RhymeEngine extends EventEmitter {
  constructor(room) {
    super();
    this.room = room;
    this.settings = room.settings ?? {};
    this.players = room.players.filter(p => !p.isSpectator).map(p => ({ ...p, score: 0 }));
    this.phase = 'waiting';
    this.timer = null;
    this.timeLeft = 0;
    this.round = 0;
    this.maxRounds = this.settings.maxRounds ?? 8;
    this.writeTime = this.settings.writeTime ?? this.settings.creationTime ?? 45;
    this.voteTime = this.settings.voteTime ?? this.settings.votingTime ?? 30;
    this.pointsForWin = this.settings.pointsForWin ?? 2;
    this.bonusForExactRhyme = this.settings.bonusForExactRhyme ?? 1;
    this.currentWord = null;
    this.submissions = new Map();
    this.votes = new Map();
    this.usedWords = new Set();
    this.dictionaryLoaded = false;
    this._aborted = false;
    this._roundDelayTimeout = null;
    this._dictionaryStatusTimeout = null;

    // Use dictionary instead of hardcoded words
    this.words = [];
  }

  loadDictionary() {
    if (this._aborted) return;
    if (this.dictionaryLoaded) return;
    
    this.emit('dictionary:status', { status: 'loading', message: 'Подключаю словарь...' });
    
    const difficulty = this.settings.difficulty ?? 'medium';
    // Get rhymable words (ending patterns)
    const allWords = getRandomWords(200, difficulty);
    // Filter for words that can have rhymes (2+ syllables)
    this.words = allWords.filter(w => w.length >= 5).slice(0, 50);
    
    this.dictionaryLoaded = true;
    
    this.emit('dictionary:status', { status: 'loaded', message: 'Словарь подключен!' });
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    this._dictionaryStatusTimeout = setTimeout(() => {
      this._dictionaryStatusTimeout = null;
      if (!this._aborted) this.emit('dictionary:status', null);
    }, 3000);
  }

  start() {
    if (this._aborted) return;
    this.loadDictionary();
    this.phase = 'playing';
    this.round = 0;
    this.nextRound();
  }

  nextRound() {
    if (this._aborted) return;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    this.round++;
    if (this.round > this.maxRounds) { this.endGame(); return; }

    this.submissions.clear();
    this.votes.clear();

    let availableIndices = this.words.map((_, i) => i).filter((i) => !this.usedWords.has(i));
    if (availableIndices.length === 0) {
      this.usedWords.clear();
      availableIndices = this.words.map((_, i) => i);
    }
    const wordIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    this.usedWords.add(wordIdx);
    this.currentWord = this.words[wordIdx];

    this.phase = 'writing';
    this.timeLeft = this.writeTime;

    this.emit('round:started', {
      round: this.round, maxRounds: this.maxRounds,
      word: this.currentWord, timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.startVoting();
      }
    }, 1000);
  }

  submitAnswer(playerId, answer) {
    if (this._aborted) return false;
    if (this.phase !== 'writing') return false;
    if (this.submissions.has(playerId)) return false;
    const text = answer.trim();
    if (!text || text.length < 3) return false;

    this.submissions.set(playerId, text);
    this.emit('answer:submitted', { playerId, total: this.submissions.size, required: this.players.length });

    if (this.submissions.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.startVoting();
    }
    return true;
  }

  startVoting() {
    if (this._aborted) return;
    this.phase = 'voting';
    this.votes.clear();
    this.timeLeft = this.voteTime;

    const anonymousAnswers = [];
    const entries = [...this.submissions.entries()];
    const shuffled = entries.sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      anonymousAnswers.push({ index: i, text: shuffled[i][1], _playerId: shuffled[i][0] });
    }
    this._votingMap = anonymousAnswers;

    this.emit('voting:started', {
      word: this.currentWord,
      anonymousAnswers: anonymousAnswers.map(a => ({ index: a.index, text: a.text })),
      timeLeft: this.timeLeft,
    });

    this.timer = setInterval(() => {
      if (this._aborted) return;
      this.timeLeft--;
      this.emit('timer:tick', this.timeLeft);
      if (this.timeLeft <= 0) {
        this.stopTimer();
        if (!this._aborted) this.resolveVotes();
      }
    }, 1000);
  }

  vote(voterId, answerIndex) {
    if (this._aborted) return false;
    if (this.phase !== 'voting') return false;
    if (this.votes.has(voterId)) return false;
    if (!this._votingMap) return false;

    const target = this._votingMap.find(a => a.index === answerIndex);
    if (!target) return false;
    if (target._playerId === voterId) return false;

    this.votes.set(voterId, answerIndex);
    this.emit('vote:cast', { voterId, total: this.votes.size, required: this.players.length });

    if (this.votes.size >= this.players.length) {
      this.stopTimer();
      if (!this._aborted) this.resolveVotes();
    }
    return true;
  }

  resolveVotes() {
    if (this._aborted) return;
    if (this.phase === 'finished') return;
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (!this._votingMap) return;

    const tally = new Map();
    for (const idx of this.votes.values()) {
      tally.set(idx, (tally.get(idx) ?? 0) + 1);
    }

    let maxVotes = 0, winnerIdx = null;
    for (const [idx, count] of tally) {
      if (count > maxVotes) { maxVotes = count; winnerIdx = idx; }
    }

    const winnerEntry = this._votingMap.find(a => a.index === winnerIdx);
    const winnerId = winnerEntry?._playerId ?? null;
    const winnerPlayer = this.players.find(p => p.id === winnerId);
    if (winnerPlayer) {
      let earned = this.pointsForWin;
      const winnerText = (winnerEntry?.text || '').trim().toLowerCase();
      const targetText = (this.currentWord || '').trim().toLowerCase();
      if (winnerText !== targetText) earned += this.bonusForExactRhyme;
      winnerPlayer.score += earned;
    }

    const results = this._votingMap.map(a => ({
      index: a.index, text: a.text,
      playerId: a._playerId,
      playerName: this.players.find(p => p.id === a._playerId)?.name ?? '—',
      votes: tally.get(a.index) ?? 0,
      isWinner: a.index === winnerIdx,
    }));

    this.emit('round:ended', {
      round: this.round, word: this.currentWord,
      winner: winnerId,
      winnerName: winnerPlayer?.name ?? null,
      results,
    });
    this.emit('score:updated', {
      players: this.players.map(p => ({ id: p.id, name: p.name, score: p.score })),
    });

    this._votingMap = null;
    if (this.round >= this.maxRounds) {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.endGame();
      }, 3000);
    } else {
      this._roundDelayTimeout = setTimeout(() => {
        this._roundDelayTimeout = null;
        if (!this._aborted) this.nextRound();
      }, 3000);
    }
  }

  endGame() {
    if (this._aborted) return;
    this.phase = 'finished';
    this.stopTimer();
    const sorted = [...this.players].sort((a, b) => b.score - a.score);
    this.emit('game:ended', { winner: sorted[0] ?? null, players: sorted });
  }

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  }

  cleanup() {
    this._aborted = true;
    this.stopTimer();
    if (this._roundDelayTimeout) {
      clearTimeout(this._roundDelayTimeout);
      this._roundDelayTimeout = null;
    }
    if (this._dictionaryStatusTimeout) {
      clearTimeout(this._dictionaryStatusTimeout);
      this._dictionaryStatusTimeout = null;
    }
    this.removeAllListeners();
  }

  getState() {
    return {
      phase: this.phase, players: this.players,
      round: this.round, maxRounds: this.maxRounds,
      timeLeft: this.timeLeft, currentWord: this.currentWord,
      submissionsCount: this.submissions.size,
      votesCount: this.votes.size,
    };
  }
}
