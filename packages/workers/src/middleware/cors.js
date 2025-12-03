/**
 * Hono CORS middleware configuration
 */

import { cors } from 'hono/cors';
import { getAllowedOrigins, isOriginAllowed, STATIC_ORIGINS } from '../config/origins.js';

/**
 * Create CORS middleware for Hono
 * @param {Object} env - Environment object
 * @returns {Function} Hono middleware
 */
export function createCorsMiddleware(env) {
  return cors({
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
}
