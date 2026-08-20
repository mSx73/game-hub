import React, { useRef, useEffect, useCallback, useState } from 'react';

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 400;
const PRESET_COLORS = ['#000000', '#ff5252', '#00c853', '#2196f3', '#ffd700', '#9c27b0', '#ff9800', '#00bcd4', '#ffffff', '#795548'];

// Tool types
const TOOLS = {
  BRUSH: 'brush',
  ERASER: 'eraser',
  FILL: 'fill',
  RECTANGLE: 'rectangle',
  CIRCLE: 'circle',
  LINE: 'line',
  ARROW: 'arrow',
  TEXT: 'text',
};

export function CrocodileCanvas({ 
  isExplainer, 
  onDraw, 
  strokes = [], 
  onClear, 
  className = '',
  onFill,
  onShape,
}) {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const shapeStartRef = useRef(null);
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);
  const [drawingActive, setDrawingActive] = useState(false);
  const [psychedelia, setPsychedelia] = useState(false);
  const [currentTool, setCurrentTool] = useState(TOOLS.BRUSH);
  const [fillColor, setFillColor] = useState('#ffffff');
  const [showGrid, setShowGrid] = useState(false);
  const [mirrorMode, setMirrorMode] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
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

  const drawShape = useCallback((ctx, shape) => {
    ctx.strokeStyle = shape.color;
    ctx.fillStyle = shape.fillColor || 'transparent';
    ctx.lineWidth = shape.width || 3;
    ctx.beginPath();

    switch (shape.type) {
      case TOOLS.RECTANGLE:
        ctx.rect(shape.x, shape.y, shape.w, shape.h);
        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;
      case TOOLS.CIRCLE:
        ctx.arc(shape.x, shape.y, shape.r, 0, Math.PI * 2);
        if (shape.fillColor && shape.fillColor !== 'transparent') {
          ctx.fill();
        }
        ctx.stroke();
        break;
      case TOOLS.LINE:
        ctx.moveTo(shape.x1, shape.y1);
        ctx.lineTo(shape.x2, shape.y2);
        ctx.stroke();
        break;
      case TOOLS.ARROW:
        drawArrow(ctx, shape.x1, shape.y1, shape.x2, shape.y2);
        break;
      case TOOLS.TEXT:
        ctx.font = `${shape.fontSize || 20}px Arial`;
        ctx.fillStyle = shape.color;
        ctx.fillText(shape.text, shape.x, shape.y);
        break;
    }
  }, []);

  const drawArrow = (ctx, x1, y1, x2, y2) => {
    const headLength = 15;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLength * Math.cos(angle - Math.PI / 6), y2 - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLength * Math.cos(angle + Math.PI / 6), y2 - headLength * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };

  // Flood fill algorithm
  const floodFill = useCallback((startX, startY, fillColor) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const data = imageData.data;
    const width = CANVAS_WIDTH;
    const height = CANVAS_HEIGHT;

    const startPos = (Math.floor(startY) * width + Math.floor(startX)) * 4;
    const startR = data[startPos];
    const startG = data[startPos + 1];
    const startB = data[startPos + 2];
    const startA = data[startPos + 3];

    const tempCtx = document.createElement('canvas').getContext('2d');
    tempCtx.fillStyle = fillColor;
    tempCtx.fillRect(0, 0, 1, 1);
    const fillData = tempCtx.getImageData(0, 0, 1, 1).data;
    const fillR = fillData[0];
    const fillG = fillData[1];
    const fillB = fillData[2];
    const fillA = fillData[3];

    if (startR === fillR && startG === fillG && startB === fillB && startA === fillA) return;

    const stack = [[Math.floor(startX), Math.floor(startY)]];
    const visited = new Set();

    while (stack.length > 0) {
      const [x, y] = stack.pop();
      const pos = (y * width + x) * 4;

      if (x < 0 || x >= width || y < 0 || y >= height) continue;
      if (visited.has(`${x},${y}`)) continue;

      const r = data[pos];
      const g = data[pos + 1];
      const b = data[pos + 2];
      const a = data[pos + 3];

      if (Math.abs(r - startR) > 5 || Math.abs(g - startG) > 5 || Math.abs(b - startB) > 5 || Math.abs(a - startA) > 5) {
        continue;
      }

      visited.add(`${x},${y}`);
      data[pos] = fillR;
      data[pos + 1] = fillG;
      data[pos + 2] = fillB;
      data[pos + 3] = fillA;

      stack.push([x + 1, y]);
      stack.push([x - 1, y]);
      stack.push([x, y + 1]);
      stack.push([x, y - 1]);
    }

    ctx.putImageData(imageData, 0, 0);
    onFill?.({ x: startX, y: startY, color: fillColor });
  }, [onFill]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (showGrid) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1;
      for (let x = 0; x < CANVAS_WIDTH; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y < CANVAS_HEIGHT; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }
    }

    strokes.forEach((s) => {
      if (s.type === 'stroke') {
        drawStroke(ctx, s.points, s.color, s.width);
      } else if (s.type === 'shape') {
        drawShape(ctx, s);
      } else if (s.type === 'fill') {
        floodFill(s.x, s.y, s.color);
      }
    });
  }, [strokes, drawStroke, drawShape, showGrid, floodFill]);

  const handleStart = useCallback(
    (e) => {
      e.preventDefault();
      if (!isExplainer) return;
      const pt = getCanvasPoint(e);
      if (!pt) return;

      if (currentTool === TOOLS.FILL) {
        floodFill(pt.x, pt.y, fillColor);
        onDraw?.({ type: 'fill', x: pt.x, y: pt.y, color: fillColor });
        return;
      }

      if (currentTool === TOOLS.TEXT) {
        setIsTyping(true);
        return;
      }

      isDrawingRef.current = true;
      setDrawingActive(true);
      lastPointRef.current = pt;
      shapeStartRef.current = pt;
    },
    [isExplainer, getCanvasPoint, currentTool, fillColor, floodFill, onDraw]
  );

  const handleMove = useCallback(
    (e) => {
      e.preventDefault();
      if (!isExplainer || !isDrawingRef.current) return;
      const pt = getCanvasPoint(e);
      if (!pt || !lastPointRef.current) return;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');

      if (currentTool === TOOLS.BRUSH || currentTool === TOOLS.ERASER) {
        const stroke = {
          type: 'stroke',
          points: [lastPointRef.current, pt],
          color: currentTool === TOOLS.ERASER ? '#ffffff' : color,
          width: currentTool === TOOLS.ERASER ? brushSize * 2 : brushSize,
        };
        drawStroke(ctx, stroke.points, stroke.color, stroke.width);
        onDraw?.(stroke);
        lastPointRef.current = pt;

        if (mirrorMode) {
          const mirrorStroke = {
            ...stroke,
            points: stroke.points.map(p => ({ x: CANVAS_WIDTH - p.x, y: p.y })),
          };
          drawStroke(ctx, mirrorStroke.points, mirrorStroke.color, mirrorStroke.width);
          onDraw?.(mirrorStroke);
        }
      }
    },
    [isExplainer, getCanvasPoint, onDraw, drawStroke, color, brushSize, currentTool, mirrorMode]
  );

  const handleEnd = useCallback((e) => {
    if (!isDrawingRef.current) return;
    
    const pt = getCanvasPoint(e) || lastPointRef.current;
    
    if (shapeStartRef.current && pt && 
        (currentTool === TOOLS.RECTANGLE || currentTool === TOOLS.CIRCLE || 
         currentTool === TOOLS.LINE || currentTool === TOOLS.ARROW)) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const shape = {
        type: 'shape',
        tool: currentTool,
        color: color,
        fillColor: fillColor,
        width: brushSize,
      };

      if (currentTool === TOOLS.RECTANGLE) {
        shape.x = Math.min(shapeStartRef.current.x, pt.x);
        shape.y = Math.min(shapeStartRef.current.y, pt.y);
        shape.w = Math.abs(pt.x - shapeStartRef.current.x);
        shape.h = Math.abs(pt.y - shapeStartRef.current.y);
        shape.type = TOOLS.RECTANGLE;
      } else if (currentTool === TOOLS.CIRCLE) {
        const dx = pt.x - shapeStartRef.current.x;
        const dy = pt.y - shapeStartRef.current.y;
        shape.r = Math.sqrt(dx * dx + dy * dy);
        shape.x = shapeStartRef.current.x;
        shape.y = shapeStartRef.current.y;
        shape.type = TOOLS.CIRCLE;
      } else if (currentTool === TOOLS.LINE || currentTool === TOOLS.ARROW) {
        shape.x1 = shapeStartRef.current.x;
        shape.y1 = shapeStartRef.current.y;
        shape.x2 = pt.x;
        shape.y2 = pt.y;
        shape.type = currentTool;
      }

      drawShape(ctx, shape);
      onShape?.(shape);
    }

    isDrawingRef.current = false;
    lastPointRef.current = null;
    shapeStartRef.current = null;
    setDrawingActive(false);
  }, [getCanvasPoint, currentTool, color, fillColor, brushSize, drawShape, onShape]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const textShape = {
      type: TOOLS.TEXT,
      text: textInput,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      color: color,
      fontSize: brushSize * 3 + 10,
    };

    drawShape(ctx, textShape);
    onDraw?.(textShape);
    setTextInput('');
    setIsTyping(false);
  }, [textInput, color, brushSize, drawShape, onDraw]);

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

  const ToolButton = ({ tool, icon, title }) => (
    <button
      type="button"
      className={`tool-btn ${currentTool === tool ? 'active' : ''}`}
      onClick={() => setCurrentTool(tool)}
      title={title}
    >
      {icon}
    </button>
  );

  return (
    <div className={`crocodile-canvas-wrapper ${drawingActive ? 'drawing-active' : ''} ${className}`} style={{ position: 'relative' }}>
      <canvas
        ref={canvasRef}
        width={CANVAS_WIDTH}
        height={CANVAS_HEIGHT}
        style={{
          width: '100%',
          maxWidth: CANVAS_WIDTH,
          height: 'auto',
          maxHeight: CANVAS_HEIGHT,
          display: 'block',
          background: '#fff',
          borderRadius: 'var(--radius, 8px)',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: '1px solid var(--border-subtle, #e5e7eb)',
          cursor: isExplainer 
            ? currentTool === TOOLS.TEXT ? 'text' 
            : currentTool === TOOLS.FILL ? 'pointer'
            : 'crosshair' 
            : 'default',
        }}
      />
      {isExplainer && (
        <div className="crocodile-toolbar">
          <div className="tool-group">
            <ToolButton tool={TOOLS.BRUSH} icon="✏️" title="Кисть" />
            <ToolButton tool={TOOLS.ERASER} icon="🧼" title="Ластик" />
            <ToolButton tool={TOOLS.FILL} icon="🪣" title="Заливка" />
            <ToolButton tool={TOOLS.RECTANGLE} icon="⬜" title="Прямоугольник" />
            <ToolButton tool={TOOLS.CIRCLE} icon="⭕" title="Круг" />
            <ToolButton tool={TOOLS.LINE} icon="📏" title="Линия" />
            <ToolButton tool={TOOLS.ARROW} icon="➡️" title="Стрелка" />
            <ToolButton tool={TOOLS.TEXT} icon="T" title="Текст" />
          </div>

          <div className="color-section">
            <div className="color-presets">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`color-preset ${color === c ? 'active' : ''}`}
                  style={{ backgroundColor: c, width: 24, height: 24, borderRadius: 4, border: color === c ? '2px solid #333' : '1px solid #ccc' }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="color-picker"
              title="Цвет кисти"
            />
          </div>

          {(currentTool === TOOLS.RECTANGLE || currentTool === TOOLS.CIRCLE) && (
            <div className="fill-section">
              <span>Заливка:</span>
              <input
                type="color"
                value={fillColor}
                onChange={(e) => setFillColor(e.target.value)}
                className="color-picker"
                title="Цвет заливки"
              />
              <button 
                type="button" 
                className="tool-btn"
                onClick={() => setFillColor('transparent')}
                title="Без заливки"
              >
                ❌
              </button>
            </div>
          )}

          <input
            type="range"
            min={1}
            max={20}
            value={brushSize}
            onChange={(e) => setBrushSize(Number(e.target.value))}
            className="brush-size-slider"
            title={`Размер: ${brushSize}px`}
          />

          <div className="special-modes">
            <button
              type="button"
              className={`tool-btn ${showGrid ? 'active' : ''}`}
              onClick={() => setShowGrid(!showGrid)}
              title="Сетка"
            >
              #️⃣ Сетка
            </button>
            <button
              type="button"
              className={`tool-btn ${mirrorMode ? 'active' : ''}`}
              onClick={() => setMirrorMode(!mirrorMode)}
              title="Зеркало"
            >
              🪞 Зеркало
            </button>
            <button
              type="button"
              className={`tool-btn psychedelia-btn ${psychedelia ? 'active' : ''}`}
              onClick={() => setPsychedelia((p) => !p)}
              title="Режим Психоделия — цвет меняется каждые 10 сек"
            >
              🌈 Психоделия
            </button>
          </div>

          <div className="action-buttons">
            <button
              type="button"
              className="tool-btn clear-btn"
              onClick={() => onClear?.()}
              title="Очистить холст"
            >
              🗑️ Очистить
            </button>
          </div>

          <div className="current-tool">
            {{
              [TOOLS.BRUSH]: '✏️ Кисть',
              [TOOLS.ERASER]: '🧼 Ластик',
              [TOOLS.FILL]: '🪣 Заливка',
              [TOOLS.RECTANGLE]: '⬜ Прямоугольник',
              [TOOLS.CIRCLE]: '⭕ Круг',
              [TOOLS.LINE]: '📏 Линия',
              [TOOLS.ARROW]: '➡️ Стрелка',
              [TOOLS.TEXT]: 'T Текст',
            }[currentTool]}
          </div>
        </div>
      )}

      {isTyping && (
        <div className="text-input-modal" style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'white',
          padding: 20,
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          zIndex: 100,
        }}>
          <input
            type="text"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            placeholder="Введите текст..."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
            style={{ padding: 8, fontSize: 16, marginRight: 8 }}
          />
          <button onClick={handleTextSubmit}>OK</button>
          <button onClick={() => setIsTyping(false)} style={{ marginLeft: 8 }}>Отмена</button>
        </div>
      )}
    </div>
  );
}
