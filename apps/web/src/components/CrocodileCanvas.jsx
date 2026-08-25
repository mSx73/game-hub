import React, { useRef, useEffect, useCallback, useState } from 'react';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;
const PRESET_COLORS = ['#000000', '#ff5252', '#00c853', '#2196f3', '#ffd700', '#9c27b0', '#ff9800', '#00bcd4'];

const TOOL_BRUSH = 'brush';
const TOOL_FILL = 'fill';
const TOOL_ERASER = 'eraser';

function IconFillBucket({ className }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden
    >
      {/* format_color_fill — читается везде, не зависит от цветного emoji */}
      <path
        fill="currentColor"
        d="M16.56 8.94L7.62 0L6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"
      />
    </svg>
  );
}

/** Парсит CSS-цвет в RGBA через временный canvas (как в браузере). */
function cssColorToRgba(cssColor) {
  const c = document.createElement('canvas');
  c.width = 1;
  c.height = 1;
  const x = c.getContext('2d');
  x.fillStyle = cssColor;
  x.fillRect(0, 0, 1, 1);
  const d = x.getImageData(0, 0, 1, 1).data;
  return { r: d[0], g: d[1], b: d[2], a: d[3] };
}

/**
 * Заливка области одного цвета (iterative stack). Tolerance — для сглаженных краёв линий.
 */
function applyFloodFill(ctx, width, height, startX, startY, fillCssColor, tolerance = 5) {
  const x0 = Math.floor(startX);
  const y0 = Math.floor(startY);
  if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return;

  const { r: fillR, g: fillG, b: fillB, a: fillA } = cssColorToRgba(fillCssColor);

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const startPos = (y0 * width + x0) * 4;
  const startR = data[startPos];
  const startG = data[startPos + 1];
  const startB = data[startPos + 2];
  const startA = data[startPos + 3];

  if (
    Math.abs(startR - fillR) <= tolerance &&
    Math.abs(startG - fillG) <= tolerance &&
    Math.abs(startB - fillB) <= tolerance &&
    Math.abs(startA - fillA) <= tolerance
  ) {
    return;
  }

  const matchStart = (pos) =>
    Math.abs(data[pos] - startR) <= tolerance &&
    Math.abs(data[pos + 1] - startG) <= tolerance &&
    Math.abs(data[pos + 2] - startB) <= tolerance &&
    Math.abs(data[pos + 3] - startA) <= tolerance;

  const stack = [[x0, y0]];
  const visited = new Uint8Array(width * height);

  while (stack.length > 0) {
    const [x, y] = stack.pop();
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    const vi = y * width + x;
    if (visited[vi]) continue;
    const pos = vi * 4;
    if (!matchStart(pos)) continue;
    visited[vi] = 1;
    data[pos] = fillR;
    data[pos + 1] = fillG;
    data[pos + 2] = fillB;
    data[pos + 3] = fillA;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }

  ctx.putImageData(imageData, 0, 0);
}

function isFillStroke(s) {
  return s && s.type === 'fill' && typeof s.x === 'number' && typeof s.y === 'number' && typeof s.color === 'string';
}

export function CrocodileCanvas({ isExplainer, onDraw, strokes = [], onClear, onUndo, className = '' }) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState(TOOL_BRUSH);
  const [drawingActive, setDrawingActive] = useState(false);
  const [psychedelia, setPsychedelia] = useState(false);
  const psychedeliaRef = useRef(null);

  useEffect(() => {
    if (!psychedelia || !isExplainer) return;
    psychedeliaRef.current = setInterval(() => {
      setColor(PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]);
    }, 10000);
    return () => {
      if (psychedeliaRef.current) clearInterval(psychedeliaRef.current);
    };
  }, [psychedelia, isExplainer]);

  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }, []);

  const drawStroke = useCallback((ctx, points, color = '#000', width = 3) => {
    if (!points || points.length < 2) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    strokes.forEach((s) => {
      if (isFillStroke(s)) {
        applyFloodFill(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, s.x, s.y, s.color);
      } else if (s.points && s.points.length >= 2) {
        drawStroke(ctx, s.points, s.color, s.width);
      }
    });
  }, [strokes, drawStroke]);

  const activeColor = tool === TOOL_ERASER ? '#ffffff' : color;
  const activeBrushSize = tool === TOOL_ERASER ? Math.max(brushSize * 3, 12) : brushSize;

  const handleStart = useCallback(
    (e) => {
      e.preventDefault();
      if (!isExplainer) return;
      const pt = getCanvasPoint(e);
      if (!pt) return;

      if (tool === TOOL_FILL) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        applyFloodFill(ctx, CANVAS_WIDTH, CANVAS_HEIGHT, pt.x, pt.y, color);
        onDraw?.({ type: 'fill', x: pt.x, y: pt.y, color });
        return;
      }

      isDrawingRef.current = true;
      setDrawingActive(true);
      lastPointRef.current = pt;
    },
    [isExplainer, getCanvasPoint, tool, color, onDraw]
  );

  const handleMove = useCallback(
    (e) => {
      e.preventDefault();
      if (!isExplainer || !isDrawingRef.current || (tool !== TOOL_BRUSH && tool !== TOOL_ERASER)) return;
      const pt = getCanvasPoint(e);
      if (!pt || !lastPointRef.current) return;
      const stroke = {
        points: [lastPointRef.current, pt],
        color: activeColor,
        width: activeBrushSize,
      };
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        drawStroke(ctx, stroke.points, stroke.color, stroke.width);
      }
      onDraw?.(stroke);
      lastPointRef.current = pt;
    },
    [isExplainer, getCanvasPoint, onDraw, drawStroke, activeColor, activeBrushSize, tool]
  );

  const handleEnd = useCallback(() => {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    setDrawingActive(false);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('touchstart', handleStart, { passive: false });
    canvas.addEventListener('touchmove', handleMove, { passive: false });
    canvas.addEventListener('touchend', handleEnd);
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('mouseup', handleEnd);
    canvas.addEventListener('mouseleave', handleEnd);
    return () => {
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('mouseup', handleEnd);
      canvas.removeEventListener('mouseleave', handleEnd);
    };
  }, [handleStart, handleMove, handleEnd]);

  return (
    <div className={`crocodile-canvas-wrapper ${drawingActive ? 'drawing-active' : ''} ${className}`} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: '100%',
          maxWidth: '100%',
          height: 'auto',
          maxHeight: CANVAS_HEIGHT,
          display: 'block',
          background: '#fff',
          borderRadius: 'var(--radius, 8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-subtle, #e5e7eb)',
          cursor: isExplainer ? (tool === TOOL_FILL ? 'pointer' : tool === TOOL_ERASER ? 'cell' : 'crosshair') : 'default',
        }}
      />
      {isExplainer && (
        <div className="crocodile-toolbar">
          <div className="croc-tool-row" role="group" aria-label="Инструмент">
            <button
              type="button"
              className={`tool-btn croc-tool-btn ${tool === TOOL_BRUSH ? 'croc-tool-btn--active' : ''}`}
              onClick={() => setTool(TOOL_BRUSH)}
              title="Кисть"
            >
              <span className="croc-tool-btn__emoji" aria-hidden>
                ✏️
              </span>
              <span>Кисть</span>
            </button>
            <button
              type="button"
              className={`tool-btn croc-tool-btn ${tool === TOOL_FILL ? 'croc-tool-btn--active' : ''}`}
              onClick={() => setTool(TOOL_FILL)}
              title="Заливка"
            >
              <IconFillBucket className="croc-tool-btn__icon" />
              <span>Заливка</span>
            </button>
            <button
              type="button"
              className={`tool-btn croc-tool-btn ${tool === TOOL_ERASER ? 'croc-tool-btn--active' : ''}`}
              onClick={() => setTool(TOOL_ERASER)}
              title="Ластик"
            >
              <span className="croc-tool-btn__emoji" aria-hidden>🧹</span>
              <span>Ластик</span>
            </button>
          </div>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="color-picker"
            title={tool === TOOL_FILL ? 'Цвет заливки' : 'Цвет кисти'}
            disabled={tool === TOOL_ERASER}
          />
          <input
            type="range"
            min={1}
            max={12}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="brush-size-slider"
            title="Размер кисти"
            disabled={tool === TOOL_FILL}
          />
          <button
            type="button"
            className="tool-btn clear-btn"
            onClick={() => {
              onClear?.();
            }}
            title="Очистить холст"
          >
            Очистить
          </button>
          {onUndo && (
            <button
              type="button"
              className="tool-btn undo-btn"
              onClick={() => onUndo()}
              title="Отменить последний штрих"
            >
              ↩ Отменить
            </button>
          )}
          <button
            type="button"
            className={`tool-btn psychedelia-btn ${psychedelia ? 'active' : ''}`}
            onClick={() => setPsychedelia((p) => !p)}
            title="Режим Психоделия — цвет меняется каждые 10 сек"
          >
            🌈 Психоделия
          </button>
        </div>
      )}
    </div>
  );
}
