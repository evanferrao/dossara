import { NextRequest } from "next/server";

// Configuration
const MAX_REQUESTS = parseInt(
  process.env.MAX_CHAT_PER_IP_PER_DAY ?? "20",
  10
);


interface RateLimitEntry {
  count: number;
  /** Epoch ms when this window resets (start of next UTC day) */
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

/** Returns the epoch-ms timestamp for the start of the next UTC day. */
function getNextDayResetMs(): number {
  const now = new Date();
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() + 1
  );
}

/**
 * Extract the client IP from the request.
 * Checks `x-forwarded-for` (set by reverse proxies / load balancers) first,
 * then falls back to a generic unknown marker.
 */
function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can be comma-separated; the first entry is the client
    return forwarded.split(",")[0].trim();
  }
  return "unknown";
}

/**
 * Check whether the request is within the rate limit.
 *
 * @returns `null` if allowed, or a `Response` (429) if the limit is exceeded.
 */
export function checkRateLimit(req: NextRequest): Response | null {
  if (MAX_REQUESTS <= 0) {
    // Rate limiting disabled (set to 0 or negative)
    return null;
  }

  const ip = getClientIp(req);
  const now = Date.now();
  let entry = store.get(ip);

  // If the entry's window has expired, reset it
  if (!entry || now >= entry.resetAt) {
    entry = { count: 0, resetAt: getNextDayResetMs() };
    store.set(ip, entry);
  }

  entry.count++;

  if (entry.count > MAX_REQUESTS) {
    const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);
    return new Response(
      JSON.stringify({
        error: "Rate limit exceeded",
        message: `Daily usage limit reached — This demo project allows up to ${MAX_REQUESTS} chat messages per day to manage API costs. The limit resets at midnight UTC. Thank you for checking out the project!`,
        retryAfter: retryAfterSecs,
      }),
      {
        status: 429,
        headers: {
          "Content-Type": "application/json",
          "Retry-After": String(retryAfterSecs),
          "X-RateLimit-Limit": String(MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(entry.resetAt / 1000)),
        },
      }
    );
  }

  return null;
}
