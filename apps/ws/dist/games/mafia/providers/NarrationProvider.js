const DEFAULT_TIMEOUT_MS = 3000;

class TemplateNarrationProvider {
  async transform(text) {
    return text;
  }
}

class LlmNarrationProvider {
  constructor({ endpoint, apiKey, timeoutMs = DEFAULT_TIMEOUT_MS }) {
    this.endpoint = endpoint;
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
  }

  async transform(text, context = {}) {
    if (!this.endpoint || !text) return text;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {}),
        },
        signal: ctl.signal,
        body: JSON.stringify({
          mode: 'mafia_narration',
          text,
          context,
        }),
      });
      if (!res.ok) return text;
      const data = await res.json();
      return typeof data?.text === 'string' && data.text.trim() ? data.text.trim() : text;
    } catch {
      return text;
    } finally {
      clearTimeout(t);
    }
  }
}

export function createNarrationProvider(options = {}) {
  const mode = options.mode || 'template';
  if (mode === 'llm') {
    return new LlmNarrationProvider({
      endpoint: options.endpoint || process.env.MAFIA_LLM_ENDPOINT || '',
      apiKey: options.apiKey || process.env.MAFIA_LLM_API_KEY || '',
      timeoutMs: Number(options.timeoutMs || process.env.MAFIA_LLM_TIMEOUT_MS || DEFAULT_TIMEOUT_MS),
    });
  }
  return new TemplateNarrationProvider();
}

