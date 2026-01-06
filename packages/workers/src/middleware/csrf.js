/**
 * CSRF guard for cookie-authenticated routes.
 *
 * We rely on Origin/Referer allow-listing to prevent cross-site requests
 * from being accepted when cookies are sent (SameSite=None scenarios).
 */

import { isOriginAllowed } from '../config/origins.js';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Middleware that blocks state-changing requests unless Origin/Referer is trusted.
 * Allows GET/HEAD/OPTIONS without checks.
 */
export function requireTrustedOrigin(c, next) {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return next();
  }

  const origin = c.req.raw.headers.get('origin');
  const referer = c.req.raw.headers.get('referer');

  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      // Ignore parse errors; handled below.
    }
  }

  if (!requestOrigin) {
    if (c.env?.ENVIRONMENT !== 'production') {
      console.log('[CSRF] Blocked request with no Origin/Referer', {
        method,
        path: new URL(c.req.url).pathname,
      });
    }
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'missing_origin' });
    return c.json(error, error.statusCode);
  }

  if (!isOriginAllowed(requestOrigin, c.env)) {
    if (c.env?.ENVIRONMENT !== 'production') {
      console.log('[CSRF] Blocked untrusted origin', {
        method,
        path: new URL(c.req.url).pathname,
        origin: requestOrigin,
      });
    }
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'untrusted_origin',
      origin: requestOrigin,
    });
    return c.json(error, error.statusCode);
  }

  return next();
}
