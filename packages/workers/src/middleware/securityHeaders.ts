import type { MiddlewareHandler } from 'hono';

export function securityHeaders(): MiddlewareHandler {
  return async (c, next) => {
    await next();

    if (c.res.status === 101) {
      return;
    }

    try {
      const url = new URL(c.req.url);
      if (url.protocol === 'https:') {
        c.header('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
      }
    } catch {
      // Ignore invalid URLs
    }

    c.header('X-Frame-Options', 'DENY');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-XSS-Protection', '1; mode=block');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()');

    const isHtmlResponse = c.res.headers.get('Content-Type')?.includes('text/html');
    const isDocsPage = c.req.path === '/docs';

    if (isHtmlResponse && isDocsPage && c.env.ENVIRONMENT !== 'production') {
      c.header(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
          "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://fonts.googleapis.com",
          "img-src 'self' data: https:",
          "font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net",
          "connect-src 'self'",
          "frame-ancestors 'none'",
          "base-uri 'self'",
        ].join('; '),
      );
    } else if (isHtmlResponse) {
      c.header(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
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
