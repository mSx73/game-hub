import { useCallback, useRef, useEffect } from 'react';

const SOUND_PATHS = {
  phaseChange: '/sounds/phase-change.mp3',
  nightAmbience: '/sounds/night-ambience.mp3',
  deathSting: '/sounds/death-sting.mp3',
  voteConfirm: '/sounds/vote-confirm.mp3',
  winFanfare: '/sounds/win-fanfare.mp3',
  mafiaWhisper: '/sounds/whisper.mp3',
};

/** Простой тон через Web Audio API (fallback если файлов нет) */
function playFallbackTone(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.value = 0.15;
    if (type === 'phase') {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
    } else if (type === 'death') {
      osc.frequency.setValueAtTime(200, ctx.currentTime);
      osc.type = 'sawtooth';
    } else if (type === 'vote') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
    } else if (type === 'win') {
      osc.frequency.setValueAtTime(523, ctx.currentTime);
      osc.frequency.setValueAtTime(659, ctx.currentTime + 0.1);
      osc.frequency.setValueAtTime(784, ctx.currentTime + 0.2);
    }
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.2);
  } catch {
    // noop
  }
}

export function useSoundEffects({ enabled = true } = {}) {
  const ambienceRef = useRef(null);
  const audioCache = useRef(new Map());

  const getAudio = useCallback((name) => {
    if (!audioCache.current.has(name)) {
      const path = SOUND_PATHS[name];
      if (!path) return null;
      const audio = new Audio(path);
      audio.volume = 0.4;
      audioCache.current.set(name, audio);
    }
    return audioCache.current.get(name);
  }, []);

  const play = useCallback(
    (soundName) => {
      if (!enabled) return;
      const audio = getAudio(soundName);
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          const fallback = { phaseChange: 'phase', deathSting: 'death', voteConfirm: 'vote', winFanfare: 'win' }[soundName];
          if (fallback) playFallbackTone(fallback);
        });
      } else {
        const fallback = { phaseChange: 'phase', deathSting: 'death', voteConfirm: 'vote', winFanfare: 'win' }[soundName];
        if (fallback) playFallbackTone(fallback);
      }
    },
    [enabled, getAudio]
  );

  const startAmbience = useCallback(
    (phase) => {
      if (!enabled) return;
      const isNight = String(phase || '').startsWith('night-');
      if (isNight) {
        if (!ambienceRef.current) {
          const audio = getAudio('nightAmbience');
          if (audio) {
            audio.loop = true;
            audio.volume = 0.2;
            audio.play().catch(() => {});
            ambienceRef.current = audio;
          }
        }
      } else {
        if (ambienceRef.current) {
          ambienceRef.current.pause();
          ambienceRef.current = null;
        }
      }
    },
    [enabled, getAudio]
  );

  const stopAmbience = useCallback(() => {
    if (ambienceRef.current) {
      ambienceRef.current.pause();
      ambienceRef.current = null;
    }
  }, []);

  useEffect(() => () => stopAmbience(), [stopAmbience]);

  return { play, startAmbience, stopAmbience };
}
