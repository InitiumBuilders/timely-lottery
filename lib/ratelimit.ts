/**
 * ─── lib/ratelimit.ts ─ Simple In-Memory Rate Limiter ────────────────────────
 *
 * Protects auth endpoints from brute force attacks.
 * Uses a sliding window per IP address.
 *
 * Usage:
 *   const result = rateLimit(ip, 'login', { max: 5, windowMs: 60_000 });
 *   if (!result.ok) return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (entry.resetAt < now) store.delete(key);
  });
}, 5 * 60 * 1000);

interface RateLimitOptions {
  max: number;       // max requests
  windowMs: number;  // time window in ms
}

export function rateLimit(
  ip: string,
  action: string,
  options: RateLimitOptions = { max: 10, windowMs: 60_000 }
): { ok: boolean; remaining: number; resetAt: number } {
  const key = `${action}:${ip}`;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    // Fresh window
    store.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true, remaining: options.max - 1, resetAt: now + options.windowMs };
  }

  entry.count++;
  if (entry.count > options.max) {
    return { ok: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { ok: true, remaining: options.max - entry.count, resetAt: entry.resetAt };
}

// Preset limiters
export const loginLimiter    = (ip: string) => rateLimit(ip, 'login',    { max: 5,  windowMs: 15 * 60 * 1000 }); // 5/15min
export const registerLimiter = (ip: string) => rateLimit(ip, 'register', { max: 3,  windowMs: 60 * 60 * 1000 }); // 3/hr
export const apiLimiter      = (ip: string) => rateLimit(ip, 'api',      { max: 60, windowMs: 60 * 1000 });       // 60/min
