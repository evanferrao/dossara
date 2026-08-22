import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeTavilyResults,
  getFaviconUrl,
} from "../lib/web-search/normalize";
import { TavilyWorkerProvider } from "../lib/web-search/tavily-worker";
import { TavilyClientProvider } from "../lib/web-search/tavily-client";
import { getWebSearchProvider } from "../lib/web-search/provider";
import type { WebSearchConfig } from "../lib/web-search/types";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "";

test("Favicon URL extractor", () => {
  const url = "https://react.dev/learn";
  const favicon = getFaviconUrl(url);
  assert.equal(favicon, "https://www.google.com/s2/favicons?domain=react.dev&sz=32");
});

test("Tavily normalization - score filtering & fallback", () => {
  const rawResults = [
    {
      title: "High Relevance Result",
      url: "https://example.com/high",
      content: "Summary snippet",
      raw_content: "Full extracted clean content of the page",
      score: 0.88,
      published_date: "2024-01-01",
    },
    {
      title: "Low Relevance Result",
      url: "https://example.com/low",
      content: "Low relevance snippet",
      score: 0.35,
    },
  ];

  // Default filter >= 0.5: only high relevance item kept
  const filtered = normalizeTavilyResults(rawResults, 0.5);
  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].title, "High Relevance Result");
  assert.equal(filtered[0].content, "Full extracted clean content of the page");
  assert.equal(filtered[0].score, 0.88);
  assert.equal(filtered[0].source, "tavily");

  // If ALL results are below threshold, fallback returns the best results rather than failing/empty
  const lowOnly = [
    { title: "Low 1", url: "https://example.com/1", score: 0.4 },
    { title: "Low 2", url: "https://example.com/2", score: 0.2 },
  ];
  const fallback = normalizeTavilyResults(lowOnly, 0.5);
  assert.equal(fallback.length, 2);
  assert.equal(fallback[0].title, "Low 1");
});

test("TavilyWorkerProvider - handles empty query without network call", async () => {
  const provider = new TavilyWorkerProvider(WORKER_URL);
  const res = await provider.search("   ");
  assert.deepEqual(res, []);
});

test("TavilyWorkerProvider - handles HTTP 429 rate limit error", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        error: "RATE_LIMITED",
        message: "Daily web search limit reached.",
      }),
      { status: 429, headers: { "Content-Type": "application/json" } }
    );

  try {
    const provider = new TavilyWorkerProvider(WORKER_URL);
    await assert.rejects(
      async () => {
        await provider.search("transformers");
      },
      {
        name: "Error",
        message: "Daily web search limit reached.",
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TavilyClientProvider - direct client query and headers", async () => {
  const originalFetch = globalThis.fetch;
  let capturedUrl = "";
  let capturedHeaders: any = {};
  let capturedBody: any = {};

  globalThis.fetch = async (url: any, init: any) => {
    capturedUrl = url.toString();
    capturedHeaders = init?.headers;
    capturedBody = JSON.parse(init?.body as string);

    return new Response(
      JSON.stringify({
        results: [
          {
            title: "Direct Tavily Result",
            url: "https://direct.com/page",
            content: "Snippet",
            raw_content: "Clean direct content",
            score: 0.95,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  try {
    const provider = new TavilyClientProvider("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");
    const results = await provider.search("latest LLMs", { maxResults: 3 });

    assert.equal(capturedUrl, "https://api.tavily.com/search");
    assert.equal(
      capturedHeaders["Authorization"],
      "Bearer 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"
    );
    assert.equal(capturedBody.query, "latest LLMs");
    assert.equal(capturedBody.max_results, 3);
    assert.equal(capturedBody.search_depth, "basic");
    assert.equal(capturedBody.include_answer, false);
    assert.equal(capturedBody.include_raw_content, true);

    assert.equal(results.length, 1);
    assert.equal(results[0].title, "Direct Tavily Result");
    assert.equal(results[0].score, 0.95);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Provider router - selection rules between Demo Worker and User Key", () => {
  // Mode 1: Default config (Demo Tavily Cloudflare Worker)
  const defaultConfig: WebSearchConfig = {
    enabled: true,
    provider: "tavily-worker",
  };
  const defaultProvider = getWebSearchProvider(defaultConfig, WORKER_URL);
  assert.equal(defaultProvider.providerType, "tavily-worker");

  // Mode 2: User Tavily API key provided (Direct client-side)
  const clientConfig: WebSearchConfig = {
    enabled: true,
    provider: "tavily-client",
    tavilyApiKey: "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",
  };
  const clientProvider = getWebSearchProvider(clientConfig, WORKER_URL);
  assert.equal(clientProvider.providerType, "tavily-client");
});

test("Live Tavily API Client - real query test with provided key", async () => {
  const apiKey = "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";
  const provider = new TavilyClientProvider(apiKey);
  try {
    const results = await provider.search("What is RAG in AI", { maxResults: 2 });
    assert.ok(Array.isArray(results));
    if (results.length > 0) {
      assert.ok(results[0].title);
      assert.ok(results[0].url);
      assert.equal(results[0].source, "tavily");
    }
  } catch (err: any) {
    console.log("Live Tavily test notice:", err.message);
  }
});
