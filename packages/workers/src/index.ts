/**
 * Corates Workers API - Main Entry Point (Hono)
 *
 * This is the main Hono application that routes to specific handlers.
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { UserSession } from './durable-objects/UserSession';
import { ProjectDoc } from './durable-objects/ProjectDoc';
import { EmailQueue } from './durable-objects/EmailQueue';
import { createCorsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/securityHeaders';
import { requireAuth } from './middleware/auth';
import { requireTrustedOrigin } from './middleware/csrf';
import { errorHandler } from './middleware/errorHandler';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from './types';

// Route imports
import { auth } from './auth/routes';
import { healthRoutes } from './routes/health';
import { orgRoutes } from './routes/orgs/index';
import { userRoutes } from './routes/users';
import { dbRoutes } from './routes/database';
import { emailRoutes } from './routes/email';
import { billingRoutes } from './routes/billing/index';
import { googleDriveRoutes } from './routes/google-drive';
import { avatarRoutes } from './routes/avatars';
import { adminRoutes } from './routes/admin/index';
import { accountMergeRoutes } from './routes/account-merge';
import { contactRoutes } from './routes/contact';

// Export Durable Objects
export { UserSession, ProjectDoc, EmailQueue };

// Create main Hono app with OpenAPI support
const app = new OpenAPIHono<{ Bindings: Env }>();

// Apply CORS middleware globally (needs env, so we do it per-request)
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

// Apply security headers to all responses
app.use('*', securityHeaders());

// Mount health routes
app.route('/health', healthRoutes);

// Simple liveness probe (for load balancers) - keep at root for backwards compatibility
app.get('/healthz', c => c.text('OK'));

// Root endpoint - redirect browsers to frontend, return text for API clients
app.get('/', c => {
  const accept = c.req.header('Accept') || '';
  // If browser request (accepts HTML), redirect to frontend
  if (accept.includes('text/html')) {
    const frontendUrl = c.env.APP_URL || 'https://corates.org';
    return c.redirect(`${frontendUrl}/dashboard`, 302);
  }
  return c.text('Corates Workers API');
});

// API Documentation (development only)
app.get('/docs', async c => {
  if (c.env.ENVIRONMENT === 'production') return c.text('Not Found', 404);
  const { getDocsHtml } = await import('./docs');
  return c.html(await getDocsHtml(c.env));
});

// OpenAPI JSON spec (development only)
app.doc31('/openapi.json', c => ({
  openapi: '3.1.0',
  info: {
    title: 'Corates API',
    version: '1.0.0',
    description: 'API for Corates - Collaborative Research Appraisal Tool for Evidence Synthesis',
  },
  servers: [
    {
      url: c.env.ENVIRONMENT === 'production' ? 'https://corates.org' : 'http://localhost:8787',
      description: c.env.ENVIRONMENT === 'production' ? 'Production' : 'Local development',
    },
  ],
}));

// Mount auth routes
app.route('/api/auth', auth);

// CSRF guard for stop-impersonation (cookie-authenticated POST)
app.use('/api/admin/stop-impersonation', requireTrustedOrigin);

// Stop impersonation route - separate from admin routes as it doesn't require admin role
// (the impersonated user won't have admin role)
app.post('/api/admin/stop-impersonation', async c => {
  try {
    const { createAuth } = await import('./auth/config');
    const authInstance = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Create a request to Better Auth's stop impersonation endpoint
    const authUrl = new URL('/api/auth/admin/stop-impersonating', url.origin);
    const cookie = c.req.raw.headers.get('cookie');
    const origin = c.req.raw.headers.get('origin');
    const referer = c.req.raw.headers.get('referer');
    const headers = new Headers();
    if (cookie) headers.set('cookie', cookie);
    if (origin) headers.set('origin', origin);
    if (referer) headers.set('referer', referer);
    headers.set('accept', 'application/json');
    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers,
    });

    // Let Better Auth handle the request (this properly sets cookies)
    const response = await authInstance.handler(authRequest);
    return response;
  } catch (error) {
    console.error('Error stopping impersonation:', error);
    return c.json({ error: 'Failed to stop impersonation' }, 500);
  }
});

// Mount admin routes
app.route('/api/admin', adminRoutes);

// Mount email routes
app.route('/api/email', emailRoutes);

// Mount contact form route (public)
app.route('/api/contact', contactRoutes);

// Mount billing routes
app.route('/api/billing', billingRoutes);

// Mount database routes
app.route('/api/db', dbRoutes);

// Mount user routes
app.route('/api/users', userRoutes);

// Mount avatar routes
app.route('/api/users/avatar', avatarRoutes);

// Mount account merge routes
app.route('/api/accounts/merge', accountMergeRoutes);

// Mount organization routes (all project operations now live under /api/orgs/:orgId/projects/...)
app.route('/api/orgs', orgRoutes);

// Mount Google Drive routes
app.route('/api/google-drive', googleDriveRoutes);

// PDF proxy endpoint - fetches external PDFs to avoid CORS issues
// Only requires authentication, not project membership
app.post('/api/pdf-proxy', requireAuth, async c => {
  try {
    const body = await c.req.json<{ url?: string }>();
    const { url } = body;

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    const { validatePdfProxyUrl } = await import('./lib/ssrf-protection');

    // SSRF protection - validate URL against allowlist
    const validation = validatePdfProxyUrl(url);
    if (!validation.valid) {
      return c.json({ error: validation.error, code: 'SSRF_BLOCKED' }, 400);
    }

    // Fetch the PDF with manual redirect handling to detect auth loops
    let response: Response | undefined;
    let redirectCount = 0;
    const maxRedirects = 5;
    let currentUrl = url;

    while (redirectCount < maxRedirects) {
      response = await fetch(currentUrl, {
        headers: {
          'User-Agent': 'CoRATES/1.0 (Research Tool; mailto:support@corates.app)',
          Accept: 'application/pdf,*/*',
        },
        redirect: 'manual',
      });

      if (![301, 302, 303, 307, 308].includes(response.status)) {
        break;
      }

      const location = response.headers.get('location');
      if (!location) {
        return c.json({ error: 'Redirect without location header' }, 502);
      }

      // Detect auth/login redirects (common patterns)
      if (
        location.includes('/login') ||
        location.includes('/auth') ||
        location.includes('/signin') ||
        location.includes('authorization.oauth2') ||
        location.includes('idp.') ||
        location.includes('/sso/')
      ) {
        return c.json(
          {
            error: 'PDF requires authentication - this article may not be truly open access',
            code: 'AUTH_REQUIRED',
          },
          403,
        );
      }

      const redirectUrl = new URL(location, currentUrl);

      // Validate redirect URL for SSRF protection
      const redirectValidation = validatePdfProxyUrl(redirectUrl.href);
      if (!redirectValidation.valid) {
        return c.json(
          { error: `Redirect blocked: ${redirectValidation.error}`, code: 'SSRF_BLOCKED' },
          400,
        );
      }

      currentUrl = redirectUrl.href;
      redirectCount++;
    }

    if (redirectCount >= maxRedirects) {
      return c.json({ error: 'Too many redirects - PDF may require authentication' }, 502);
    }

    if (!response || !response.ok) {
      return c.json(
        { error: `Failed to fetch PDF: ${response?.status} ${response?.statusText}` },
        (response?.status || 500) as ContentfulStatusCode,
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      if (contentType.includes('html')) {
        return c.json(
          {
            error: 'PDF requires authentication - received login page instead',
            code: 'AUTH_REQUIRED',
          },
          403,
        );
      }
      return c.json({ error: 'URL did not return a PDF' }, 400);
    }

    // Return the PDF data
    const pdfData = await response.arrayBuffer();

    return new Response(pdfData, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfData.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('PDF proxy error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch PDF';
    return c.json({ error: message }, 500);
  }
});

// Project-scoped Project Document Durable Object routes
// DO instance is project-scoped (project:${projectId})
const handleProjectDoc = async (c: Context<{ Bindings: Env }>) => {
  const projectId = c.req.param('projectId');

  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 400);
  }

  // Compute project-scoped DO instance name
  const { getProjectDocStub } = await import('./lib/project-doc-id');
  const projectDoc = getProjectDocStub(c.env, projectId);
  const response = await projectDoc.fetch(c.req.raw);

  // Don't wrap WebSocket upgrade responses
  if (response.status === 101) {
    return response;
  }

  return response;
};

// Project-scoped routes for WebSocket connections (y-websocket appends room as final segment)
app.all('/api/project-doc/:projectId', handleProjectDoc);
app.all('/api/project-doc/:projectId/*', handleProjectDoc);

// Legacy org-scoped routes - return 410 Gone
const legacyOrgProjectDocHandler = (c: Context<{ Bindings: Env }>) =>
  c.json(
    {
      error: 'ENDPOINT_MOVED',
      message: 'This endpoint has been moved. Use /api/project-doc/:projectId instead.',
      statusCode: 410,
    },
    410,
  );
app.all('/api/orgs/:orgId/project-doc/:projectId', legacyOrgProjectDocHandler);
app.all('/api/orgs/:orgId/project-doc/:projectId/*', legacyOrgProjectDocHandler);

// Legacy project WebSocket endpoint - return 410 Gone
const legacyProjectDocHandler = (c: Context<{ Bindings: Env }>) =>
  c.json(
    {
      error: 'ENDPOINT_MOVED',
      message: 'This endpoint has been moved. Use /api/orgs/:orgId/project-doc/:projectId instead.',
      statusCode: 410,
    },
    410,
  );
app.all('/api/project/:projectId', legacyProjectDocHandler);
app.all('/api/project/:projectId/*', legacyProjectDocHandler);

// User Session Durable Object routes
// Handler function shared between both route patterns
const handleUserSession = async (c: Context<{ Bindings: Env }>) => {
  const sessionId = c.req.param('sessionId');

  if (!sessionId) {
    return c.json({ error: 'Session ID required' }, 400);
  }

  const id = c.env.USER_SESSION.idFromName(sessionId);
  const session = c.env.USER_SESSION.get(id);
  const response = await session.fetch(c.req.raw);

  // Don't wrap WebSocket upgrade responses
  if (response.status === 101) {
    return response;
  }

  return response;
};

// Route without trailing path (for WebSocket connections)
app.all('/api/sessions/:sessionId', handleUserSession);
// Route with trailing path (for any sub-resource requests)
app.all('/api/sessions/:sessionId/*', handleUserSession);

// 404 handler
app.notFound(c => {
  const error = createDomainError(SYSTEM_ERRORS.ROUTE_NOT_FOUND, { path: c.req.path });
  return c.json(error, error.statusCode as ContentfulStatusCode);
});

// Global error handler - catches all uncaught errors in routes
app.onError(errorHandler);

export default app;
