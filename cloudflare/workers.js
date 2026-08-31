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

/**
 * Check whether `origin` matches any entry in the ALLOWED_ORIGINS allowlist.
 * Supports exact matches and wildcard patterns (e.g. "https://*.dossara.pages.dev").
 */
function isOriginAllowed(origin, allowedList) {
  for (const entry of allowedList) {
    if (entry === origin) return true;
    if (entry.includes("*")) {
      const pattern = "^" + entry.replace(/[-[\]/{}()+?.\\^$|]/g, "\\$&").replace(/\*/g, "[a-zA-Z0-9-]+") + "$";
      if (new RegExp(pattern).test(origin)) return true;
    }
  }
  return false;
}

function getCorsHeaders(request, env) {
  const raw = env?.ALLOWED_ORIGINS || env?.ALLOWED_ORIGIN || "*";

  // Wildcard: allow everything (dev-only)
  if (raw === "*") {
    return {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-ID",
    };
  }

  // Parse comma-separated allowlist
  const allowedList = raw.split(",").map((s) => s.trim()).filter(Boolean);
  const requestOrigin = request?.headers?.get("Origin") || "";

  if (requestOrigin && isOriginAllowed(requestOrigin, allowedList)) {
    return {
      "Access-Control-Allow-Origin": requestOrigin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-ID",
      "Vary": "Origin",
    };
  }

  // Origin not in allowlist — omit Access-Control-Allow-Origin so the browser blocks it
  return {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-ID",
    "Vary": "Origin",
  };
}

/**
 * Validate that the request has a JSON Content-Type header.
 * Returns a 415 Response if invalid, or null if valid.
 */
function validateJsonContentType(request, corsHeaders) {
  const ct = request.headers.get("Content-Type") || "";
  if (!ct.includes("application/json")) {
    return new Response(
      JSON.stringify({ error: "UNSUPPORTED_MEDIA_TYPE", message: "Content-Type must be application/json." }),
      { status: 415, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  return null;
}

// In-memory rate limiting fallback store (L1 cache / test fallback)
const FALLBACK_STORE_MAX_SIZE = 10_000;
const fallbackStore = new Map();

function getDailyResetInfo() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  const dateKey = `${year}-${month}-${day}`;

  const nextResetMs = Date.UTC(year, now.getUTCMonth(), now.getUTCDate() + 1);
  const nowMs = now.getTime();
  const retryAfterSecs = Math.max(1, Math.ceil((nextResetMs - nowMs) / 1000));

  return { dateKey, nextResetMs, retryAfterSecs };
}

function getClientKeys(request) {
  const keys = [];

  // 1. Cloudflare Connecting IP (most trustworthy on Cloudflare Workers)
  const cfIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cfIp) {
    keys.push(`ip:${cfIp}`);
  }

  // 2. Client ID (persistent browser identifier)
  const clientId = request.headers.get("x-client-id")?.trim();
  if (clientId) {
    keys.push(`cid:${clientId}`);
  }

  // 3. Fallback to X-Forwarded-For or X-Real-IP if no CF-Connecting-IP
  if (!cfIp) {
    const xff = request.headers.get("x-forwarded-for");
    if (xff) {
      const firstIp = xff.split(",")[0].trim();
      if (firstIp) keys.push(`ip:${firstIp}`);
    }
    const realIp = request.headers.get("x-real-ip")?.trim();
    if (realIp && !keys.includes(`ip:${realIp}`)) {
      keys.push(`ip:${realIp}`);
    }
  }

  if (keys.length === 0) {
    keys.push("ip:anonymous-client");
  }

  return keys;
}

function createRateLimitResponse(maxRequests, retryAfterSecs, resetMs, corsHeaders) {
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
        "X-RateLimit-Reset": String(Math.ceil(resetMs / 1000)),
      },
    }
  );
}

/**
 * Shared rate limiter for /api/chat and /api/web-search.
 */
async function enforceRateLimit(request, env, corsHeaders) {
  const maxRequests = parseInt(
    env.MAX_CHAT_PER_IP_PER_DAY || "5",
    10
  );

  if (maxRequests <= 0) {
    return null;
  }

  const clientKeys = getClientKeys(request);
  const { dateKey, nextResetMs, retryAfterSecs } = getDailyResetInfo();

  // 1. Native Cloudflare Rate Limiting binding (if configured)
  if (env.DOSSARA_RATE_LIMITER && typeof env.DOSSARA_RATE_LIMITER.limit === "function") {
    try {
      for (const key of clientKeys) {
        const { success } = await env.DOSSARA_RATE_LIMITER.limit({ key });
        if (!success) {
          return createRateLimitResponse(maxRequests, retryAfterSecs, nextResetMs, corsHeaders);
        }
      }
    } catch (err) {
      console.warn("Cloudflare rate limiter binding error:", err);
    }
  }

  // 2. Cloudflare KV Namespace (if bound: RATE_LIMIT_KV / DOSSARA_KV / KV)
  const kv = env.RATE_LIMIT_KV || env.DOSSARA_KV || env.KV;
  if (kv && typeof kv.get === "function" && typeof kv.put === "function") {
    try {
      let isLimited = false;
      for (const key of clientKeys) {
        const kvKey = `ratelimit:${key}:${dateKey}`;
        const currentCountStr = await kv.get(kvKey);
        const currentCount = parseInt(currentCountStr || "0", 10);
        if (currentCount >= maxRequests) {
          isLimited = true;
        } else {
          await kv.put(kvKey, String(currentCount + 1), {
            expirationTtl: Math.max(60, retryAfterSecs + 3600),
          });
        }
      }
      if (isLimited) {
        return createRateLimitResponse(maxRequests, retryAfterSecs, nextResetMs, corsHeaders);
      }
    } catch (err) {
      console.warn("Cloudflare KV rate limiter error:", err);
    }
  }

  // 3. Cloudflare Edge Cache API (available in Cloudflare Workers edge runtime)
  if (typeof caches !== "undefined" && caches.default) {
    try {
      const cache = caches.default;
      let isLimited = false;
      for (const key of clientKeys) {
        const cacheUrl = `https://rate-limit.internal/${encodeURIComponent(key)}/${dateKey}`;
        const cacheReq = new Request(cacheUrl);
        const cachedRes = await cache.match(cacheReq);
        let cachedCount = 0;
        if (cachedRes) {
          const text = await cachedRes.text();
          cachedCount = parseInt(text || "0", 10);
        }
        if (cachedCount >= maxRequests) {
          isLimited = true;
        } else {
          const nextRes = new Response(String(cachedCount + 1), {
            headers: {
              "Content-Type": "text/plain",
              "Cache-Control": `public, max-age=${retryAfterSecs}`,
            },
          });
          await cache.put(cacheReq, nextRes);
        }
      }
      if (isLimited) {
        return createRateLimitResponse(maxRequests, retryAfterSecs, nextResetMs, corsHeaders);
      }
    } catch (err) {
      // Cache API may not be available in non-CF environments (unit tests); gracefully continue
    }
  }

  // 4. In-memory rate limiting fallback store (local isolate / tests)
  // Prune stale entries if the store exceeds the size cap
  if (fallbackStore.size > FALLBACK_STORE_MAX_SIZE) {
    const now = Date.now();
    for (const [k, v] of fallbackStore) {
      if (v.resetAt <= now) fallbackStore.delete(k);
    }
    // If still over capacity after pruning expired entries, drop oldest half
    if (fallbackStore.size > FALLBACK_STORE_MAX_SIZE) {
      const keysToDelete = [...fallbackStore.keys()].slice(0, Math.floor(fallbackStore.size / 2));
      for (const k of keysToDelete) fallbackStore.delete(k);
    }
  }

  for (const key of clientKeys) {
    const memoryKey = `${key}:${dateKey}`;
    let entry = fallbackStore.get(memoryKey);
    if (!entry) {
      entry = { count: 0, resetAt: nextResetMs };
      fallbackStore.set(memoryKey, entry);
    }
    entry.count++;
    if (entry.count > maxRequests) {
      return createRateLimitResponse(maxRequests, retryAfterSecs, nextResetMs, corsHeaders);
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

  const ctError = validateJsonContentType(request, corsHeaders);
  if (ctError) return ctError;

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

  const ctError = validateJsonContentType(request, corsHeaders);
  if (ctError) return ctError;

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "INVALID_REQUEST", message: "Invalid JSON body." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
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
    // Log full error server-side but return a generic message to the client
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
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
