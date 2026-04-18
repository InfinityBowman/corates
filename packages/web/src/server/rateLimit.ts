// Framework-agnostic, in-memory rate limiter for TanStack Start server routes.
// Skipped entirely outside production — same behavior as the Hono version this
// replaces. In-memory state is per-isolate, so this is a best-effort brake, not
// a global guarantee. Good enough for spam-throttling public endpoints.

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitRecord>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanupExpiredEntries(): void {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) rateLimitStore.delete(key);
  }
}

function getClientIdentifier(request: Request): string {
  const h = request.headers;
  return (
    h.get('CF-Connecting-IP') ||
    h.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
    h.get('X-Real-IP') ||
    'unknown'
  );
}

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix: string;
}

export interface RateLimitEnv {
  ENVIRONMENT?: string;
}

export interface RateLimitResult {
  blocked: Response | null;
  headers: Record<string, string>;
}

export function checkRateLimit(
  request: Request,
  env: RateLimitEnv,
  options: RateLimitOptions,
  identifierOverride?: string,
): RateLimitResult {
  if (env?.ENVIRONMENT !== 'production') {
    return { blocked: null, headers: {} };
  }

  cleanupExpiredEntries();

  const identifier = identifierOverride ?? getClientIdentifier(request);
  const key = `${options.keyPrefix}:${identifier}`;
  const now = Date.now();
  let record = rateLimitStore.get(key);

  if (!record || record.resetAt < now) {
    record = { count: 0, resetAt: now + options.windowMs };
  }

  if (record.count >= options.limit) {
    const retryAfter = Math.ceil((record.resetAt - now) / 1000);
    return {
      blocked: Response.json(
        { error: 'Too many requests', retryAfter },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(options.limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
          },
        },
      ),
      headers: {},
    };
  }

  record.count++;
  rateLimitStore.set(key, record);

  return {
    blocked: null,
    headers: {
      'X-RateLimit-Limit': String(options.limit),
      'X-RateLimit-Remaining': String(Math.max(0, options.limit - record.count)),
      'X-RateLimit-Reset': String(Math.ceil(record.resetAt / 1000)),
    },
  };
}

export const CONTACT_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'contact',
};

export const SEARCH_RATE_LIMIT: RateLimitOptions = {
  limit: 30,
  windowMs: 60 * 1000,
  keyPrefix: 'search',
};

export const MERGE_INITIATE_RATE_LIMIT: RateLimitOptions = {
  limit: 3,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'merge-initiate',
};

export const MERGE_VERIFY_RATE_LIMIT: RateLimitOptions = {
  limit: 5,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'merge-verify',
};

export const BILLING_PORTAL_RATE_LIMIT: RateLimitOptions = {
  limit: 20,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'billing-portal',
};

export const BILLING_CHECKOUT_RATE_LIMIT: RateLimitOptions = {
  limit: 10,
  windowMs: 15 * 60 * 1000,
  keyPrefix: 'billing-checkout',
};
