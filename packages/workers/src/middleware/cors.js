/**
 * Hono CORS middleware configuration
 */

import { cors } from 'hono/cors';
import { isOriginAllowed, STATIC_ORIGINS } from '../config/origins.js';

/**
 * Create CORS middleware for Hono
 * @param {Object} env - Environment object
 * @returns {Function} Hono middleware
 */
export function createCorsMiddleware(env) {
  const corsHandler = cors({
    origin: origin => {
      if (isOriginAllowed(origin, env)) {
        return origin;
      }
      // Fallback to first static origin
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
    maxAge: 86400, // Cache preflight for 24 hours
  });

  // Wrap CORS handler to skip WebSocket upgrade requests
  return async (c, next) => {
    // Skip CORS for WebSocket upgrade requests - they need special handling
    // Use raw headers to match how Durable Objects check for upgrades
    const upgradeHeader = c.req.raw.headers.get('Upgrade');
    if (upgradeHeader === 'websocket') {
      return next();
    }
    return corsHandler(c, next);
  };
}
