import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { isOriginAllowed, STATIC_ORIGINS } from '../config/origins';
import type { Env } from '../types/env';

export function createCorsMiddleware(env: Env): MiddlewareHandler {
  const corsHandler = cors({
    origin: origin => {
      if (isOriginAllowed(origin, env)) {
        return origin;
      }
      return STATIC_ORIGINS[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Content-Length',
      'Authorization',
      'X-File-Name',
      'X-Requested-With',
      'Accept',
      'Origin',
      'User-Agent',
    ],
    credentials: true,
    maxAge: 86400,
  });

  return async (c, next) => {
    const upgradeHeader = c.req.raw.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      return next();
    }
    return corsHandler(c, next);
  };
}
