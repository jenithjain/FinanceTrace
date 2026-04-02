import { withAuth } from '@/lib/middleware/withAuth';
import { successResponse, errorResponse, HTTP_STATUS } from '@/lib/apiResponse';
import {
  checkRateLimit,
  FINANCE_GENERATION_CONFIG,
  GEMINI_MODEL,
  GEMINI_MODEL_FALLBACKS,
  getGeminiClient,
} from '@/lib/gemini.js';

function safeCurrency(value) {
  const numeric = Number(value || 0);
  if (Number.isNaN(numeric)) return 'N/A';
  return numeric.toLocaleString('en-IN');
}

function normalizeFinanceData(financeData) {
  const summary = financeData?.summary || null;

  const categoriesSource = financeData?.categories;
  const categories = Array.isArray(categoriesSource)
    ? categoriesSource
    : Array.isArray(categoriesSource?.categories)
      ? categoriesSource.categories
      : [];

  const trendsSource = financeData?.trends;
  const trends = Array.isArray(trendsSource)
    ? trendsSource
    : Array.isArray(trendsSource?.trends)
      ? trendsSource.trends
      : [];

  const recentSource = financeData?.recentTransactions;
  const recentTransactions = Array.isArray(recentSource)
    ? recentSource
    : Array.isArray(recentSource?.transactions)
      ? recentSource.transactions
      : [];

  return {
    summary,
    categories,
    trends,
    recentTransactions,
  };
}

function buildSystemPrompt(financeData) {
  const { summary, categories, trends, recentTransactions } = normalizeFinanceData(financeData);

  return `You are a professional financial analyst assistant for FinanceTrace.

IMPORTANT RULES:
- Only answer finance-related questions (transactions, budgets, spending, trends, cashflow, anomalies).
- Use only the data provided below. Do not invent numbers.
- If some data is missing, still answer using available data and list missing pieces briefly under Risks or Follow-ups.
- Format currency in INR (Rs) using Indian number formatting.
- Keep answers concise and actionable.
- If the user asks unrelated questions, politely refuse and redirect to finance analysis.
- Use professional business language.
- Do not use markdown symbols such as **, *, #, or code blocks.
- Always follow this structure:
  1. Executive Summary
  2. Key Metrics
  3. Insights
  4. Recommended Actions
  5. Risks or Follow-ups
- Never return only a refusal when at least one relevant data block is available.

CURRENT LIVE FINANCE DATA
=========================
${summary ? `SUMMARY:\n- Total Income: Rs ${safeCurrency(summary.totalIncome)}\n- Total Expenses: Rs ${safeCurrency(summary.totalExpenses)}\n- Net Balance: Rs ${safeCurrency(summary.netBalance)}\n- Total Transactions: ${summary.totalTransactions ?? 'N/A'}` : 'Summary data unavailable.'}

${categories.length > 0 ? `SPENDING BY CATEGORY:\n${categories.map((item) => `- ${item.category}: Rs ${safeCurrency(item.total)} (${item.count} transactions, ${item.type})`).join('\n')}` : 'Category data unavailable.'}

${trends.length > 0 ? `MONTHLY TRENDS:\n${trends.map((item) => `- ${item.monthName || item.monthKey}: Income Rs ${safeCurrency(item.income)}, Expenses Rs ${safeCurrency(item.expense)}, Net Rs ${safeCurrency(item.net)}`).join('\n')}` : 'Trends data unavailable.'}

${recentTransactions.length > 0 ? `RECENT TRANSACTIONS:\n${recentTransactions.slice(0, 10).map((item) => `- ${item.date ? new Date(item.date).toLocaleDateString('en-IN') : 'N/A'} | ${String(item.type || '').toUpperCase()} | ${item.category || 'Uncategorized'} | Rs ${safeCurrency(item.amount)}${item.notes ? ` | ${item.notes}` : ''}`).join('\n')}` : 'Recent transaction data unavailable.'}
=========================
Answer the user question using the above data only.`;
}

function sanitizeAssistantText(text) {
  return String(text || '')
    .replace(/\*\*/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/^\s*[*•]\s+/gm, '- ')
    .replace(/```/g, '')
    .trim();
}

async function fetchJsonWithAuth(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: 'no-store',
  });

  const payload = await response.json();
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || `Failed to fetch ${url}`);
  }

  return payload.data;
}

async function fetchFinanceContext(baseUrl, token, range = {}) {
  const search = new URLSearchParams();
  if (range.startDate) search.set('startDate', range.startDate);
  if (range.endDate) search.set('endDate', range.endDate);
  const query = search.toString() ? `?${search.toString()}` : '';

  const requests = [
    fetchJsonWithAuth(`${baseUrl}/api/finance/dashboard/summary${query}`, token),
    fetchJsonWithAuth(`${baseUrl}/api/finance/dashboard/by-category${query}`, token),
    fetchJsonWithAuth(`${baseUrl}/api/finance/dashboard/trends${query}`, token),
    fetchJsonWithAuth(`${baseUrl}/api/finance/dashboard/recent${query}`, token),
  ];

  const [summary, categories, trends, recentTransactions] = await Promise.all(requests);

  return {
    summary,
    categories,
    trends,
    recentTransactions,
  };
}

function isModelNotFoundError(error) {
  const message = String(error?.message || '');
  return message.includes('is not found') || message.includes('not supported for generateContent');
}

async function generateAssistantReply({ financeData, history, message }) {
  const client = getGeminiClient();
  let lastError = null;

  for (const modelName of GEMINI_MODEL_FALLBACKS) {
    try {
      const model = client.getGenerativeModel({
        model: modelName,
        generationConfig: FINANCE_GENERATION_CONFIG,
        systemInstruction: buildSystemPrompt(financeData),
      });

      const chat = model.startChat({ history });
      const result = await chat.sendMessage(message.trim());
      const response = result.response;
      const text = response?.text?.();

      if (text) {
        return { text, modelName };
      }

      throw new Error(`No response generated by model ${modelName}`);
    } catch (error) {
      lastError = error;
      if (!isModelNotFoundError(error)) {
        throw error;
      }
    }
  }

  throw lastError || new Error(`No supported Gemini model found. Tried: ${GEMINI_MODEL_FALLBACKS.join(', ')}`);
}

async function handlePostAssistant(request) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return errorResponse('Assistant is not configured. Missing GEMINI_API_KEY.', HTTP_STATUS.INTERNAL_ERROR);
    }

    const { message, conversationHistory = [], dateRange } = await request.json();

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return errorResponse('Message is required and must be a non-empty string.', HTTP_STATUS.BAD_REQUEST);
    }

    if (message.trim().length > 1000) {
      return errorResponse('Message is too long. Keep it under 1000 characters.', HTTP_STATUS.BAD_REQUEST);
    }

    const rateLimit = checkRateLimit(request.user.id);
    if (!rateLimit.allowed) {
      return errorResponse(
        `Rate limit exceeded. Try again in ${rateLimit.resetIn} seconds.`,
        429
      );
    }

    const tokenHeader = request.headers.get('authorization') || '';
    const token = tokenHeader.startsWith('Bearer ') ? tokenHeader.substring(7) : '';

    if (!token) {
      return errorResponse('Authentication token missing.', HTTP_STATUS.UNAUTHORIZED);
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

    const financeData = await fetchFinanceContext(baseUrl, token, {
      startDate: dateRange?.startDate,
      endDate: dateRange?.endDate,
    });

    const history = Array.isArray(conversationHistory)
      ? conversationHistory
          .filter((item) => item && item.role && item.content)
          .slice(-10)
          .map((item) => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: String(item.content) }],
          }))
      : [];

    const { text, modelName } = await generateAssistantReply({
      financeData,
      history,
      message,
    });

    const normalizedFinanceData = normalizeFinanceData(financeData);

    const sanitizedText = sanitizeAssistantText(text);

    if (!sanitizedText) {
      return errorResponse('No response generated. Please try again.', HTTP_STATUS.INTERNAL_ERROR);
    }

    return successResponse('Assistant response generated.', {
      message: sanitizedText,
      role: 'assistant',
      timestamp: new Date().toISOString(),
      remainingRequests: rateLimit.remaining,
      modelUsed: modelName,
      dataContext: {
        hasFinanceData: Boolean(normalizedFinanceData.summary),
        categoriesCount: normalizedFinanceData.categories.length,
        trendsMonths: normalizedFinanceData.trends.length,
      },
    });
  } catch (error) {
    console.error('Finance assistant error:', error);

    const message = String(error?.message || 'Unexpected error');

    if (message.includes('API_KEY_INVALID')) {
      return errorResponse('AI service configuration error.', HTTP_STATUS.INTERNAL_ERROR);
    }

    if (message.includes('No supported Gemini model found') || isModelNotFoundError(error)) {
      return errorResponse(
        `Assistant model is unavailable. Set GEMINI_MODEL in .env to one of the enabled models for your key. Current primary model: ${GEMINI_MODEL}.`,
        HTTP_STATUS.INTERNAL_ERROR
      );
    }

    if (message.includes('SAFETY')) {
      return errorResponse('Message blocked by safety filters. Please rephrase.', HTTP_STATUS.BAD_REQUEST);
    }

    if (message.includes('quota') || message.includes('RESOURCE_EXHAUSTED')) {
      return errorResponse('AI quota reached. Please try again later.', 429);
    }

    if (message.includes('Failed to fetch')) {
      return errorResponse('Could not load dashboard context. Please try again.', HTTP_STATUS.INTERNAL_ERROR);
    }

    return errorResponse('Failed to process your request. Please try again.', HTTP_STATUS.INTERNAL_ERROR);
  }
}

export const POST = withAuth(handlePostAssistant, ['analyst', 'admin']);
