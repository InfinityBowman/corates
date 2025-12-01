/**
 * CORS middleware utilities
 */

import { getAccessControlOrigin } from '../config/origins.js';

/**
 * Get CORS headers for a request
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment object
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(request, env) {
  const requestOrigin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin': getAccessControlOrigin(requestOrigin, env),
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Authorization, X-File-Name, X-Requested-With, Accept, Origin, User-Agent',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
  };
}

/**
 * Create a JSON response with CORS headers
 * @param {Object} data - Response data
 * @param {Object} options - Response options (status, headers)
 * @param {Request} request - The incoming request (for CORS origin)
 * @param {Object} env - Environment object (optional)
 * @returns {Response}
 */
export function jsonResponse(data, options = {}, request, env) {
  const { status = 200, headers = {} } = options;
  const corsHeaders = request ? getCorsHeaders(request, env) : {};

  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

/**
 * Create an error response with CORS headers
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {Request} request - The incoming request (for CORS origin)
 * @param {Object} env - Environment object (optional)
 * @returns {Response}
 */
export function errorResponse(message, status, request, env) {
  return jsonResponse({ error: message }, { status }, request, env);
}

/**
 * Wrap a Durable Object response with CORS headers
 * @param {Response} response - The DO response
 * @param {Request} request - The incoming request (for CORS origin)
 * @param {Object} env - Environment object (optional)
 * @returns {Response}
 */
export function wrapWithCors(response, request, env) {
  // Don't wrap WebSocket upgrade responses
  if (response.status === 101) {
    return response;
  }

  const corsHeaders = getCorsHeaders(request, env);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      ...corsHeaders,
    },
  });
}

/**
 * Handle CORS preflight request
 * @param {Request} request - The incoming request
 * @param {Object} env - Environment object (optional)
 * @returns {Response}
 */
export function handlePreflight(request, env) {
  // Safari prefers explicit 200 status for preflight
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request, env),
  });
}
