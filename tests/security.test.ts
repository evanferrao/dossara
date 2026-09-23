import test from "node:test";
import assert from "node:assert/strict";
import { isSafeUrl, sanitizeUrl, isValidOllamaUrl, sanitizeFilename, escapeHtml } from "../lib/security";
import { generateUUID } from "../lib/uuid";
import worker from "../cloudflare/workers.js";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

test("Security - isSafeUrl permits safe protocols and blocks dangerous schemes", () => {
  // Safe protocols
  assert.equal(isSafeUrl("https://example.com"), true);
  assert.equal(isSafeUrl("http://localhost:3000"), true);
  assert.equal(isSafeUrl("mailto:support@example.com"), true);
  assert.equal(isSafeUrl("https://example.com/path?foo=bar#hash"), true);

  // Dangerous / XSS vectors
  assert.equal(isSafeUrl("javascript:alert(1)"), false);
  assert.equal(isSafeUrl("javascript:/*--></title></style></textarea>*/<script>alert(1)</script>"), false);
  assert.equal(isSafeUrl("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeUrl("vbscript:msgbox(1)"), false);
  assert.equal(isSafeUrl("file:///etc/passwd"), false);

  // Null, empty, whitespace
  assert.equal(isSafeUrl(""), false);
  assert.equal(isSafeUrl("   "), false);
  assert.equal(isSafeUrl(null), false);
  assert.equal(isSafeUrl(undefined), false);
});

test("Security - sanitizeUrl returns fallback on dangerous URLs", () => {
  assert.equal(sanitizeUrl("https://safe.com"), "https://safe.com");
  assert.equal(sanitizeUrl("javascript:alert(1)"), "#");
  assert.equal(sanitizeUrl("javascript:alert(1)", "about:blank"), "about:blank");
  assert.equal(sanitizeUrl(""), "#");
});

test("Security - isValidOllamaUrl validates HTTP/HTTPS endpoints and blocks malicious schemes", () => {
  assert.equal(isValidOllamaUrl("http://localhost:11434"), true);
  assert.equal(isValidOllamaUrl("http://127.0.0.1:11434"), true);
  assert.equal(isValidOllamaUrl("https://my-ollama.internal.net"), true);

  // Invalid schemes and strings
  assert.equal(isValidOllamaUrl("javascript:alert(1)"), false);
  assert.equal(isValidOllamaUrl("file:///tmp"), false);
  assert.equal(isValidOllamaUrl("not-a-url"), false);
  assert.equal(isValidOllamaUrl(""), false);
  assert.equal(isValidOllamaUrl(null), false);
});

test("Security - sanitizeFilename strips path traversal and control characters", () => {
  assert.equal(sanitizeFilename("../../../etc/passwd"), "etc_passwd");
  assert.equal(sanitizeFilename("..\\..\\windows\\system32\\cmd.exe"), "windows_system32_cmd.exe");
  assert.equal(sanitizeFilename("report\0.pdf"), "report.pdf");
  assert.equal(sanitizeFilename("my document.pdf"), "my document.pdf");
  assert.equal(sanitizeFilename(""), "document");
  assert.equal(sanitizeFilename("..."), "document");
});

test("Security - generateUUID produces RFC 4122 v4 UUID", () => {
  const uuid = generateUUID();
  assert.equal(typeof uuid, "string");
  assert.equal(uuid.length, 36);
  // v4 regex pattern: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const v4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  assert.match(uuid, v4Regex);
});

test("Security - escapeHtml encodes OWASP-recommended characters", () => {
  assert.equal(escapeHtml('<script>alert("xss")</script>'), "&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;");
  assert.equal(escapeHtml("Tom & Jerry's"), "Tom &amp; Jerry&#x27;s");
  assert.equal(escapeHtml(""), "");
  assert.equal(escapeHtml(null as unknown as string), "");
  assert.equal(escapeHtml(undefined as unknown as string), "");
});

test("Security - Cloudflare Worker responses include modern security headers", async () => {
  const req = new Request(`${WORKER_URL}/health`, { method: "GET" });
  const res = await worker.fetch(req, {}, {});

  assert.equal(res.status, 200);
  assert.equal(res.headers.get("X-Content-Type-Options"), "nosniff");
  assert.equal(res.headers.get("X-Frame-Options"), "DENY");
  assert.equal(res.headers.get("Referrer-Policy"), "strict-origin-when-cross-origin");
  assert.equal(res.headers.get("Cross-Origin-Opener-Policy"), "same-origin");
});

test("Security - Worker includes HSTS and Permissions-Policy headers", async () => {
  const req = new Request(`${WORKER_URL}/health`, { method: "GET" });
  const res = await worker.fetch(req, {}, {});

  assert.equal(res.status, 200);
  assert.ok(
    res.headers.get("Strict-Transport-Security")?.includes("max-age="),
    "HSTS header should include max-age"
  );
  assert.ok(
    res.headers.get("Permissions-Policy")?.includes("camera=()"),
    "Permissions-Policy should restrict camera"
  );
});

test("Security - Worker caps web search queries to 400 characters", async () => {
  const longQuery = "a".repeat(1000);
  let capturedQuery = "";

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (typeof url === "string" && url.includes("tavily.com")) {
      const parsedBody = JSON.parse(options?.body as string);
      capturedQuery = parsedBody.query;
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return originalFetch(url, options);
  };

  try {
    const req = new Request(`${WORKER_URL}/api/web-search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "cf-connecting-ip": `query-test-${Date.now()}`,
      },
      body: JSON.stringify({ query: longQuery }),
    });

    const res = await worker.fetch(req, { TAVILY_API_KEY: "tvly-test", MAX_CHAT_PER_IP_PER_DAY: "10" }, {});
    assert.equal(res.status, 200);
    assert.ok(capturedQuery.length <= 400, `Query length ${capturedQuery.length} should be <= 400`);
    assert.equal(capturedQuery.length, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("Security - Worker rejects oversized request bodies with 413", async () => {
  // Simulate a request with a Content-Length header exceeding 1 MB
  const req = new Request(`${WORKER_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Content-Length": "2097152", // 2 MB
      "cf-connecting-ip": `body-size-test-${Date.now()}`,
    },
    body: JSON.stringify({ messages: [] }),
  });

  const res = await worker.fetch(req, { GROQ_API_KEY: "test", MAX_CHAT_PER_IP_PER_DAY: "100" }, {});
  assert.equal(res.status, 413);
  const body = await res.json();
  assert.equal(body.error, "PAYLOAD_TOO_LARGE");
});

test("Security - Worker sanitizes internal error messages in chat responses", async () => {
  // Simulate a chat request that will fail due to missing API key
  // The error should be generic, not revealing internal details
  const req = new Request(`${WORKER_URL}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "cf-connecting-ip": `error-sanitize-test-${Date.now()}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: "test" }],
      model: "llama-3.1-8b-instant",
    }),
  });

  // No GROQ_API_KEY provided — will cause an internal error
  const res = await worker.fetch(req, { MAX_CHAT_PER_IP_PER_DAY: "100" }, {});
  
  // The worker should return an error, but the message should not leak internals
  if (res.status >= 400) {
    const body = await res.json();
    assert.ok(
      !body.message?.includes("gsk_"),
      "Error message should not contain API key fragments"
    );
    assert.ok(
      !body.message?.includes("at Object."),
      "Error message should not contain stack traces"
    );
  }
});

test("Security - Worker rejects oversized origin strings (ReDoS prevention)", async () => {
  const longOrigin = "https://" + "a".repeat(500) + ".example.com";
  const req = new Request(`${WORKER_URL}/health`, {
    method: "OPTIONS",
    headers: { "Origin": longOrigin },
  });

  const res = await worker.fetch(
    req,
    { ALLOWED_ORIGINS: "https://*.example.com" },
    {}
  );

  // The response should not include Access-Control-Allow-Origin for the oversized origin
  assert.equal(res.status, 204);
  assert.equal(res.headers.get("Access-Control-Allow-Origin"), null);
});

