"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useFinanceAssistant } from "@/hooks/useFinanceAssistant";
import {
  Send,
  Plus,
  MessageSquare,
  Trash2,
  AlertCircle,
} from "lucide-react";

const SUGGESTED_PROMPTS = [
  "Give me a weekly finance operations summary",
  "What are the top expense categories in this selected period?",
  "Highlight unusual spending movements and likely causes",
  "What actions should we take to improve net balance next week?",
];

const WELCOME_MESSAGE = {
  title: "FinanceTrace Assistant",
  subtitle: "Ask for structured financial analysis based on your live dashboard data.",
};

function formatTime(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function formatDate(timestamp) {
  if (!timestamp) return "";
  try {
    return new Date(timestamp).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

function formatAssistantText(content) {
  return String(content || "")
    .replace(/\*\*/g, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .trim();
}

function AssistantPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [input, setInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [activeQuickPrompt, setActiveQuickPrompt] = useState("");
  const {
    threads,
    activeThreadId,
    isInitialized,
    messages,
    isLoading,
    error,
    sendMessage,
    hasMessages,
    createNewChat,
    switchChat,
    deleteChat,
    clearConversation,
  } = useFinanceAssistant();

  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  const sortedThreads = useMemo(() => {
    return [...threads].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }, [threads]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading, activeThreadId]);

  useEffect(() => {
    if (status === "loading") return;

    const sessionRole = session?.user?.role;
    const storedUserRaw = typeof window !== "undefined" ? localStorage.getItem("financeUser") : null;
    let storedRole = null;

    if (storedUserRaw) {
      try {
        storedRole = JSON.parse(storedUserRaw)?.role;
      } catch {
        storedRole = null;
      }
    }

    const effectiveRole = sessionRole || storedRole || "viewer";
    if (effectiveRole === "viewer") {
      router.replace("/dashboard");
    }
  }, [router, session?.user?.role, status]);

  const getFinanceToken = () => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem("financeToken") || localStorage.getItem("finance_token") || "";
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const financeToken = getFinanceToken();
    if (!financeToken) {
      setAuthError("Finance token missing. Please log in again.");
      return;
    }

    setActiveQuickPrompt("");
    setAuthError("");
    const prompt = input;
    setInput("");
    await sendMessage(prompt, financeToken);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = (prompt) => {
    if (isLoading) return;
    setActiveQuickPrompt(prompt);
    setInput(prompt);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <div className="mx-auto w-full max-w-[1500px] px-4 pt-6">
        <div className="grid grid-cols-1 gap-4 lg:[grid-template-columns:340px_minmax(0,1fr)]">
          <Card className="h-[calc(100vh-150px)] overflow-hidden border-border/60 bg-card/80">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h1 className="text-base font-semibold text-foreground">Chats</h1>
                  <Button size="sm" onClick={createNewChat} className="h-8">
                    <Plus className="mr-1 h-4 w-4" />
                    New
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Stored locally. Continue from where you left off.</p>
              </div>

              <ScrollArea className="min-h-0 flex-1 p-2">
                {!isInitialized && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">Loading chats...</div>
                )}

                {isInitialized && sortedThreads.length === 0 && (
                  <div className="px-2 py-3 text-sm text-muted-foreground">No chats yet.</div>
                )}

                <div className="space-y-1">
                  {sortedThreads.map((thread) => {
                    const isActive = thread.id === activeThreadId;
                    const lastMessage = thread.messages[thread.messages.length - 1];
                    const lastMessagePreview = lastMessage
                      ? String(lastMessage.content)
                          .replace(/\*\*/g, '')
                          .replace(/\s+/g, ' ')
                          .trim()
                      : 'No messages yet';

                    return (
                      <div
                        key={thread.id}
                        className={`w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors ${
                          isActive
                            ? "border-primary/30 bg-primary/10"
                            : "border-transparent hover:border-border/60 hover:bg-muted/60"
                        }`}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => switchChat(thread.id)}
                              className="w-full text-left"
                            >
                              <p className="truncate text-sm font-medium text-foreground">{thread.title}</p>
                              <p className="text-xs text-muted-foreground">{formatDate(thread.updatedAt)} {formatTime(thread.updatedAt)}</p>
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              deleteChat(thread.id);
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            aria-label="Delete chat"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        <p
                          className="text-xs leading-5 text-muted-foreground"
                          style={{
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                            wordBreak: "break-word",
                          }}
                        >
                          {lastMessagePreview}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </Card>

          <Card className="h-[calc(100vh-150px)] overflow-hidden border-border/60 bg-card/80">
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-border/60 px-5 py-4">
                <div className="mb-1 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <h2 className="text-base font-semibold text-foreground">{WELCOME_MESSAGE.title}</h2>
                  </div>
                  <Button variant="outline" size="sm" onClick={clearConversation} disabled={!hasMessages}>
                    Clear Current Chat
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">{WELCOME_MESSAGE.subtitle}</p>
              </div>

              <ScrollArea className="min-h-0 flex-1 px-5 py-4">
                {!hasMessages && (
                  <div className="mx-auto max-w-3xl space-y-4">
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-4">
                      <p className="text-sm text-foreground">
                        Ask for summaries, anomalies, category insights, or next-step actions.
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Responses are generated from your live dashboard data, not generic templates.
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {SUGGESTED_PROMPTS.map((prompt) => (
                        <Button
                          key={prompt}
                          type="button"
                          size="sm"
                          variant={activeQuickPrompt === prompt ? "default" : "outline"}
                          onClick={() => handlePromptClick(prompt)}
                          className="h-8"
                        >
                          {prompt}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {hasMessages && (
                  <div className="space-y-5 pr-1">
                    {messages.map((message) => {
                      const isUser = message.role === "user";
                      const isError = message.role === "error";

                      return (
                        <div key={message.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[86%] break-words rounded-xl border px-4 py-3 ${
                              isUser
                                ? "border-primary/30 bg-primary/10 text-foreground"
                                : isError
                                ? "border-red-500/30 bg-red-500/10 text-red-500"
                                : "border-border/60 bg-muted/30 text-foreground"
                            }`}
                          >
                            <p className="whitespace-pre-wrap text-sm leading-relaxed">
                              {isUser ? message.content : formatAssistantText(message.content)}
                            </p>
                            <p className="mt-2 text-right text-[11px] text-muted-foreground">{formatTime(message.timestamp)}</p>
                          </div>
                        </div>
                      );
                    })}

                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
                          Generating response...
                        </div>
                      </div>
                    )}
                  </div>
                )}
                <div ref={bottomRef} />
              </ScrollArea>

              {(authError || error) && (
                <div className="mx-5 mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    <span>{authError || error}</span>
                  </div>
                </div>
              )}

              <div className="border-t border-border/60 p-4">
                <div className="relative">
                  <Textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={handleKeyDown}
                    rows={2}
                    placeholder="Ask for structured analysis..."
                    className="min-h-[64px] max-h-48 resize-none pr-14"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isLoading}
                    className="absolute bottom-2 right-2 h-10 w-10 p-0"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">Press Enter to send, Shift+Enter for newline.</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default dynamic(() => Promise.resolve(AssistantPage), {
  ssr: false,
});
