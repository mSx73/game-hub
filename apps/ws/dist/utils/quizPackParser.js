/** Убирает тяжёлый массив вопросов из настроек перед отправкой клиентам. */
export function sanitizeNonMafiaSettingsForClients(settings) {
  if (!settings || typeof settings !== 'object') return {};
  const s = { ...settings };
  if (Array.isArray(s.quizCustomQuestions)) {
    s.quizCustomQuestionCount = s.quizCustomQuestions.length;
    delete s.quizCustomQuestions;
  }
  if (Array.isArray(s.crosswordWords)) {
    s.crosswordCustomCount = s.crosswordWords.length;
    delete s.crosswordWords;
  }
  return s;
}

/**
 * Формат .txt: блоки через строку "---".
 * В каждом блоке 6 непустых строк (без # в начале):
 * 1 — вопрос, 2–5 — четыре варианта, 6 — "correct:0" … "correct:3" (номер верного).
 */
export function parseQuizTxt(raw) {
  const text = String(raw || '')
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n');
  const blocks = text.split(/\n---\s*\n/);
  const out = [];

  const pushBlock = (lines) => {
    if (lines.length < 6) return;
    const last = lines[lines.length - 1];
    const m = last.match(/^correct:\s*([0-3])\s*$/i);
    if (!m) return;
    const correct = parseInt(m[1], 10);
    const q = String(lines[0] || '').slice(0, 500);
    const options = lines.slice(1, 5).map((o) => String(o || '').slice(0, 200));
    if (!q || options.length !== 4 || options.some((o) => !o.trim())) return;
    out.push({ q: q.trim(), options: options.map((o) => o.trim()), correct });
  };

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;
    const lines = [];
    for (const line of block.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      lines.push(t);
    }
    pushBlock(lines);
  }

  if (out.length === 0) {
    const allLines = [];
    for (const line of text.split('\n')) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      allLines.push(t);
    }
    for (let i = 0; i + 5 < allLines.length; ) {
      const slice = allLines.slice(i, i + 6);
      const m = slice[5].match(/^correct:\s*([0-3])\s*$/i);
      if (!m) {
        i++;
        continue;
      }
      const correct = parseInt(m[1], 10);
      const q = String(slice[0] || '').slice(0, 500).trim();
      const options = slice.slice(1, 5).map((o) => String(o || '').slice(0, 200).trim());
      if (q && options.length === 4 && options.every(Boolean)) {
        out.push({ q, options, correct });
      }
      i += 6;
    }
  }

  return out;
}
