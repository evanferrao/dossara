import { streamText, convertToModelMessages } from "ai";
import { createGroq } from "@ai-sdk/groq";

function buildSystemPrompt(params) {
  const {
    docCount = 0,
    docInventory = "",
    referencedDocCount = 0,
    chunkCount = 0,
    webSourceCount = 0,
    context = "",
  } = params;

  const hasWeb = webSourceCount > 0;
  const noDocsMessage =
    "No documents have been uploaded yet. You can answer general queries or use web search results if enabled.";

  return `You are Dossara, an intelligent assistant capable of answering questions using local document context and external web sources.

## Instructions
- Answer the user's question using the provided retrieved context below.
${
  hasWeb
    ? `- Source Provenance:
  1. LOCAL DOCUMENTS: Information originating from documents uploaded by the user.
  2. WEB SOURCES: Information retrieved from external web pages.
- Do NOT claim that information came from the user's documents when it came from the web.
- Do NOT claim that information came from the web when it came from the user's documents.
- Never invent or fabricate URLs. Only reference URLs explicitly supplied in the web sources context.`
    : `- If the retrieved passages don't contain enough information, say so honestly.`
}
- When referencing specific local information, cite the passage number and document name (e.g., "According to Passage 1 from \\"filename.pdf\\"...").
- When referencing web sources, cite the source name or title clearly.
- If the context does not contain enough information to answer, state that clearly and accurately.
- Be concise, accurate, and thorough.
- When the user asks how many documents you have access to, refer to the "Your Documents" section — NOT the number of retrieved passages.

## Citations
- CRITICAL: At the very end of your response, on new lines, include citation blocks for the sources you used:
  ${
    referencedDocCount > 0 || chunkCount > 0
      ? `If you referenced any local document passages:
  <!-- CITATIONS: [{"documentId": "<ID>", "filename": "<filename>", "page": <page>}] -->
  Use the exact ID, filename, and page number provided in the passage headers.`
      : ""
  }
  ${
    hasWeb
      ? `If you referenced any external web sources:
  <!-- WEB_CITATIONS: [{"title": "<title>", "url": "<url>", "source": "<source>"}] -->
  Use the exact title, URL, and source provided in the web source headers.`
      : ""
  }

## Your Documents
${
  docCount > 0
    ? `You have access to ${docCount} document(s) uploaded by the user:\n${docInventory}`
    : noDocsMessage
}

## Retrieved Context (${referencedDocCount} document(s), ${chunkCount} passage(s)${
    hasWeb ? `, ${webSourceCount} web source(s)` : ""
  })
${context || "No matching context found for this query."}`;
}

function getCorsHeaders(request, env) {
  const origin = request?.headers?.get("Origin") || "*";
  const allowed = env?.ALLOWED_ORIGIN || "*";
  return {
    "Access-Control-Allow-Origin": allowed === "*" ? origin : allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-ID",
  };
}

// In-memory rate limiting fallback store
const fallbackStore = new Map();

function getNextDayResetMs() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

/**
 * Shared rate limiter for /api/chat and /api/web-search.
 */
async function enforceRateLimit(request, env, corsHeaders) {
  const clientKey =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-forwarded-for") ||
    "anonymous-client";

  // 1. Native Cloudflare Rate Limiting binding (if configured)
  if (env.DOSSARA_RATE_LIMITER && typeof env.DOSSARA_RATE_LIMITER.limit === "function") {
    try {
      const { success } = await env.DOSSARA_RATE_LIMITER.limit({ key: clientKey });
      if (!success) {
        return new Response(
          JSON.stringify({
            error: "RATE_LIMITED",
            message: "Too many requests. Please try again later.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
      return null;
    } catch (err) {
      console.warn("Cloudflare rate limiter error, falling back to memory:", err);
    }
  }

  // 2. Shared in-memory / daily rate limiter fallback
  const maxRequests = parseInt(
    env.MAX_REQUESTS_PER_CLIENT || env.MAX_CHAT_PER_IP_PER_DAY || "10",
    10
  );

  if (maxRequests > 0) {
    const now = Date.now();
    let entry = fallbackStore.get(clientKey);

    if (!entry || now >= entry.resetAt) {
      entry = { count: 0, resetAt: getNextDayResetMs() };
      fallbackStore.set(clientKey, entry);
    }

    entry.count++;

    if (entry.count > maxRequests) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
      return new Response(
        JSON.stringify({
          error: "RATE_LIMITED",
          message: `Usage limit reached — This demo project allows up to ${maxRequests} requests per day across chat & search to manage API costs. Set your own API key in settings for unmetered access.`,
          retryAfter: retryAfterSecs,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(retryAfterSecs),
            "X-RateLimit-Limit": String(maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
          },
        }
      );
    }
  }

  return null;
}

/**
 * Handle POST /api/web-search requests.
 */
async function handleWebSearch(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: "Invalid JSON body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const query = (body.query || "").trim();
  if (!query) {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: "A search query is required." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!env.TAVILY_API_KEY) {
    console.error("TAVILY_API_KEY secret is not set in Worker environment.");
    return new Response(
      JSON.stringify({
        error: "WEB_SEARCH_FAILED",
        message: "Web search is temporarily unavailable (API key missing).",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const maxResults = Math.min(Math.max(Number(body.maxResults) || 5, 1), 10);
    const payload = {
      query,
      max_results: maxResults,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: true,
    };

    if (body.timeRange) payload.time_range = body.timeRange;
    if (Array.isArray(body.includeDomains) && body.includeDomains.length > 0) {
      payload.include_domains = body.includeDomains;
    }
    if (Array.isArray(body.excludeDomains) && body.excludeDomains.length > 0) {
      payload.exclude_domains = body.excludeDomains;
    }

    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.TAVILY_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    if (!tavilyRes.ok) {
      console.error(`Tavily upstream returned ${tavilyRes.status}`);
      return new Response(
        JSON.stringify({
          error: "WEB_SEARCH_FAILED",
          message: "Web search is temporarily unavailable.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await tavilyRes.json();
    const rawResults = Array.isArray(data.results) ? data.results : [];

    // Normalize results
    const normalized = rawResults
      .filter((r) => r && typeof r.url === "string" && r.url.startsWith("http"))
      .map((r) => {
        let favicon = undefined;
        try {
          const domain = new URL(r.url).hostname;
          favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        } catch {
          // Ignore URL parse error
        }

        return {
          title: (r.title || "").trim() || "Untitled Web Result",
          url: r.url.trim(),
          content: (r.raw_content || r.content || "").trim(),
          score: typeof r.score === "number" ? r.score : undefined,
          publishedDate: r.published_date || undefined,
          source: "tavily",
          favicon,
        };
      });

    // Score filtering with fallback
    const minScore = 0.5;
    let filtered = normalized.filter((r) => r.score === undefined || r.score >= minScore);
    if (filtered.length === 0 && normalized.length > 0) {
      normalized.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      filtered = normalized;
    }

    return new Response(JSON.stringify({ results: filtered.slice(0, maxResults) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Web search internal error:", error);
    return new Response(
      JSON.stringify({
        error: "WEB_SEARCH_FAILED",
        message: "Web search is temporarily unavailable.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}

/**
 * Handle POST /api/chat requests.
 */
async function handleChat(request, env, corsHeaders) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const body = await request.json();

    const groq = createGroq({ apiKey: env.GROQ_API_KEY });
    const modelId = body.model || "llama-3.1-8b-instant";

    const systemPrompt = buildSystemPrompt({
      docCount: body.docCount ?? 0,
      docInventory: body.docInventory ?? "",
      referencedDocCount: body.referencedDocCount ?? 0,
      chunkCount: body.chunkCount ?? 0,
      webSourceCount: body.webSourceCount ?? 0,
      context: body.context ?? "",
    });

    const llmMessages = await convertToModelMessages(body.messages ?? []);

    const result = streamText({
      model: groq(modelId),
      instructions: systemPrompt,
      messages: llmMessages,
    });

    const streamResponse = result.toUIMessageStreamResponse();

    const newHeaders = new Headers(streamResponse.headers);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      newHeaders.set(key, value);
    });

    return new Response(streamResponse.body, {
      status: streamResponse.status,
      statusText: streamResponse.statusText,
      headers: newHeaders,
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

/**
 * Handle GET /health requests.
 */
function handleHealth(corsHeaders) {
  return new Response(
    JSON.stringify({ status: "ok", version: "1.0.0", timestamp: new Date().toISOString() }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

export default {
  async fetch(request, env, ctx) {
    const corsHeaders = getCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const pathname = url.pathname.replace(/\/+$/, "") || "/";

    if (pathname === "/health") {
      return handleHealth(corsHeaders);
    }

    if (pathname === "/api/web-search") {
      const rateLimitResponse = await enforceRateLimit(request, env, corsHeaders);
      if (rateLimitResponse) return rateLimitResponse;
      return handleWebSearch(request, env, corsHeaders);
    }

    if (pathname === "/api/chat" || pathname === "/") {
      const rateLimitResponse = await enforceRateLimit(request, env, corsHeaders);
      if (rateLimitResponse) return rateLimitResponse;
      return handleChat(request, env, corsHeaders);
    }

    return new Response("Not Found", { status: 404, headers: corsHeaders });
  },
};
