/**
 * Security headers middleware for Hono
 * Adds security-related HTTP headers to all responses
 */

/**
 * Create security headers middleware
 * @returns {Function} Hono middleware
 */
export function securityHeaders() {
  return async (c, next) => {
    await next();

    // Prevent clickjacking attacks
    c.header('X-Frame-Options', 'DENY');

    // Prevent MIME type sniffing
    c.header('X-Content-Type-Options', 'nosniff');

    // XSS protection (legacy, but still useful for older browsers)
    c.header('X-XSS-Protection', '1; mode=block');

    // Referrer policy - don't leak full URLs to external sites
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions policy - restrict browser features
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

    // Content Security Policy
    // Note: This is a baseline policy. Adjust based on your frontend requirements.
    // For API-only responses, this is restrictive. For HTML pages (like email verification),
    // it prevents inline scripts and external resources.
    const isHtmlResponse = c.res.headers.get('Content-Type')?.includes('text/html');
    if (isHtmlResponse) {
      c.header(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'", // Allow inline styles for email templates
          "img-src 'self' data:",
          "font-src 'self'",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
          "form-action 'self'",
        ].join('; '),
      );
    }
  };
}
