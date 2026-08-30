import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';

const GlobalEffectsContext = createContext(null);

const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];

export function GlobalEffectsProvider({ children }) {
  const [rainbowMode, setRainbowMode] = useState(() => !!localStorage.getItem('playfun-rainbow'));
  const [screenShake, setScreenShake] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [weather, setWeather] = useState(null); // 'rain' | 'snow' | null
  const [particleCursor, setParticleCursor] = useState(() => !!localStorage.getItem('playfun-rainbow'));

  const triggerAchievementRef = useRef(() => {});
  const triggerAchievement = useCallback((title, desc) => {
    const id = Date.now();
    setAchievements((prev) => [...prev, { id, title, desc }]);
    setTimeout(() => setAchievements((p) => p.filter((a) => a.id !== id)), 4000);
    if (navigator.vibrate) navigator.vibrate(50);
  }, []);
  triggerAchievementRef.current = triggerAchievement;

  // Konami code
  useEffect(() => {
    let idx = 0;
    const onKeyDown = (e) => {
      if (e.code === KONAMI[idx]) {
        idx++;
        if (idx === KONAMI.length) {
          setRainbowMode((v) => {
            const next = !v;
            if (next) {
              localStorage.setItem('playfun-rainbow', '1');
              setParticleCursor(true);
            } else {
              localStorage.removeItem('playfun-rainbow');
              setParticleCursor(false);
            }
            return next;
          });
          setTimeout(() => triggerAchievementRef.current('Пасхалка', 'Konami Code разблокирован! 🌈'), 0);
          idx = 0;
        }
      } else idx = 0;
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Погодные эффекты отключены (снег мешал)
  useEffect(() => {
    setWeather(null);
  }, []);

  const triggerShake = useCallback((duration = 400) => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), duration);
  }, []);

  const value = {
    rainbowMode,
    setRainbowMode,
    screenShake,
    triggerShake,
    achievements,
    triggerAchievement,
    weather,
    particleCursor,
    setParticleCursor,
  };

  return (
    <GlobalEffectsContext.Provider value={value}>
      {children}
    </GlobalEffectsContext.Provider>
  );
}

export function useGlobalEffects() {
  const ctx = useContext(GlobalEffectsContext);
  return ctx || {
    triggerShake: () => {},
    triggerAchievement: () => {},
    rainbowMode: false,
    achievements: [],
  };
}
