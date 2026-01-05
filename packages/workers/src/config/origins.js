/**
 * Centralized origin configuration for CORS and trusted origins.
 * All origin-related logic should reference this file.
 */

/**
 * Static list of always-allowed origins
 */
export const STATIC_ORIGINS = [
  'http://localhost:5173', // Vite dev server
  'http://localhost:8787', // Worker dev server
  'http://localhost:3010', // Landing page dev server
  'https://corates.org',
  'https://www.corates.org',
  'https://app.corates.org',
  'https://api.corates.org',
];

// Patterns for dynamically allowed origins (e.g., preview deploys)
// These are regex patterns that will be tested against the origin.
// Accept any workers.dev preview domain (may contain multiple dot-separated labels
// before the workers.dev zone), e.g. `abc-branch-username.workers.dev` or
// `preview-123.workers.dev`.
export const ORIGIN_PATTERNS = [/^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)*\.workers\.dev$/];

/**
 * Check if an origin matches any of the dynamic patterns
 * @param {string} origin - The origin to check
 * @returns {boolean}
 */
export function matchesOriginPattern(origin) {
  if (!origin) return false;
  return ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}

/**
 * Get all allowed origins, including those from environment
 * @param {Object} env - Environment object with ALLOWED_ORIGINS
 * @returns {string[]}
 */
export function getAllowedOrigins(env = {}) {
  const origins = [...STATIC_ORIGINS];

  // Add origins from environment variable
  if (env.ALLOWED_ORIGINS) {
    const envOrigins = env.ALLOWED_ORIGINS.split(',').map(o => o.trim());
    envOrigins.forEach(origin => {
      if (origin && !origins.includes(origin)) {
        origins.push(origin);
      }
    });
  }

  // Add AUTH_BASE_URL if set
  if (env.AUTH_BASE_URL && !origins.includes(env.AUTH_BASE_URL)) {
    origins.push(env.AUTH_BASE_URL);
  }

  return origins;
}

/**
 * Check if an origin is allowed (static list, env list, or pattern match)
 * @param {string} origin - The origin to check
 * @param {Object} env - Environment object
 * @returns {boolean}
 */
export function isOriginAllowed(origin, env = {}) {
  if (!origin) return false;

  // Check static and env-configured origins
  const allowedOrigins = getAllowedOrigins(env);
  if (allowedOrigins.includes(origin)) {
    return true;
  }

  // Check dynamic patterns (e.g., preview deploys)
  return matchesOriginPattern(origin);
}

/**
 * Get the appropriate Access-Control-Allow-Origin value for a request
 * @param {string} requestOrigin - The Origin header from the request
 * @param {Object} env - Environment object
 * @returns {string} - The origin to allow, or the first static origin as fallback
 */
export function getAccessControlOrigin(requestOrigin, env = {}) {
  if (isOriginAllowed(requestOrigin, env)) {
    return requestOrigin;
  }
  // Fallback to first static origin
  return STATIC_ORIGINS[0];
}
