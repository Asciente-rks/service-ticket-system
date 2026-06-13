/**
 * AI provider layer: Groq + Google Gemini via their OpenAI-compatible
 * chat-completions endpoints (plain fetch — no extra dependencies).
 *
 * Both providers are free-tier with per-minute / per-day request limits.
 * Strategy: walk a chain of (provider, model) candidates ordered fastest →
 * strongest. On a rate-limit (429) or quota error the candidate is put in a
 * cooldown bucket and the next candidate — including the other provider —
 * is tried automatically. Cooldowns live in module state, which persists on
 * warm Lambda containers and resets harmlessly on cold starts.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, any>;
  };
}

export interface ChatCompletionResult {
  content: string | null;
  toolCalls: ToolCall[];
  provider: string;
  model: string;
}

interface ProviderCandidate {
  provider: 'groq' | 'gemini';
  model: string;
}

/**
 * Candidate chain ordered MOST POWERFUL first (per the account's actual free
 * tier limits), falling through to smaller/faster models as per-minute or
 * per-day limits are hit. Groq leads (fastest inference + biggest daily
 * quotas), Gemini follows as the cross-provider fallback. All listed models
 * support tool/function calling.
 *
 * Groq free-tier (RPM/RPD): gpt-oss-120b 30/1K · llama-3.3-70b 30/1K ·
 * qwen3-32b 60/1K · llama-4-scout 30/1K · gpt-oss-20b 30/1K ·
 * llama-3.1-8b 30/14.4K (deep fallback).
 * Gemini free-tier: 3.1-flash-lite 15 RPM/500 RPD (workhorse), the other
 * Flash models ~5 RPM/20 RPD (last resorts).
 */
const CANDIDATES: ProviderCandidate[] = [
  { provider: 'groq', model: 'openai/gpt-oss-120b' },
  { provider: 'groq', model: 'llama-3.3-70b-versatile' },
  { provider: 'groq', model: 'qwen/qwen3-32b' },
  { provider: 'groq', model: 'meta-llama/llama-4-scout-17b-16e-instruct' },
  { provider: 'groq', model: 'openai/gpt-oss-20b' },
  { provider: 'groq', model: 'llama-3.1-8b-instant' },
  { provider: 'gemini', model: 'gemini-3.1-flash-lite' },
  { provider: 'gemini', model: 'gemini-3.5-flash' },
  { provider: 'gemini', model: 'gemini-3-flash' },
  { provider: 'gemini', model: 'gemini-2.5-flash' },
  { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
];

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GEMINI_URL =
  'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';

/** model key -> epoch ms until which the candidate is cooling down. */
const cooldowns: Map<string, number> = new Map();

const DEFAULT_COOLDOWN_MS = 65_000; // a bit over a minute for RPM limits
const DAILY_COOLDOWN_MS = 60 * 60_000; // an hour when a daily cap is hit

const keyOf = (c: ProviderCandidate) => `${c.provider}:${c.model}`;

const isCoolingDown = (c: ProviderCandidate): boolean => {
  const until = cooldowns.get(keyOf(c)) || 0;
  return Date.now() < until;
};

const startCooldown = (c: ProviderCandidate, ms: number) => {
  cooldowns.set(keyOf(c), Date.now() + ms);
  console.warn(`[ai] ${keyOf(c)} rate-limited — cooling down for ${Math.round(ms / 1000)}s`);
};

const apiKeyFor = (provider: 'groq' | 'gemini'): string | undefined =>
  provider === 'groq' ? process.env.GROQ_API_KEY : process.env.GEMINI_API_KEY;

export const aiConfigured = (): boolean =>
  !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY);

/** Detect rate-limit / quota exhaustion responses from either provider. */
const isRateLimitError = (status: number, bodyText: string): boolean => {
  if (status === 429) return true;
  const lower = (bodyText || '').toLowerCase();
  return (
    lower.includes('rate limit') ||
    lower.includes('rate_limit') ||
    lower.includes('resource_exhausted') ||
    lower.includes('quota')
  );
};

/** Daily quota errors warrant a much longer cooldown than per-minute ones. */
const isDailyQuotaError = (bodyText: string): boolean => {
  const lower = (bodyText || '').toLowerCase();
  return (
    lower.includes('per day') ||
    lower.includes('daily') ||
    lower.includes('rpd') ||
    lower.includes('tokens per day') ||
    lower.includes('requests per day')
  );
};

/** Parse Retry-After (seconds) when the provider supplies it. */
const retryAfterMs = (headers: Headers): number | null => {
  const raw = headers.get('retry-after');
  if (!raw) return null;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000 + 2_000, 6 * 60 * 60_000);
};

const callProvider = async (
  candidate: ProviderCandidate,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxTokens = 1024,
  jsonMode = false,
  temperature = 0.3,
): Promise<ChatCompletionResult> => {
  const apiKey = apiKeyFor(candidate.provider);
  if (!apiKey) {
    const err: any = new Error(`${candidate.provider} API key not configured`);
    err.code = 'NO_KEY';
    throw err;
  }

  const url = candidate.provider === 'groq' ? GROQ_URL : GEMINI_URL;

  const payload: Record<string, any> = {
    model: candidate.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (tools && tools.length > 0) {
    payload.tools = tools;
    payload.tool_choice = 'auto';
  }
  if (jsonMode) {
    // Supported by Groq + Gemini OpenAI-compat models; candidates that reject
    // it fail over to the next one in the chain.
    payload.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  const bodyText = await response.text();

  if (!response.ok) {
    const err: any = new Error(
      `${candidate.provider} ${candidate.model} returned ${response.status}`,
    );
    err.status = response.status;
    err.bodyText = bodyText;
    err.headers = response.headers;
    throw err;
  }

  let data: any;
  try {
    data = JSON.parse(bodyText);
  } catch {
    const err: any = new Error(`${candidate.provider} returned non-JSON response`);
    err.status = 502;
    throw err;
  }

  const choice = data?.choices?.[0];
  const message = choice?.message || {};

  return {
    content: typeof message.content === 'string' ? stripReasoning(message.content) : null,
    toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls : [],
    provider: candidate.provider,
    model: candidate.model,
  };
};

/**
 * Reasoning models (e.g. qwen3) may emit chain-of-thought inside <think>
 * tags. Users should only ever see the final answer.
 */
const stripReasoning = (text: string): string =>
  text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

/**
 * Run a chat completion against the candidate chain with automatic
 * rate-limit fallback (Groq models first, then Gemini, switching providers
 * whenever a per-minute or per-day limit is hit).
 */
export const chatCompletion = async (
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxTokens?: number,
  jsonMode = false,
  temperature = 0.3,
): Promise<ChatCompletionResult> => {
  const available = CANDIDATES.filter((c) => !!apiKeyFor(c.provider));

  if (available.length === 0) {
    const err: any = new Error(
      'AI is not configured. Set GROQ_API_KEY and/or GEMINI_API_KEY on the server.',
    );
    err.statusCode = 503;
    throw err;
  }

  // Cooled-down candidates go to the back of the line rather than being
  // skipped entirely — if every candidate is limited we still try the least
  // recently limited one instead of failing outright.
  const ready = available.filter((c) => !isCoolingDown(c));
  const cooling = available
    .filter((c) => isCoolingDown(c))
    .sort((a, b) => (cooldowns.get(keyOf(a)) || 0) - (cooldowns.get(keyOf(b)) || 0));
  const order = [...ready, ...cooling];

  let lastError: any = null;

  for (const candidate of order) {
    try {
      const result = await callProvider(candidate, messages, tools, maxTokens, jsonMode, temperature);
      cooldowns.delete(keyOf(candidate));
      return result;
    } catch (error: any) {
      lastError = error;

      if (error?.code === 'NO_KEY') continue;

      const status = Number(error?.status) || 0;
      const bodyText: string = error?.bodyText || '';

      if (isRateLimitError(status, bodyText)) {
        const fromHeader = error?.headers ? retryAfterMs(error.headers) : null;
        const ms =
          fromHeader ?? (isDailyQuotaError(bodyText) ? DAILY_COOLDOWN_MS : DEFAULT_COOLDOWN_MS);
        startCooldown(candidate, ms);
        continue; // next candidate (possibly the other provider)
      }

      // Model decommissioned / not found — park it for a long time.
      if (status === 404 || bodyText.toLowerCase().includes('decommissioned')) {
        startCooldown(candidate, 24 * 60 * 60_000);
        continue;
      }

      // Transient upstream failure — try the next candidate.
      if (status >= 500 || error?.name === 'AbortError') {
        console.warn(`[ai] ${keyOf(candidate)} transient failure (${status || 'timeout'}) — trying next`);
        continue;
      }

      // 400/401/403 etc. on one provider — log and move on to the next.
      console.error(`[ai] ${keyOf(candidate)} error ${status}: ${bodyText.slice(0, 300)}`);
      continue;
    }
  }

  const err: any = new Error(
    'All AI providers are currently rate-limited or unavailable. Please try again in a minute.',
  );
  err.statusCode = 429;
  err.cause = lastError;
  throw err;
};
