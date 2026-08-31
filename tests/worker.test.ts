import test from "node:test";
import assert from "node:assert/strict";
import worker from "../cloudflare/workers.js";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

test("Worker - OPTIONS CORS preflight (allowed origin)", async () => {
  const allowedOrigin = "https://dossara.evanferrao.com";
  const req = new Request(`${WORKER_URL}/api/web-search`, {
    method: "OPTIONS",
    headers: { Origin: allowedOrigin },
  });

  const env = {
    ALLOWED_ORIGINS: "https://dossara.evanferrao.com,https://dossara.pages.dev,https://*.dossara.pages.dev",
  };
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), allowedOrigin);
  assert.match(res.headers.get("Access-Control-Allow-Methods") || "", /POST/);
  assert.match(res.headers.get("Access-Control-Allow-Headers") || "", /X-Client-ID/);
  assert.equal(res.headers.get("Vary"), "Origin");
});

test("Worker - OPTIONS CORS preflight (wildcard subdomain match)", async () => {
  const req = new Request(`${WORKER_URL}/api/web-search`, {
    method: "OPTIONS",
    headers: { Origin: "https://abc123.dossara.pages.dev" },
  });

  const env = {
    ALLOWED_ORIGINS: "https://dossara.evanferrao.com,https://*.dossara.pages.dev",
  };
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), "https://abc123.dossara.pages.dev");
});

test("Worker - OPTIONS CORS preflight (disallowed origin)", async () => {
  const req = new Request(`${WORKER_URL}/api/web-search`, {
    method: "OPTIONS",
    headers: { Origin: "https://evil-site.com" },
  });

  const env = {
    ALLOWED_ORIGINS: "https://dossara.evanferrao.com,https://*.dossara.pages.dev",
  };
  const res = await worker.fetch(req, env, {});
  assert.equal(res.status, 204);
  // Disallowed origin should NOT get an Access-Control-Allow-Origin header
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
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

  const res = await worker.fetch(req, { MAX_CHAT_PER_IP_PER_DAY: "20" }, {});
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error, "INVALID_REQUEST");
});

test("Worker - Default limit of 5 requests per day", async () => {
  const testIp = `default-limit-ip-${Date.now()}`;
  const env = {
    TAVILY_API_KEY: "tvly-dev-test",
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        results: [{ title: "Test", url: "https://test.com", score: 0.9 }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    // Send 5 requests (all should succeed)
    for (let i = 1; i <= 5; i++) {
      const req = new Request(`${WORKER_URL}/api/web-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
        body: JSON.stringify({ query: `query ${i}` }),
      });
      const res = await worker.fetch(req, env, {});
      assert.equal(res.status, 200, `Request ${i} should succeed`);
    }

    // Request 6: should be blocked by default 5 limit
    const req6 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "query 6" }),
    });
    const res6 = await worker.fetch(req6, env, {});
    assert.equal(res6.status, 429);
    assert.equal(res6.headers.get("X-RateLimit-Limit"), "5");
    const data6 = await res6.json();
    assert.equal(data6.error, "RATE_LIMITED");
    assert.match(data6.message, /allows up to 5 requests per day/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker - Rate Limiting via persistent X-Client-ID header", async () => {
  const testClientId = `client-uuid-${Date.now()}`;
  const env = {
    MAX_CHAT_PER_IP_PER_DAY: "2",
    TAVILY_API_KEY: "tvly-dev-test",
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ results: [{ title: "Test", url: "https://test.com", score: 0.9 }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    // Request 1 with different IPs but same X-Client-ID
    const req1 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "10.0.0.1",
        "X-Client-ID": testClientId,
      },
      body: JSON.stringify({ query: "search 1" }),
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 200);

    // Request 2 with another IP but same X-Client-ID
    const req2 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "10.0.0.2",
        "X-Client-ID": testClientId,
      },
      body: JSON.stringify({ query: "search 2" }),
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 200);

    // Request 3: blocked by client ID limit
    const req3 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": "10.0.0.3",
        "X-Client-ID": testClientId,
      },
      body: JSON.stringify({ query: "search 3" }),
    });
    const res3 = await worker.fetch(req3, env, {});
    assert.equal(res3.status, 429);
    const data3 = await res3.json();
    assert.equal(data3.error, "RATE_LIMITED");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker - Rate Limiting with KV namespace binding", async () => {
  const kvStore = new Map<string, string>();
  const mockKv = {
    async get(key: string) {
      return kvStore.get(key) || null;
    },
    async put(key: string, value: string) {
      kvStore.set(key, value);
    },
  };

  const testIp = `kv-test-ip-${Date.now()}`;
  const env = {
    MAX_CHAT_PER_IP_PER_DAY: "2",
    RATE_LIMIT_KV: mockKv,
    TAVILY_API_KEY: "tvly-dev-test",
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ results: [{ title: "Test", url: "https://test.com", score: 0.9 }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const req1 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 1" }),
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 200);

    const req2 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 2" }),
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 200);

    // 3rd request should be blocked by KV
    const req3 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 3" }),
    });
    const res3 = await worker.fetch(req3, env, {});
    assert.equal(res3.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Worker - Rate Limiting with Cache API", async () => {
  const cacheStore = new Map<string, Response>();
  const mockCache = {
    async match(req: Request) {
      const existing = cacheStore.get(req.url);
      return existing ? existing.clone() : undefined;
    },
    async put(req: Request, res: Response) {
      cacheStore.set(req.url, res.clone());
    },
  };

  (globalThis as any).caches = { default: mockCache };

  const testIp = `cache-test-ip-${Date.now()}`;
  const env = {
    MAX_CHAT_PER_IP_PER_DAY: "2",
    TAVILY_API_KEY: "tvly-dev-test",
  };

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({ results: [{ title: "Test", url: "https://test.com", score: 0.9 }] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  try {
    const req1 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 1" }),
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 200);

    const req2 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 2" }),
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 200);

    const req3 = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "cf-connecting-ip": testIp },
      body: JSON.stringify({ query: "search 3" }),
    });
    const res3 = await worker.fetch(req3, env, {});
    assert.equal(res3.status, 429);
  } finally {
    globalThis.fetch = originalFetch;
    delete (globalThis as any).caches;
  }
});
