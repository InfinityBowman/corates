/**
 * CORS middleware utilities
 */

export let allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:8787',
  'https://corates.org',
  'https://www.corates.org',
  'https://app.corates.org',
];

/**
 * Set allowed origins dynamically
 * @param {string[]} origins - Array of allowed origin URLs
 */
export function setAllowedOrigins(origins) {
  allowedOrigins = origins;
}

/**
 * Get CORS headers for a request
 * @param {Request} request - The incoming request
 * @returns {Object} CORS headers object
 */
export function getCorsHeaders(request) {
  const requestOrigin = request.headers.get('Origin');
  return {
    'Access-Control-Allow-Origin':
      allowedOrigins.includes(requestOrigin) ? requestOrigin : allowedOrigins[0],
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
 * @returns {Response}
 */
export function jsonResponse(data, options = {}, request) {
  const { status = 200, headers = {} } = options;
  const corsHeaders = request ? getCorsHeaders(request) : {};

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
 * @returns {Response}
 */
export function errorResponse(message, status, request) {
  return jsonResponse({ error: message }, { status }, request);
}

/**
 * Wrap a Durable Object response with CORS headers
 * @param {Response} response - The DO response
 * @param {Request} request - The incoming request (for CORS origin)
 * @returns {Response}
 */
export function wrapWithCors(response, request) {
  // Don't wrap WebSocket upgrade responses
  if (response.status === 101) {
    return response;
  }

  const corsHeaders = getCorsHeaders(request);

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
 * @returns {Response}
 */
export function handlePreflight(request) {
  // Safari prefers explicit 200 status for preflight
  return new Response(null, {
    status: 200,
    headers: getCorsHeaders(request),
  });
}
