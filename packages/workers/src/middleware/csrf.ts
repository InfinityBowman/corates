import type { MiddlewareHandler } from 'hono';
import { isOriginAllowed } from '../config/origins';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export const requireTrustedOrigin: MiddlewareHandler = async (c, next) => {
  const method = c.req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    await next();
    return;
  }

  const origin = c.req.raw.headers.get('origin');
  const referer = c.req.raw.headers.get('referer');

  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      // Ignore parse errors
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
    return c.json(error, error.statusCode as 403);
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
    return c.json(error, error.statusCode as 403);
  }

  await next();
};
