import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers.js";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

test("Worker - OPTIONS CORS preflight", async () => {
  const req = new Request(`${WORKER_URL}/api/web-search`, {
    method: "OPTIONS",
    headers: { Origin: "http://localhost:3000" },
  });

  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "http://localhost:3000");
  assert.match(res.headers.get("Access-Control-Allow-Methods") || "", /POST/);
});

test("Worker - GET /health endpoint", async () => {
  const req = new Request(`${WORKER_URL}/health`, {
    method: "GET",
  });

  const res = await worker.fetch(req, {}, {});
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(data.status, "ok");
});

test("Worker - /api/web-search validation on empty query", async () => {
  const req = new Request(`${WORKER_URL}/api/web-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": "1.2.3.4",
    },
    body: JSON.stringify({ query: "" }),
  });

  const res = await worker.fetch(req, { MAX_REQUESTS_PER_CLIENT: "20" }, {});
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "INVALID_REQUEST");
});

test("Worker - Shared Rate Limiting across /api/chat and /api/web-search", async () => {
  const testIp = `test-ip-${Date.now()}`;
  const env = {
    MAX_REQUESTS_PER_CLIENT: "3",
    TAVILY_API_KEY: "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",
  };

  // Mock global fetch for upstream Tavily
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [{ title: "Test", url: "https://test.com", score: 0.9 }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    // Request 1: /api/web-search
    const req1 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 1" }),
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 200);

    // Request 2: /api/web-search
    const req2 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 2" }),
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 200);

    // Request 3: /api/web-search
    const req3 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 3" }),
    });
    const res3 = await worker.fetch(req3, env, {});
    assert.equal(res3.status, 200);

    // Request 4: /api/web-search (4th request from same IP should be blocked by shared rate limit)
    const req4 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 4" }),
    });
    const res4 = await worker.fetch(req4, env, {});
    assert.equal(res4.status, 429);
    const data4 = await res4.json();
    assert.equal(data4.error, "RATE_LIMITED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
