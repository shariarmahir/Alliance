import "server-only";

// Fixed-window rate limiter held in module memory.
//
// Scope and limits, stated plainly: serverless instances don't share memory,
// so a request landing on a cold instance starts with a fresh counter. This
// is therefore a speed bump, not a guarantee — it stops casual form spam and
// slows password guessing by orders of magnitude, but a determined attacker
// spreading load across instances can still get through. Upgrading to a
// shared store (@upstash/ratelimit on Redis) is a drop-in replacement for
// checkRateLimit and the only way to make this airtight; it needs an external
// service, so it's deliberately not a launch dependency.

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// Bounds memory on a long-lived instance: without this, every unique key ever
// seen would be retained for the life of the process.
const MAX_KEYS = 10_000;

function sweep(now: number) {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  // Still oversized after dropping expired entries — the map is under active
  // abuse, so drop oldest-first rather than growing without bound.
  if (buckets.size > MAX_KEYS) {
    const excess = buckets.size - MAX_KEYS;
    let dropped = 0;
    for (const key of buckets.keys()) {
      buckets.delete(key);
      if (++dropped >= excess) break;
    }
  }
}

export type RateLimitResult = { ok: boolean; remaining: number; retryAfterSeconds: number };

export function checkRateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number }
): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_KEYS) sweep(now);

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  existing.count++;
  if (existing.count > limit) {
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }
  return { ok: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

// Best-effort client identity. x-forwarded-for is set by Vercel's proxy and
// can be spoofed when the app is reached directly, which is another reason
// this is a speed bump rather than a control.
export function clientKey(request: Request, prefix: string): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  return `${prefix}:${ip}`;
}

// Shared 429 response so every throttled route answers identically.
export function tooManyRequests(retryAfterSeconds: number): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please wait a moment and try again." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfterSeconds),
      },
    }
  );
}
