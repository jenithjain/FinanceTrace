import { GoogleGenerativeAI } from '@google/generative-ai';

if (!process.env.GEMINI_API_KEY && process.env.NODE_ENV === 'development') {
  console.warn('[Gemini] GEMINI_API_KEY is not set. Finance assistant will fail until configured.');
}

let client = null;

export function getGeminiClient() {
  if (!client) {
    client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }
  return client;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

export const GEMINI_MODEL_FALLBACKS = [
  GEMINI_MODEL,
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
].filter((model, index, array) => model && array.indexOf(model) === index);

export const FINANCE_GENERATION_CONFIG = {
  temperature: 0.3,
  topK: 40,
  topP: 0.95,
  maxOutputTokens: 1024,
};

const requestCounts = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 15;

export function checkRateLimit(userId) {
  const now = Date.now();
  const key = String(userId || 'anonymous');

  if (!requestCounts.has(key)) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  const record = requestCounts.get(key);

  if (now - record.windowStart > RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - 1 };
  }

  if (record.count >= RATE_LIMIT_MAX_REQUESTS) {
    const resetIn = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - record.windowStart)) / 1000);
    return { allowed: false, remaining: 0, resetIn };
  }

  record.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX_REQUESTS - record.count };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of requestCounts.entries()) {
    if (now - record.windowStart > RATE_LIMIT_WINDOW_MS * 2) {
      requestCounts.delete(key);
    }
  }
}, 5 * 60 * 1000);
