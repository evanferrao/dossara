"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, streamText, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";
import type { UIMessage } from "ai";
import { ChatMessage, type Citation } from "./ChatMessage";
import type { WebCitation } from "./WebCitationBadge";
import { ModelSelector } from "./ModelSelector";
import { WebSearchToggle } from "./WebSearchToggle";
import type { ModelKey } from "@/lib/constants";
import { TOP_K_LOCAL, TOP_K_WEB, DEFAULT_MODEL, MODELS } from "@/lib/constants";
import { buildSystemPrompt } from "@/lib/prompt";
import { useDocuments } from "@/context/DocumentContext";
import { useChats } from "@/context/ChatContext";
import { retrieveLocal, buildHybridContext } from "@/lib/rag";
import { getWebSearchProvider } from "@/lib/web-search/provider";
import type { WebSearchConfig } from "@/lib/web-search/types";
import {
  loadWebSearchConfig,
  saveWebSearchConfig,
} from "@/lib/settings/web-search-settings";
import {
  saveChatMessage,
  getChatMessages,
  clearChatMessages,
} from "@/lib/indexeddb";

/**
 * Extract text content from a UIMessage's parts array.
 */
function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

const CITATION_RE = /<!--\s*CITATIONS:\s*(\[.*?\])(?:\s*-->)?/s;
const WEB_CITATION_RE = /<!--\s*WEB_CITATIONS:\s*(\[.*?\])(?:\s*-->)?/s;

interface ChatPanelProps {
  onOpenApiKeyModal?: () => void;
}

export function ChatPanel({ onOpenApiKeyModal }: ChatPanelProps) {
  const [modelKey, setModelKey] = useState<string>(DEFAULT_MODEL);
  const [showRateLimitPrompt, setShowRateLimitPrompt] = useState(false);

  // Load model preference from local storage on mount
  useEffect(() => {
    const customApiKey = localStorage.getItem("dossara_groq_api_key");
    const savedCustom = localStorage.getItem("dossara_custom_model");
    const savedSelected = localStorage.getItem("dossara_selected_model");

    if (savedCustom) {
      if (MODELS.includes(savedCustom)) {
        setModelKey(savedCustom);
        localStorage.setItem("dossara_selected_model", savedCustom);
        localStorage.removeItem("dossara_custom_model");
      } else if (customApiKey) {
        setModelKey(savedCustom);
      } else {
        localStorage.removeItem("dossara_custom_model");
        setModelKey(DEFAULT_MODEL);
      }
    } else if (savedSelected && MODELS.includes(savedSelected)) {
      setModelKey(savedSelected);
    }
  }, []);

  // Save model preference to local storage when changed
  useEffect(() => {
    if (modelKey) {
      if (MODELS.includes(modelKey)) {
        localStorage.setItem("dossara_selected_model", modelKey);
        localStorage.removeItem("dossara_custom_model");
      } else {
        localStorage.setItem("dossara_custom_model", modelKey);
        localStorage.setItem("dossara_selected_model", modelKey);
      }
    }
  }, [modelKey]);

  // Ollama configuration
  const [isOllamaEnabled, setIsOllamaEnabled] = useState(false);
  const [ollamaModelName, setOllamaModelName] = useState("");

  useEffect(() => {
    setIsOllamaEnabled(localStorage.getItem("dossara_ollama_enabled") === "true");
    setOllamaModelName(localStorage.getItem("dossara_ollama_model") || "llama3");
  }, []);

  // Web Search Configuration
  const [webSearchConfig, setWebSearchConfig] = useState<WebSearchConfig>(() =>
    loadWebSearchConfig()
  );

  const handleWebSearchConfigChange = (newConfig: WebSearchConfig) => {
    setWebSearchConfig(newConfig);
    saveWebSearchConfig(newConfig);
  };

  // Citations storage
  const [storedCitations, setStoredCitations] = useState<Map<string, Citation[]>>(
    new Map()
  );
  const [storedWebCitations, setStoredWebCitations] = useState<
    Map<string, WebCitation[]>
  >(new Map());

  const { documents } = useDocuments();
  const { activeChatId, chatDrafts, setChatDraft } = useChats();
  const [inputValue, setInputValue] = useState(chatDrafts[activeChatId] || "");
  const [retrievalStatusText, setRetrievalStatusText] = useState("Searching documents…");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Keep refs for active values needed in transport.fetch without recreating transport
  const activeChatIdRef = useRef(activeChatId);
  activeChatIdRef.current = activeChatId;

  const webSearchConfigRef = useRef(webSearchConfig);
  webSearchConfigRef.current = webSearchConfig;

  // Build transport — handles retrieval and sends context along with messages
  const transport = useMemo(() => {
    return new DefaultChatTransport({
      api: process.env.NEXT_PUBLIC_WORKER_URL || "/api/chat",
      fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
        const currentChatId = activeChatIdRef.current;
        const currentSearchConfig = webSearchConfigRef.current;

        let hybridContext = {
          context: "",
          docInventory: "",
          docCount: 0,
          chunkCount: 0,
          referencedDocCount: 0,
          webSourceCount: 0,
        };

        if (init?.body) {
          try {
            const body = JSON.parse(init.body as string);
            const messagesArray = body.messages ?? [];
            const lastMsg = messagesArray[messagesArray.length - 1];

            // Extract the user query text
            let userQuery = "";
            if (lastMsg) {
              if (typeof lastMsg.content === "string") {
                userQuery = lastMsg.content;
              } else if (Array.isArray(lastMsg.parts)) {
                userQuery = lastMsg.parts
                  .filter((p: any) => p.type === "text")
                  .map((p: any) => p.text)
                  .join("");
              }
            }

            // Persist user message to IndexedDB asynchronously
            if (currentChatId && userQuery.trim()) {
              saveChatMessage({
                chat_id: currentChatId,
                role: "user",
                content: userQuery.trim(),
                created_at: new Date().toISOString(),
              }).catch(console.error);
            }

            // Perform retrieval
            if (userQuery.trim()) {
              const isWebSearchOn = currentSearchConfig.enabled;
              setRetrievalStatusText(
                isWebSearchOn ? "Searching documents & web…" : "Searching documents…"
              );

              let localData: { results: any[]; readyDocs: any[] } = {
                results: [],
                readyDocs: [],
              };
              let webResults: any[] = [];

              if (isWebSearchOn) {
                const webProvider = getWebSearchProvider(currentSearchConfig);
                const [localRes, webRes] = await Promise.all([
                  retrieveLocal(userQuery, currentChatId, TOP_K_LOCAL),
                  webProvider
                    .search(userQuery, {
                      maxResults: currentSearchConfig.maxResults || TOP_K_WEB,
                      timeRange: currentSearchConfig.timeRange,
                    })
                    .catch((err) => {
                      console.warn("Web search retrieval error:", err);
                      return [];
                    }),
                ]);
                localData = localRes;
                webResults = webRes;
              } else {
                localData = await retrieveLocal(userQuery, currentChatId, TOP_K_LOCAL);
              }

              hybridContext = buildHybridContext({
                localResults: localData.results,
                webResults,
                readyDocs: localData.readyDocs,
              });
            }
          } catch (err) {
            console.error("Context assembly error:", err);
          }
        }

        setRetrievalStatusText("Synthesizing answer…");

        // 1. Ollama Provider
        const ollamaEnabled =
          typeof window !== "undefined" &&
          localStorage.getItem("dossara_ollama_enabled") === "true";

        if (ollamaEnabled && init?.body) {
          try {
            const body = JSON.parse(init.body as string);
            const ollamaUrl =
              localStorage.getItem("dossara_ollama_url") || "http://localhost:11434";
            const ollamaModel =
              localStorage.getItem("dossara_ollama_model") || "llama3";

            const systemPrompt = buildSystemPrompt({
              docCount: hybridContext.docCount,
              docInventory: hybridContext.docInventory,
              referencedDocCount: hybridContext.referencedDocCount,
              chunkCount: hybridContext.chunkCount,
              webSourceCount: hybridContext.webSourceCount,
              context: hybridContext.context,
            });

            let llmMessages = await convertToModelMessages(body.messages ?? []);

            llmMessages = llmMessages.map((m: any) => {
              if (Array.isArray(m.content)) {
                const filtered = m.content.filter((part: any) =>
                  ["text", "image", "tool-call", "tool-result"].includes(part.type)
                );
                if (filtered.length === 0) {
                  return { ...m, content: "" };
                }
                if (filtered.every((p: any) => p.type === "text")) {
                  return { ...m, content: filtered.map((p: any) => p.text).join("") };
                }
                return { ...m, content: filtered };
              }
              return m;
            });

            const { createOpenAI } = await import("@ai-sdk/openai");

            const ollamaProvider = createOpenAI({
              baseURL: `${ollamaUrl.replace(/\/$/, "")}/v1`,
              apiKey: "ollama",
              // @ts-expect-error compatibility flag
              compatibility: "compatible",
            });

            const result = streamText({
              model: ollamaProvider.chat(ollamaModel),
              instructions: systemPrompt,
              messages: llmMessages,
            });

            return result.toUIMessageStreamResponse();
          } catch (error) {
            console.error("Ollama API error:", error);
            throw error;
          }
        }

        // 2. Direct Groq Provider
        const customApiKey =
          typeof window !== "undefined"
            ? localStorage.getItem("dossara_groq_api_key")
            : null;

        if (customApiKey && init?.body) {
          try {
            const body = JSON.parse(init.body as string);
            // @ts-expect-error dangerouslyAllowBrowser for client-side Groq
            const groq = createGroq({ apiKey: customApiKey, dangerouslyAllowBrowser: true });

            const systemPrompt = buildSystemPrompt({
              docCount: hybridContext.docCount,
              docInventory: hybridContext.docInventory,
              referencedDocCount: hybridContext.referencedDocCount,
              chunkCount: hybridContext.chunkCount,
              webSourceCount: hybridContext.webSourceCount,
              context: hybridContext.context,
            });

            let llmMessages = await convertToModelMessages(body.messages ?? []);

            llmMessages = llmMessages.map((m: any) => {
              if (Array.isArray(m.content)) {
                const filtered = m.content.filter((part: any) =>
                  ["text", "image", "tool-call", "tool-result"].includes(part.type)
                );
                if (filtered.length === 0) {
                  return { ...m, content: "" };
                }
                if (filtered.every((p: any) => p.type === "text")) {
                  return { ...m, content: filtered.map((p: any) => p.text).join("") };
                }
                return { ...m, content: filtered };
              }
              return m;
            });

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

        // 3. Default behavior (Cloudflare Worker proxy)
        // Inject assembled hybrid context directly into the request payload
        let newInit = init;
        if (init?.body) {
          try {
            const parsed = JSON.parse(init.body as string);
            parsed.context = hybridContext.context;
            parsed.docInventory = hybridContext.docInventory;
            parsed.docCount = hybridContext.docCount;
            parsed.chunkCount = hybridContext.chunkCount;
            parsed.referencedDocCount = hybridContext.referencedDocCount;
            parsed.webSourceCount = hybridContext.webSourceCount;

            newInit = {
              ...init,
              body: JSON.stringify(parsed),
            };
          } catch {
            // Keep original init
          }
        }

        return fetch(input, newInit);
      },
      body: {
        model: modelKey,
      },
    });
  }, [modelKey]);

  const {
    messages,
    sendMessage,
    status,
    setMessages,
  } = useChat({
    transport: transport as any,
    onError: (error) => {
      let errorText = "Something went wrong. Please try again later.";
      let isRateLimit = false;

      try {
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
          errorText = error.message.replace(/.*?:\s*/, "");
        }
      } catch {
        // Fall back to default
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "assistant" as const,
          content: errorText,
          parts: [{ type: "text" as const, text: errorText }],
        },
      ]);

      if (isRateLimit) {
        setShowRateLimitPrompt(true);
      }
    },
    onFinish: async ({ message }) => {
      const text = getMessageText(message);
      const citationMatch = text.match(CITATION_RE);
      const webCitationMatch = text.match(WEB_CITATION_RE);

      let citations: Citation[] | null = null;
      let webCitations: WebCitation[] | null = null;

      if (citationMatch) {
        try {
          citations = JSON.parse(citationMatch[1]);
          setStoredCitations((prev) => {
            const next = new Map(prev);
            next.set(message.id, citations!);
            return next;
          });
        } catch {
          // Ignore JSON parse error
        }
      }

      if (webCitationMatch) {
        try {
          webCitations = JSON.parse(webCitationMatch[1]);
          setStoredWebCitations((prev) => {
            const next = new Map(prev);
            next.set(message.id, webCitations!);
            return next;
          });
        } catch {
          // Ignore JSON parse error
        }
      }

      const cleanContent = text
        .replace(/<!--\s*CITATIONS:[\s\S]*?(?:-->|$)/g, "")
        .replace(/<!--\s*WEB_CITATIONS:[\s\S]*?(?:-->|$)/g, "")
        .trim();

      // Save assistant message to IndexedDB
      try {
        const currentChatId = activeChatIdRef.current;
        if (!currentChatId) return;
        await saveChatMessage({
          chat_id: currentChatId,
          role: "assistant",
          content: cleanContent,
          citations,
          webCitations,
          created_at: new Date().toISOString(),
        });
      } catch (err) {
        console.error("Failed to save assistant message:", err);
      }
    },
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Load chat history from IndexedDB on mount or activeChatId change
  useEffect(() => {
    if (!activeChatId) return;
    getChatMessages(activeChatId)
      .then((msgs) => {
        if (msgs.length > 0) {
          const loaded: UIMessage[] = msgs.map((m) => ({
            id: `db-${m.id}`,
            role: m.role as "user" | "assistant",
            content: m.content,
            parts: [{ type: "text" as const, text: m.content }],
          }));
          setMessages(loaded);

          // Load citations & web citations
          const citMap = new Map<string, Citation[]>();
          const webCitMap = new Map<string, WebCitation[]>();
          msgs.forEach((m) => {
            if (m.role === "assistant") {
              if (m.citations) citMap.set(`db-${m.id}`, m.citations);
              if (m.webCitations) webCitMap.set(`db-${m.id}`, m.webCitations);
            }
          });
          setStoredCitations(citMap);
          setStoredWebCitations(webCitMap);
        } else {
          setMessages([]);
          setStoredCitations(new Map());
          setStoredWebCitations(new Map());
        }
      })
      .catch(console.error);
  }, [setMessages, activeChatId]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // handleSend sends the message immediately to useChat for instant (0ms) UI display
  const handleSend = useCallback(() => {
    if (!inputValue.trim() || isLoading) return;

    const userText = inputValue.trim();
    setInputValue("");
    setChatDraft(activeChatId, "");

    // Set initial retrieval text
    setRetrievalStatusText(
      webSearchConfig.enabled ? "Searching documents & web…" : "Searching documents…"
    );

    // sendMessage immediately renders the user message bubble in the UI
    sendMessage({ text: userText });
  }, [
    inputValue,
    isLoading,
    sendMessage,
    activeChatId,
    setChatDraft,
    webSearchConfig,
  ]);

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
      setStoredWebCitations(new Map());
    } catch (err) {
      console.error("Failed to clear chat:", err);
    }
  };

  return (
    <div className="flex flex-col h-full glass-panel-solid overflow-hidden">
      {/* Header */}
      <div
        className="px-5 py-3.5 border-b flex items-center justify-between"
        style={{ borderColor: "var(--border-subtle)" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[var(--secondary)] flex items-center justify-center border border-[var(--border-subtle)]">
            <svg
              className="w-4 h-4"
              style={{ color: "var(--primary)" }}
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
              {webSearchConfig.enabled
                ? "Hybrid: Local Documents + Web Search"
                : "Local Document RAG"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isOllamaEnabled ? (
            <div
              className="text-xs px-3 py-1.5 rounded-lg font-medium"
              style={{
                background: "var(--secondary)",
                borderColor: "var(--border-subtle)",
                borderWidth: 1,
                color: "var(--text-primary)",
              }}
            >
              ollama/{ollamaModelName}
            </div>
          ) : (
            <ModelSelector value={modelKey} onChange={setModelKey} />
          )}

          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="btn-ghost text-xs p-1.5 rounded-lg"
              title="Clear chat history"
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
            <div className="text-center py-16 animate-fade-in max-w-sm mx-auto px-4">
              <div className="w-16 h-16 mx-auto mb-5 rounded-2xl bg-[var(--secondary)] border border-[var(--border-subtle)] flex items-center justify-center shadow-xs">
                <svg
                  className="w-8 h-8 opacity-80"
                  style={{ color: "var(--primary)" }}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold mb-1.5" style={{ color: "var(--text-primary)" }}>
                Ask anything about your documents
              </p>
              <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
                Upload files to query your private knowledge base, or toggle{" "}
                <strong style={{ color: "var(--primary)" }}>Web Search</strong> to enrich answers
                with real-time external information.
              </p>
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const text = getMessageText(msg);
          const citations = storedCitations.get(msg.id);
          const webCitations = storedWebCitations.get(msg.id);

          return (
            <ChatMessage
              key={msg.id}
              role={msg.role as "user" | "assistant"}
              content={text}
              citations={msg.role === "assistant" ? citations : undefined}
              webCitations={msg.role === "assistant" ? webCitations : undefined}
            />
          );
        })}

        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex gap-3 animate-fade-in">
            <div className="w-8 h-8 rounded-full bg-[var(--secondary)] border border-[var(--border-subtle)] flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold" style={{ color: "var(--primary)" }}>
                D
              </span>
            </div>
            <div
              className="bg-transparent px-4 py-3 rounded-2xl"
              style={{ color: "var(--text-primary)" }}
            >
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5 items-center h-5">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "var(--primary)",
                      animationDelay: "0ms",
                    }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "var(--primary)",
                      animationDelay: "200ms",
                    }}
                  />
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{
                      background: "var(--primary)",
                      animationDelay: "400ms",
                    }}
                  />
                </div>
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                  {retrievalStatusText}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer Input Area */}
      <div
        className="p-4 border-t space-y-2.5"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-primary)" }}
      >
        {/* Controls Toolbar: Web Search Toggle */}
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <WebSearchToggle
              config={webSearchConfig}
              onConfigChange={handleWebSearchConfigChange}
            />
          </div>

          <span className="text-[11px] hidden sm:inline-block" style={{ color: "var(--text-muted)" }}>
            {webSearchConfig.enabled ? "Hybrid Retrieval Active" : "Local Documents Only"}
          </span>
        </div>

        {/* Text Input Row */}
        <div className="flex gap-3 items-stretch">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setChatDraft(activeChatId, e.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={
              webSearchConfig.enabled
                ? "Ask about your documents and search the web…"
                : "Ask about your documents…"
            }
            rows={1}
            className="input-base flex-1 resize-none min-h-[42px] max-h-[120px] bg-[var(--secondary)] focus:bg-[var(--bg-primary)] py-2.5"
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
            title="Send Message (Enter)"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in"
          style={{ background: "var(--backdrop-overlay)" }}
        >
          <div className="bg-[var(--bg-primary)] border border-[var(--border-subtle)] p-6 rounded-2xl w-[400px] max-w-[90vw] shadow-2xl">
            <h2 className="text-lg font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Usage Limit Reached
            </h2>
            <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
              You&apos;ve exceeded the free demo limit. Would you like to enter your own Groq API key
              or configure custom search endpoints to continue with unmetered usage?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowRateLimitPrompt(false)}
                className="btn-ghost px-4 py-2 text-sm"
              >
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
