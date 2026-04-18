/**
 * CSRF guard — accepts requests only when the Origin (or Referer fallback)
 * matches a trusted origin from `@corates/workers/config/origins`. Read-only
 * methods are skipped. Returns the Hono-shape error response (`AUTH_FORBIDDEN`
 * with `details.reason`) so existing client error handling keeps working.
 */
import { isOriginAllowed } from '@corates/workers/config/origins';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

export type TrustedOriginResult = { ok: true } | { ok: false; response: Response };

export interface TrustedOriginOptions {
  isProduction?: boolean;
}

export function requireTrustedOrigin(
  request: Request,
  options: TrustedOriginOptions = {},
): TrustedOriginResult {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return { ok: true };
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  let requestOrigin = origin;
  if (!requestOrigin && referer) {
    try {
      requestOrigin = new URL(referer).origin;
    } catch {
      // ignore parse errors
    }
  }

  const path = (() => {
    try {
      return new URL(request.url).pathname;
    } catch {
      return request.url;
    }
  })();

  if (!requestOrigin) {
    if (!options.isProduction) {
      console.log('[CSRF] Blocked request with no Origin/Referer', { method, path });
    }
    return {
      ok: false,
      response: Response.json(createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'missing_origin' }), {
        status: 403,
      }),
    };
  }

  if (!isOriginAllowed(requestOrigin)) {
    if (!options.isProduction) {
      console.log('[CSRF] Blocked untrusted origin', { method, path, origin: requestOrigin });
    }
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, {
          reason: 'untrusted_origin',
          origin: requestOrigin,
        }),
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
