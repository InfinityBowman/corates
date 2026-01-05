/**
 * Rate limiting middleware for Hono
 * Uses in-memory storage with sliding window algorithm
 * Note: This is per-worker instance. For distributed rate limiting,
 * consider using Durable Objects or KV storage.
 */

// In-memory store for rate limit tracking
// Key: identifier (IP or user ID), Value: { count, resetAt }
const rateLimitStore = new Map();

// Clean up expired entries periodically
const CLEANUP_INTERVAL = 60000; // 1 minute
let lastCleanup = Date.now();

function cleanupExpiredEntries() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;

  lastCleanup = now;
  for (const [key, value] of rateLimitStore.entries()) {
    if (value.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}

/**
 * Get client identifier from request
 * Uses CF-Connecting-IP header (Cloudflare), falls back to X-Forwarded-For
 */
function getClientIdentifier(c) {
  return (
    c.req.header('CF-Connecting-IP') ||
    c.req.header('X-Forwarded-For')?.split(',')[0]?.trim() ||
    c.req.header('X-Real-IP') ||
    'unknown'
  );
}

/**
 * Create rate limit middleware
 * @param {Object} options - Rate limit options
 * @param {number} options.limit - Maximum requests allowed in window
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {string} [options.keyPrefix] - Optional prefix for the rate limit key
 * @param {Function} [options.keyGenerator] - Custom key generator function(c) => string
 * @param {boolean} [options.skipFailedRequests] - Don't count failed requests (4xx/5xx)
 * @returns {Function} Hono middleware
 */
export function rateLimit(options = {}) {
  const {
    limit = 100,
    windowMs = 60000, // 1 minute default
    keyPrefix = '',
    keyGenerator = null,
    skipFailedRequests = false,
  } = options;

  return async (c, next) => {
    // Skip rate limiting in development mode
    if (c.env?.ENVIRONMENT !== 'production') {
      await next();
      return;
    }

    cleanupExpiredEntries();

    // Generate rate limit key
    const identifier = keyGenerator ? keyGenerator(c) : getClientIdentifier(c);
    const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier;

    const now = Date.now();
    let record = rateLimitStore.get(key);

    // Initialize or reset if window expired
    if (!record || record.resetAt < now) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      };
    }

    // Check if limit exceeded
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

    // Increment count before processing request
    record.count++;
    rateLimitStore.set(key, record);

    // Add rate limit headers
    c.header('X-RateLimit-Limit', String(limit));
    c.header('X-RateLimit-Remaining', String(Math.max(0, limit - record.count)));
    c.header('X-RateLimit-Reset', String(Math.ceil(record.resetAt / 1000)));

    await next();

    // Decrement count for failed requests
    if (skipFailedRequests && c.res.status >= 400) {
      record.count = Math.max(0, record.count - 1);
      rateLimitStore.set(key, record);
    }
  };
}

/**
 * Pre-configured rate limiters for common use cases
 */

// Strict rate limit for sensitive auth endpoints (login, register, password reset)
export const authRateLimit = rateLimit({
  limit: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'auth',
  skipFailedRequests: true, // Don't count failed auth attempts against limit
});

// Lenient rate limit for session checks (called frequently by better-auth)
export const sessionRateLimit = rateLimit({
  limit: 200,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'session',
});

// Rate limit for email sending
export const emailRateLimit = rateLimit({
  limit: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
  keyPrefix: 'email',
});

// Rate limit for user search (prevent enumeration)
export const searchRateLimit = rateLimit({
  limit: 30,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'search',
});

// Rate limit for contact form (stricter to prevent spam)
export const contactRateLimit = rateLimit({
  limit: 5,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'contact',
});

// General API rate limit
export const apiRateLimit = rateLimit({
  limit: 100,
  windowMs: 60 * 1000, // 1 minute
  keyPrefix: 'api',
});

// Rate limit for billing checkout endpoints (prevent checkout spam)
export const billingCheckoutRateLimit = rateLimit({
  limit: 10,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'billing-checkout',
});

// Rate limit for billing portal access
export const billingPortalRateLimit = rateLimit({
  limit: 20,
  windowMs: 15 * 60 * 1000, // 15 minutes
  keyPrefix: 'billing-portal',
});

/**
 * Clear the rate limit store (for testing only)
 * @internal
 */
export function clearRateLimitStore() {
  // Only allow clearing in test environment
  const isTest =
    (typeof process !== 'undefined' && process.env.NODE_ENV === 'test') ||
    (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test');

  if (isTest) {
    rateLimitStore.clear();
  } else {
    console.warn('Attempted to clear rate limit store outside of test environment');
  }
}
