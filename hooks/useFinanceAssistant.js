"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const THREADS_STORAGE_KEY = 'finance_assistant_threads_v1';
const ACTIVE_THREAD_STORAGE_KEY = 'finance_assistant_active_thread_v1';
const MAX_HISTORY = 30;

function createThread(title = 'New chat') {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function titleFromMessage(content) {
  if (!content) return 'New chat';
  const singleLine = content.replace(/\s+/g, ' ').trim();
  if (!singleLine) return 'New chat';
  return singleLine.length > 42 ? `${singleLine.slice(0, 42)}...` : singleLine;
}

function normalizeThreads(rawThreads) {
  if (!Array.isArray(rawThreads)) return [];

  return rawThreads
    .filter((thread) => thread && thread.id)
    .map((thread) => ({
      id: thread.id,
      title: thread.title || 'New chat',
      createdAt: thread.createdAt || new Date().toISOString(),
      updatedAt: thread.updatedAt || new Date().toISOString(),
      messages: Array.isArray(thread.messages)
        ? thread.messages.filter((message) => message && message.id && message.role && message.content)
        : [],
    }));
}

function readStoredState() {
  if (typeof window === 'undefined') return [];

  try {
    const rawThreads = localStorage.getItem(THREADS_STORAGE_KEY);
    const threads = normalizeThreads(rawThreads ? JSON.parse(rawThreads) : []);
    const activeThreadId = localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
    return [threads, activeThreadId];
  } catch {
    return [[], null];
  }
}

function persistState(threads, activeThreadId) {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(THREADS_STORAGE_KEY, JSON.stringify(threads));
    if (activeThreadId) {
      localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, activeThreadId);
    }
  } catch {
    // Ignore localStorage write issues.
  }
}

export function useFinanceAssistant() {
  const [threads, setThreads] = useState([]);
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortControllerRef = useRef(null);
  const threadsRef = useRef([]);
  const activeThreadIdRef = useRef(null);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    activeThreadIdRef.current = activeThreadId;
  }, [activeThreadId]);

  useEffect(() => {
    const [savedThreads, savedActiveThreadId] = readStoredState();

    if (savedThreads.length === 0) {
      const initialThread = createThread();
      setThreads([initialThread]);
      setActiveThreadId(initialThread.id);
      setIsInitialized(true);
      return;
    }

    setThreads(savedThreads);
    const hasSavedActive = savedActiveThreadId && savedThreads.some((thread) => thread.id === savedActiveThreadId);
    setActiveThreadId(hasSavedActive ? savedActiveThreadId : savedThreads[0].id);
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (!isInitialized) return;
    persistState(threads, activeThreadId);
  }, [threads, activeThreadId, isInitialized]);

  const activeThread = useMemo(() => {
    return threads.find((thread) => thread.id === activeThreadId) || null;
  }, [threads, activeThreadId]);

  const messages = useMemo(() => activeThread?.messages || [], [activeThread]);

  const updateActiveThread = useCallback((updater) => {
    const currentActiveId = activeThreadIdRef.current;
    if (!currentActiveId) return;

    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id !== currentActiveId) return thread;
        return updater(thread);
      })
    );
  }, []);

  const createNewChat = useCallback(() => {
    const thread = createThread();
    setThreads((prev) => [thread, ...prev]);
    setActiveThreadId(thread.id);
    setError(null);
    return thread.id;
  }, []);

  const switchChat = useCallback((threadId) => {
    setActiveThreadId(threadId);
    setError(null);
  }, []);

  const deleteChat = useCallback((threadId) => {
    setThreads((prev) => {
      const next = prev.filter((thread) => thread.id !== threadId);
      if (next.length === 0) {
        const fallback = createThread();
        setActiveThreadId(fallback.id);
        return [fallback];
      }

      if (activeThreadIdRef.current === threadId) {
        setActiveThreadId(next[0].id);
      }

      return next;
    });
  }, []);

  const sendMessage = useCallback(async (content, financeToken) => {
    if (!content?.trim() || isLoading || !isInitialized) return null;

    let currentThread = threadsRef.current.find((thread) => thread.id === activeThreadIdRef.current);
    if (!currentThread) {
      const newThreadId = createNewChat();
      currentThread = {
        id: newThreadId,
        title: 'New chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
      };
    }

    const userMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date().toISOString(),
    };

    const currentMessages = currentThread.messages || [];
    const title = currentMessages.length === 0 ? titleFromMessage(content) : currentThread.title;

    updateActiveThread((thread) => {
      const nextMessages = [...thread.messages, userMessage].slice(-MAX_HISTORY);
      return {
        ...thread,
        title,
        updatedAt: new Date().toISOString(),
        messages: nextMessages,
      };
    });

    setIsLoading(true);
    setError(null);

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const historyPayload = currentMessages.slice(-10).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const response = await fetch('/api/finance/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${financeToken}`,
        },
        body: JSON.stringify({
          message: content.trim(),
          conversationHistory: historyPayload,
        }),
        signal: controller.signal,
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(payload.message || 'Failed to get assistant response');
      }

      const assistantMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: payload.data.message,
        timestamp: payload.data.timestamp,
        dataContext: payload.data.dataContext,
      };

      updateActiveThread((thread) => {
        const nextMessages = [...thread.messages, assistantMessage].slice(-MAX_HISTORY);
        return {
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: nextMessages,
        };
      });

      return assistantMessage;
    } catch (err) {
      if (err.name === 'AbortError') return null;

      const message = err.message || 'Something went wrong. Please try again.';
      setError(message);

      updateActiveThread((thread) => {
        const withError = [
          ...thread.messages,
          {
            id: crypto.randomUUID(),
            role: 'error',
            content: message,
            timestamp: new Date().toISOString(),
          },
        ].slice(-MAX_HISTORY);

        return {
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: withError,
        };
      });

      return null;
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [isLoading, isInitialized, updateActiveThread, createNewChat]);

  const clearConversation = useCallback(() => {
    updateActiveThread((thread) => ({
      ...thread,
      title: 'New chat',
      updatedAt: new Date().toISOString(),
      messages: [],
    }));
    setError(null);
  }, [updateActiveThread]);

  const retryLast = useCallback(async (financeToken) => {
    const lastUser = [...messages].reverse().find((message) => message.role === 'user');
    if (!lastUser) return;

    updateActiveThread((thread) => {
      if (thread.messages.length === 0) return thread;

      const last = thread.messages[thread.messages.length - 1];
      if (last.role === 'assistant' || last.role === 'error') {
        return {
          ...thread,
          updatedAt: new Date().toISOString(),
          messages: thread.messages.slice(0, -1),
        };
      }
      return thread;
    });

    await sendMessage(lastUser.content, financeToken);
  }, [messages, sendMessage, updateActiveThread]);

  return {
    threads,
    activeThreadId,
    isInitialized,
    messages,
    isLoading,
    error,
    sendMessage,
    createNewChat,
    switchChat,
    deleteChat,
    clearConversation,
    retryLast,
    hasMessages: messages.length > 0,
    activeThread,
  };
}
