import type { Context, MiddlewareHandler } from 'hono';

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const CLEANUP_INTERVAL = 60000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

function getClientIdentifier(c: Context): string {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    'unknown'
  );
}

export interface RateLimitOptions {
  limit?: number;
  windowMs?: number;
  keyPrefix?: string;
  keyGenerator?: (_c: Context) => string;
  skipFailedRequests?: boolean;
}

export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const {
    limit = 100,
    windowMs = 60000,
    keyPrefix = '',
    keyGenerator = null,
    skipFailedRequests = false,
  } = options;

  return async (c, next) => {
    if (c.env?.ENVIRONMENT !== 'production') {
      await next();
      return;
    }

    cleanupExpiredEntries();

    const identifier = keyGenerator ? keyGenerator(c) : getClientIdentifier(c);
    const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier;

    const now = Date.now();
    let record = rateLimitStore.get(key);

    if (!record || record.resetAt < now) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    if (record.count >= limit) {
      const retryAfter = Math.ceil((record.resetAt - now) / 1000);

      return c.json(
        {
          error: 'Too many requests',
          retryAfter,
        },
        429,
        {
          'Retry-After': String(retryAfter),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
        },
      );
    }

    record.count++;
    rateLimitStore.set(key, record);

    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - record.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    await next();

    if (skipFailedRequests && c.res.status >= 400) {
      record.count = Math.max(0, record.count - 1);
      rateLimitStore.set(key, record);
    }
  };
}

export const authRateLimit = rateLimit({
  limit: 20,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'auth',
  skipFailedRequests: true,
});

export const sessionRateLimit = rateLimit({
  limit: 200,
  windowMs: 60 * 1000,
  keyPrefix: 'session',
});

export const emailRateLimit = rateLimit({
  limit: 5,
  windowMs: 60 * 60 * 1000,
  keyPrefix: 'email',
});

export const searchRateLimit = rateLimit({
  limit: 30,
  windowMs: 60 * 1000,
  keyPrefix: 'search',
});

export const contactRateLimit = rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'contact',
});

export const apiRateLimit = rateLimit({
  limit: 100,
  windowMs: 60 * 1000,
  keyPrefix: 'api',
});

export const billingCheckoutRateLimit = rateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'billing-checkout',
});

export const billingPortalRateLimit = rateLimit({
  limit: 20,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'billing-portal',
});

export function clearRateLimitStore(): void {
  const isTest =
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' &&
      (import.meta as { env?: { MODE?: string } }).env?.MODE === 'test');

  if (isTest) {
    rateLimitStore.clear();
  } else {
    console.warn('Attempted to clear rate limit store outside of test environment');
  }
}
