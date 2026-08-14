"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { ModelSelector } from "./ModelSelector";
import type { ModelKey } from "@/lib/constants";
import { useDocuments } from "@/context/DocumentContext";
import { useWorkspaceId } from "@/hooks/useWorkspaceId";

interface Citation {
  documentId: string;
  filename: string;
  page: number;
}

/**
 * Extract text content from a UIMessage's parts array.
 */
function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

const CITATION_RE = /<!-- CITATIONS:\s*(\[.*?\])\s*-->/s;

export function ChatPanel() {
  const [modelKey, setModelKey] = useState<ModelKey>("fast");
  const [storedCitations, setStoredCitations] = useState<
    Map<string, Citation[]>
  >(new Map());
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const workspaceId = useWorkspaceId();
  const { fetchWithWorkspace } = useDocuments();

  // Build transport with the current model selection and workspace header
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { model: modelKey },
        headers: workspaceId ? { "x-workspace-id": workspaceId } : undefined,
      }),
    [modelKey, workspaceId]
  );

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport,
    onError: (error) => {
      // Surface API errors (like 429 rate limit) as visible chat messages
      // instead of only logging to the console
      let errorText =
        "Something went wrong. Please try again later.";

      // The AI SDK attaches the response body to the error message
      // Try to parse a JSON message from it
      try {
        const jsonMatch = error.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) errorText = parsed.message;
        }
      } catch {
        // Fall back to the default error text
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          parts: [{ type: "text" as const, text: errorText }],
        },
      ]);
    },
    onFinish: ({ message }) => {
      // Parse citations from the finished message
      const text = getMessageText(message);
      const citationMatch = text.match(CITATION_RE);
      if (citationMatch) {
        try {
          const citations: Citation[] = JSON.parse(citationMatch[1]);
          setStoredCitations((prev) => {
            const next = new Map(prev);
            next.set(message.id, citations);
            return next;
          });
        } catch {
          // Ignore parse errors
        }
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Load chat history on mount
  useEffect(() => {
    if (!workspaceId) return;
    fetchWithWorkspace("/api/chat-history")
      .then((res) => res.json())
      .then((data) => {
        if (data.messages && data.messages.length > 0) {
          const loaded: UIMessage[] = data.messages.map(
            (m: { id: string; role: string; content: string; citations?: Citation[] }) => ({
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
            })
          );
          setMessages(loaded);

          // Load citations
          const citMap = new Map<string, Citation[]>();
          data.messages.forEach(
            (m: { id: string; role: string; citations?: Citation[] }) => {
              if (m.role === "assistant" && m.citations) {
                citMap.set(m.id, m.citations);
              }
            }
          );
          setStoredCitations(citMap);
        }
      })
      .catch(console.error);
  }, [setMessages, workspaceId, fetchWithWorkspace]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(() => {
    if (inputValue.trim() && !isLoading) {
      sendMessage({ text: inputValue.trim() });
      setInputValue("");
    }
  }, [inputValue, isLoading, sendMessage]);

  // Handle textarea key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    try {
      await fetchWithWorkspace("/api/chat-history", { method: "DELETE" });
      setMessages([]);
      setStoredCitations(new Map());
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel-solid overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-4 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center border border-[#333]">
            <svg
              className="w-4 h-4 text-black"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z"
              />
            </svg>
          </div>
          <div>
            <h2
              className="text-sm font-semibold"
              style={{ color: "var(--text-primary)" }}
            >
              Chat
            </h2>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Ask about your documents
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ModelSelector value={modelKey} onChange={setModelKey} />
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="btn-ghost text-xs px-2 py-1.5"
              title="Clear chat"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div
            className="flex-1 flex items-center justify-center h-full"
            style={{ color: "var(--text-muted)" }}
          >
            <div className="text-center py-20 animate-fade-in">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#111] border border-[#333] flex items-center justify-center">
                <svg
                  className="w-10 h-10 opacity-40 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1">
                Start a conversation
              </p>
              <p className="text-xs max-w-xs mx-auto">
                Upload a PDF and ask questions about its content. I&apos;ll find
                relevant passages and cite my sources.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const text = getMessageText(msg);
          const citations = storedCitations.get(msg.id);

          return (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant"}
              content={text}
              citations={
                msg.role === "assistant" ? citations : undefined
              }
            />
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">D</span>
            </div>
            <div className="bg-transparent text-white px-4 py-3 rounded-2xl">
              <div className="flex gap-1.5">
                <span
                  className="w-2 h-2 rounded-full bg-white animate-pulse"
                  style={{
                    background: "var(--accent-primary)",
                    animationDelay: "0ms",
                  }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    background: "var(--accent-primary)",
                    animationDelay: "200ms",
                  }}
                />
                <span
                  className="w-2 h-2 rounded-full animate-pulse"
                  style={{
                    background: "var(--accent-primary)",
                    animationDelay: "400ms",
                  }}
                />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div
        className="p-4 border-t"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex gap-3 items-stretch">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your documents…"
            rows={1}
            className="input-base flex-1 resize-none min-h-[42px] max-h-[120px]"
            style={{
              height: "auto",
              overflow: inputValue.split("\n").length > 1 ? "auto" : "hidden",
            }}
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="btn-primary px-4 flex-shrink-0 flex items-center justify-center"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
