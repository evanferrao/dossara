"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, streamText, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";
import type { UIMessage } from "ai";
import { ChatMessage } from "./ChatMessage";
import { ModelSelector } from "./ModelSelector";
import type { ModelKey } from "@/lib/constants";
import { TOP_K_CHUNKS, HISTORY_LIMIT, DEFAULT_MODEL } from "@/lib/constants";
import { buildSystemPrompt } from "@/lib/prompt";
import { useDocuments } from "@/context/DocumentContext";
import { useChats } from "@/context/ChatContext";
import { embed } from "@/lib/embeddings";
import { searchChunks } from "@/lib/vectorSearch";
import {
  getDocuments,
  saveChatMessage,
  getChatMessages,
  clearChatMessages,
  type StoredDocument,
} from "@/lib/indexeddb";

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

const CITATION_RE = /<!-- CITATIONS:\s*(\[.*?\])(?:\s*-->)?/s;

interface ChatPanelProps {
  onOpenApiKeyModal?: () => void;
}

export function ChatPanel({ onOpenApiKeyModal }: ChatPanelProps) {
  const [modelKey, setModelKey] = useState<string>(DEFAULT_MODEL);
  const [showRateLimitPrompt, setShowRateLimitPrompt] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem("dossara_custom_model");
    if (saved) {
      setModelKey(saved);
    }
  }, []);

  // Save to local storage when changed
  useEffect(() => {
    if (modelKey) {
      localStorage.setItem("dossara_custom_model", modelKey);
    }
  }, [modelKey]);
  const [storedCitations, setStoredCitations] = useState<
    Map<string, Citation[]>
  >(new Map());
  const [inputValue, setInputValue] = useState("");
  const [isEmbedding, setIsEmbedding] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const { documents } = useDocuments();
  const { activeChatId } = useChats();

  // We need a ref to track the latest context for the transport body
  const contextRef = useRef<{
    context: string;
    docInventory: string;
    docCount: number;
    chunkCount: number;
    referencedDocCount: number;
  }>({
    context: "",
    docInventory: "",
    docCount: 0,
    chunkCount: 0,
    referencedDocCount: 0,
  });

  // Build transport — sends context along with messages
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: process.env.NEXT_PUBLIC_WORKER_URL || "/api/chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const customApiKey = typeof window !== "undefined" ? localStorage.getItem("dossara_groq_api_key") : null;
        if (customApiKey && init?.body) {
          try {
            const body = JSON.parse(init.body as string);
            // @ts-expect-error dangerouslyAllowBrowser is sometimes undocumented but required for client-side use
            const groq = createGroq({ apiKey: customApiKey, dangerouslyAllowBrowser: true });
            
            const systemPrompt = buildSystemPrompt({
              docCount: body.docCount ?? 0,
              docInventory: body.docInventory ?? "",
              referencedDocCount: body.referencedDocCount ?? 0,
              chunkCount: body.chunkCount ?? 0,
              context: body.context ?? ""
            });
            
            const llmMessages = await convertToModelMessages(body.messages ?? []);
            
            const result = streamText({
              model: groq(body.model || DEFAULT_MODEL),
              instructions: systemPrompt,
              messages: llmMessages,
            });
            
            return result.toUIMessageStreamResponse();
          } catch (error) {
            console.error("Direct API error:", error);
            throw error;
          }
        }
        
        // Default behavior
        return fetch(input, init);
      },
      body: {
        model: modelKey,
        get context() {
          return contextRef.current.context;
        },
        get docInventory() {
          return contextRef.current.docInventory;
        },
        get docCount() {
          return contextRef.current.docCount;
        },
        get chunkCount() {
          return contextRef.current.chunkCount;
        },
        get referencedDocCount() {
          return contextRef.current.referencedDocCount;
        },
      },
    });
  }, [modelKey]);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport,
    onError: (error) => {
      let errorText =
        "Something went wrong. Please try again later.";
      let isRateLimit = false;

      try {
        // AI SDK might wrap non-JSON responses in error.message
        if (error.message.toLowerCase().includes("rate limit") || error.message.includes("429")) {
          isRateLimit = true;
        }

        const jsonMatch = error.message.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.message) {
            errorText = parsed.message;
            if (errorText.toLowerCase().includes("rate limit")) {
              isRateLimit = true;
            }
          }
        } else if (error.message && !error.message.includes("JSON")) {
          // If it's a plain string like "Rate limit exceeded..."
          errorText = error.message.replace(/.*?:\s*/, ""); // Strip "Error: "
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

      if (isRateLimit) {
        setShowRateLimitPrompt(true);
      }
    },
    onFinish: async ({ message }) => {
      // Parse citations from the finished message
      const text = getMessageText(message);
      const citationMatch = text.match(CITATION_RE);

      let citations: Citation[] | null = null;
      let cleanContent = text;

      if (citationMatch) {
        try {
          citations = JSON.parse(citationMatch[1]);
          setStoredCitations((prev) => {
            const next = new Map(prev);
            next.set(message.id, citations!);
            return next;
          });
          cleanContent = text
            .replace(new RegExp("<!-- CITATIONS:\\s*\\[.*?\\](?:\\s*-->)?", "s"), "")
            .trim();
        } catch {
          // Ignore parse errors
        }
      }

      // Save assistant message to IndexedDB
      try {
        if (!activeChatId) return;
        await saveChatMessage({
          chat_id: activeChatId,
          role: "assistant",
          content: cleanContent,
          citations,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to save assistant message:", err);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Load chat history from IndexedDB on mount
  useEffect(() => {
    if (!activeChatId) return;
    getChatMessages(activeChatId)
      .then((msgs) => {
        if (msgs.length > 0) {
          const loaded: UIMessage[] = msgs.map((m) => ({
            id: `db-${m.id}`,
            role: m.role as "user" | "assistant",
            parts: [{ type: "text" as const, text: m.content }],
          }));
          setMessages(loaded);

          // Load citations
          const citMap = new Map<string, Citation[]>();
          msgs.forEach((m) => {
            if (m.role === "assistant" && m.citations) {
              citMap.set(`db-${m.id}`, m.citations);
            }
          });
          setStoredCitations(citMap);
        } else {
          setMessages([]);
          setStoredCitations(new Map());
        }
      })
      .catch(console.error);
  }, [setMessages, activeChatId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async () => {
    if (!inputValue.trim() || isLoading || isEmbedding) return;

    const userText = inputValue.trim();
    setInputValue("");
    setIsEmbedding(true);

    try {
      if (!activeChatId) return;
      // 1. Save user message to IndexedDB
      await saveChatMessage({
        chat_id: activeChatId,
        role: "user",
        content: userText,
        created_at: new Date().toISOString(),
      });

      // 2. Embed the query client-side
      const queryEmbedding = await embed(userText);

      // 3. Search for relevant chunks
      const allDocs = await getDocuments(activeChatId);
      const readyDocs = allDocs.filter(
        (d: StoredDocument) => d.status === "ready"
      );
      const readyDocIds = readyDocs.map((d: StoredDocument) => d.id);
      
      const results = await searchChunks(queryEmbedding, readyDocIds, TOP_K_CHUNKS);

      // 4. Get all documents for context

      // Build document inventory
      const docInventory = readyDocs
        .map(
          (d: StoredDocument, i: number) =>
            `${i + 1}. "${d.filename}" (${d.page_count ?? "?"} pages)`
        )
        .join("\n");

      // Build doc id → filename map
      const docMap = new Map(
        allDocs.map((d: StoredDocument) => [d.id, d.filename])
      );

      // Build context block
      const contextBlock = results
        .map((r, i) => {
          const filename = docMap.get(r.chunk.document_id) ?? "Unknown";
          return `[Passage ${i + 1}] Document: "${filename}" (ID: ${r.chunk.document_id}) | Page: ${r.chunk.page_number}\n${r.chunk.content}`;
        })
        .join("\n\n---\n\n");

      // Count unique documents referenced
      const referencedDocIds = new Set(
        results.map((r) => r.chunk.document_id)
      );

      // 5. Update context ref for transport
      contextRef.current = {
        context: contextBlock,
        docInventory,
        docCount: readyDocs.length,
        chunkCount: results.length,
        referencedDocCount: referencedDocIds.size,
      };

      // 6. Build chat history for LLM (limit to recent messages)
      // The messages state already has the full history;
      // we trim it for the API call via the transport body

      setIsEmbedding(false);

      // 7. Send to LLM via transport
      sendMessage({ text: userText });
    } catch (err) {
      console.error("Failed to process message:", err);
      setIsEmbedding(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          parts: [
            {
              type: "text" as const,
              text: "Failed to process your message. Please try again.",
            },
          ],
        },
      ]);
    }
  }, [inputValue, isLoading, isEmbedding, sendMessage, setMessages, activeChatId]);

  // Handle textarea key events
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = async () => {
    try {
      if (activeChatId) {
        await clearChatMessages(activeChatId);
      }
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
                Upload a PDF and ask questions about its content. Everything is
                processed locally — your data never leaves this device.
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

        {(isLoading || isEmbedding) && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-white">D</span>
            </div>
            <div className="bg-transparent text-white px-4 py-3 rounded-2xl">
              {isEmbedding ? (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                  Searching documents…
                </p>
              ) : (
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
              )}
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
            disabled={!inputValue.trim() || isLoading || isEmbedding}
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
      {/* Rate Limit Prompt Dialog */}
      {showRateLimitPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#111] border border-[#333] p-6 rounded-2xl w-[400px] max-w-[90vw] shadow-2xl">
            <h2 className="text-lg font-bold text-white mb-2">Usage Limit Reached</h2>
            <p className="text-xs text-gray-400 mb-6">
              You've exceeded the free demo limit. Would you like to enter your own Groq API key to continue using the app natively with unmetered usage?
            </p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRateLimitPrompt(false)} className="btn-ghost px-4 py-2 text-sm">
                Not now
              </button>
              <button 
                onClick={() => {
                  setShowRateLimitPrompt(false);
                  if (onOpenApiKeyModal) onOpenApiKeyModal();
                }} 
                className="btn-primary px-4 py-2 text-sm"
              >
                Yes, set API key
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
