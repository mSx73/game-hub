import React, { useEffect, useRef, useState } from 'react';
import { useGlobalEffects } from '../context/GlobalEffectsContext';

export function GlobalEffects() {
  const { rainbowMode, screenShake, achievements, weather, particleCursor } = useGlobalEffects();
  const canvasRef = useRef(null);
  const particlesRef = useRef([]);

  // Apply rainbow + shake to body
  useEffect(() => {
    document.documentElement.classList.toggle('rainbow-mode', rainbowMode);
  }, [rainbowMode]);

  useEffect(() => {
    document.documentElement.classList.toggle('screen-shake', screenShake);
  }, [screenShake]);

  // Particle cursor
  useEffect(() => {
    if (!particleCursor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let raf = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const spawn = (x, y) => {
      for (let i = 0; i < 3; i++) {
        particlesRef.current.push({
          x, y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 1,
          hue: Math.random() * 360,
        });
      }
    };

    const onMove = (e) => spawn(e.clientX, e.clientY);
    window.addEventListener('mousemove', onMove, { passive: true });

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        if (p.life <= 0) return false;
        ctx.globalAlpha = p.life;
        ctx.fillStyle = `hsl(${p.hue}, 80%, 60%)`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
        return true;
      });
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, [particleCursor]);

  return (
    <>
      {/* Weather */}
      {weather === 'rain' && (
        <div className="weather-effect rain" aria-hidden>
          {Array.from({ length: 50 }).map((_, i) => (
            <div key={i} className="rain-drop" style={{ '--i': i }} />
          ))}
        </div>
      )}
      {weather === 'snow' && (
        <div className="weather-effect snow" aria-hidden>
          {Array.from({ length: 40 }).map((_, i) => (
            <div key={i} className="snowflake" style={{ '--i': i }} />
          ))}
        </div>
      )}

      {/* Achievement toasts */}
      <div className="achievement-toasts" aria-live="polite">
        {achievements.map((a) => (
          <div key={a.id} className="achievement-toast">
            <span className="achievement-icon">🏆</span>
            <div>
              <div className="achievement-title">{a.title}</div>
              <div className="achievement-desc">{a.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Particle cursor canvas */}
      {particleCursor && (
        <canvas
          ref={canvasRef}
          className="particle-cursor-canvas"
          style={{ pointerEvents: 'none' }}
          aria-hidden
        />
      )}
    </>
  );
}
