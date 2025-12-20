/**
 * Corates Workers API - Main Entry Point (Hono)
 *
 * This is the main Hono application that routes to specific handlers.
 */

import { Hono } from 'hono';
import { UserSession } from './durable-objects/UserSession.js';
import { ProjectDoc } from './durable-objects/ProjectDoc.js';
import { EmailQueue } from './durable-objects/EmailQueue.js';
import { createCorsMiddleware } from './middleware/cors.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { requireAuth } from './middleware/auth.js';
import { requireTrustedOrigin } from './middleware/csrf.js';

// Route imports
import { auth } from './auth/routes.js';
import { projectRoutes } from './routes/projects.js';
import { memberRoutes } from './routes/members.js';
import { userRoutes } from './routes/users.js';
import { pdfRoutes } from './routes/pdfs.js';
import { dbRoutes } from './routes/database.js';
import { emailRoutes } from './routes/email.js';
import { billingRoutes } from './routes/billing/index.js';
import { googleDriveRoutes } from './routes/google-drive.js';
import { avatarRoutes } from './routes/avatars.js';
import { adminRoutes } from './routes/admin.js';
import { accountMergeRoutes } from './routes/account-merge.js';
import { contactRoutes } from './routes/contact.js';

// Export Durable Objects
export { UserSession, ProjectDoc, EmailQueue };

// Create main Hono app
const app = new Hono();

// Apply CORS middleware globally (needs env, so we do it per-request)
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

// Apply security headers to all responses
app.use('*', securityHeaders());

// Health check with dependency checks
app.get('/health', async c => {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {},
  };

  // Check D1 database
  try {
    const result = await c.env.DB.prepare('SELECT 1 as ok').first();
    checks.services.database = {
      status: result?.ok === 1 ? 'healthy' : 'unhealthy',
      type: 'D1',
    };
  } catch (error) {
    checks.services.database = {
      status: 'unhealthy',
      type: 'D1',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  // Check R2 bucket
  try {
    // List with limit 1 is a lightweight way to check connectivity
    await c.env.PDF_BUCKET.list({ limit: 1 });
    checks.services.storage = {
      status: 'healthy',
      type: 'R2',
    };
  } catch (error) {
    checks.services.storage = {
      status: 'unhealthy',
      type: 'R2',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  // Check Durable Objects are available
  try {
    // Just verify bindings exist
    checks.services.durableObjects = {
      status:
        c.env.USER_SESSION && c.env.PROJECT_DOC && c.env.EMAIL_QUEUE ? 'healthy' : 'unhealthy',
      type: 'Durable Objects',
      bindings: {
        USER_SESSION: !!c.env.USER_SESSION,
        PROJECT_DOC: !!c.env.PROJECT_DOC,
        EMAIL_QUEUE: !!c.env.EMAIL_QUEUE,
      },
    };
  } catch (error) {
    checks.services.durableObjects = {
      status: 'unhealthy',
      type: 'Durable Objects',
      error: error.message,
    };
    checks.status = 'degraded';
  }

  const httpStatus = checks.status === 'healthy' ? 200 : 503;
  return c.json(checks, httpStatus);
});

// Simple liveness probe (for load balancers)
app.get('/healthz', c => c.text('OK'));

// Root endpoint
app.get('/', c => c.text('Corates Workers API'));

// API Documentation (development only)
app.get('/docs', async c => {
  if (c.env.ENVIRONMENT === 'production') return c.text('Not Found', 404);
  const { getDocsHtml } = await import('./docs.js');
  return c.html(await getDocsHtml(c.env));
});

// Mount auth routes
app.route('/api/auth', auth);

// CSRF guard for stop-impersonation (cookie-authenticated POST)
app.use('/api/admin/stop-impersonation', requireTrustedOrigin);

// Stop impersonation route - separate from admin routes as it doesn't require admin role
// (the impersonated user won't have admin role)
app.post('/api/admin/stop-impersonation', async c => {
  try {
    const { createAuth } = await import('./auth/config.js');
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

// Mount project routes (must be before members to avoid conflicts)
app.route('/api/projects', projectRoutes);

// Mount project member routes: /api/projects/:projectId/members
app.route('/api/projects/:projectId/members', memberRoutes);

// Mount PDF routes: /api/projects/:projectId/studies/:studyId/pdfs
app.route('/api/projects/:projectId/studies/:studyId/pdfs', pdfRoutes);

// Mount Google Drive routes
app.route('/api/google-drive', googleDriveRoutes);

// PDF proxy endpoint - fetches external PDFs to avoid CORS issues
// Only requires authentication, not project membership
app.post('/api/pdf-proxy', requireAuth, async c => {
  try {
    const { url } = await c.req.json();

    if (!url) {
      return c.json({ error: 'URL is required' }, 400);
    }

    // Validate URL is https and looks like a PDF source
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return c.json({ error: 'Invalid URL protocol' }, 400);
    }

    // Fetch the PDF with manual redirect handling to detect auth loops
    let response;
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

      // Check if it's a redirect
      if ([301, 302, 303, 307, 308].includes(response.status)) {
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

        currentUrl = new URL(location, currentUrl).href;
        redirectCount++;
      } else {
        break;
      }
    }

    if (redirectCount >= maxRedirects) {
      return c.json({ error: 'Too many redirects - PDF may require authentication' }, 502);
    }

    if (!response.ok) {
      return c.json(
        { error: `Failed to fetch PDF: ${response.status} ${response.statusText}` },
        response.status,
      );
    }

    // Check content type
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('pdf') && !contentType.includes('octet-stream')) {
      // Check if we got an HTML page (login page)
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
    return c.json({ error: error.message || 'Failed to fetch PDF' }, 500);
  }
});

// Project Document Durable Object routes
// Handler function shared between both route patterns
const handleProjectDoc = async c => {
  const projectId = c.req.param('projectId');

  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 400);
  }

  const id = c.env.PROJECT_DOC.idFromName(projectId);
  const projectDoc = c.env.PROJECT_DOC.get(id);
  const response = await projectDoc.fetch(c.req.raw);

  // Don't wrap WebSocket upgrade responses
  if (response.status === 101) {
    return response;
  }

  return response;
};

// Route without trailing path (for WebSocket connections from y-websocket)
app.all('/api/project/:projectId', handleProjectDoc);
// Route with trailing path (for any sub-resource requests)
app.all('/api/project/:projectId/*', handleProjectDoc);

// User Session Durable Object routes
// Handler function shared between both route patterns
const handleUserSession = async c => {
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
app.notFound(c => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
