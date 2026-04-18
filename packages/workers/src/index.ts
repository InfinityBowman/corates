/**
 * Corates Workers API - Main Entry Point (Hono)
 *
 * This is the main Hono application that routes to specific handlers.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import * as Sentry from '@sentry/cloudflare';
import { UserSession } from './durable-objects/UserSession';
import { ProjectDoc } from './durable-objects/ProjectDoc';
import { createCorsMiddleware } from './middleware/cors';
import { securityHeaders } from './middleware/securityHeaders';
import { errorHandler } from './middleware/errorHandler';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createEmailService } from './auth/email';
import type { EmailPayload } from './lib/email-queue';
import type { Env } from './types';

// Route imports
import { auth } from './auth/routes';
import { healthRoutes } from './routes/health';
import { orgRoutes } from './routes/orgs/index';
import { billingRoutes } from './routes/billing/index';
import { adminRoutes } from './routes/admin/index';

// Export Durable Objects
export { UserSession, ProjectDoc };

// Create main Hono app with OpenAPI support
// Infrastructure routes (middleware, inline handlers) go on base
// API sub-routers are chained on app for RPC type inference
const base = new OpenAPIHono<{ Bindings: Env }>();

// Apply CORS middleware globally
base.use('*', createCorsMiddleware());

// Apply security headers to all responses
base.use('*', securityHeaders());

// Mount health routes
base.route('/health', healthRoutes);

// Root endpoint - redirect browsers to frontend, return text for API clients
base.get('/', c => {
  const accept = c.req.header('Accept') || '';
  // If browser request (accepts HTML), redirect to frontend
  if (accept.includes('text/html')) {
    const frontendUrl = c.env.APP_URL || 'https://corates.org';
    return c.redirect(`${frontendUrl}/dashboard`, 302);
  }
  return c.text('Corates Workers API');
});

// API Documentation (development only)
base.get('/docs', async c => {
  if (c.env.ENVIRONMENT === 'production') return c.text('Not Found', 404);
  const { getDocsHtml } = await import('./docs');
  return c.html(await getDocsHtml(c.env));
});

// OpenAPI JSON spec (development only)
base.get('/openapi.json', c => {
  if (c.env.ENVIRONMENT === 'production') return c.text('Not Found', 404);
  return c.json({
    openapi: '3.1.0',
    info: {
      title: 'Corates API',
      version: '1.0.0',
      description: 'API for Corates - Collaborative Research Appraisal Tool for Evidence Synthesis',
    },
    servers: [
      {
        url: 'http://localhost:8787',
        description: 'Local development',
      },
    ],
  });
});

// Mount auth routes
base.route('/api/auth', auth);

// Chain API sub-routers for RPC type inference
const app = $(base)
  .route('/api/admin', adminRoutes)
  .route('/api/billing', billingRoutes)
  .route('/api/orgs', orgRoutes);

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
base.all('/api/project-doc/:projectId', handleProjectDoc);
base.all('/api/project-doc/:projectId/*', handleProjectDoc);

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
base.all('/api/orgs/:orgId/project-doc/:projectId', legacyOrgProjectDocHandler);
base.all('/api/orgs/:orgId/project-doc/:projectId/*', legacyOrgProjectDocHandler);

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
base.all('/api/project/:projectId', legacyProjectDocHandler);
base.all('/api/project/:projectId/*', legacyProjectDocHandler);

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
base.all('/api/sessions/:sessionId', handleUserSession);
// Route with trailing path (for any sub-resource requests)
base.all('/api/sessions/:sessionId/*', handleUserSession);

// 404 handler
base.notFound(c => {
  const error = createDomainError(SYSTEM_ERRORS.ROUTE_NOT_FOUND, { path: c.req.path });
  return c.json(error, error.statusCode as ContentfulStatusCode);
});

// Global error handler - catches all uncaught errors in routes
base.onError(errorHandler);

const workerHandler = {
  fetch: app.fetch,

  async queue(batch: MessageBatch<any>, env: Env, _ctx?: ExecutionContext): Promise<void> {
    const emailService = createEmailService(env);
    const messages = batch.messages as Message<EmailPayload>[];

    for (const msg of messages) {
      try {
        const result = await emailService.sendEmail(
          msg.body as Parameters<typeof emailService.sendEmail>[0],
        );

        if (result.success) {
          msg.ack();
        } else {
          const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
          console.error(`[EmailQueue] Send returned error for ${masked}:`, result.error);
          const delay = Math.min(30 * 2 ** msg.attempts, 1800);
          msg.retry({ delaySeconds: delay });
        }
      } catch (error) {
        const masked = msg.body.to?.replace(/^(..).*@/, '$1***@');
        console.error(`[EmailQueue] Exception sending to ${masked}:`, error);
        const delay = Math.min(30 * 2 ** msg.attempts, 1800);
        msg.retry({ delaySeconds: delay });
      }
    }
  },
};

// Wrap with Sentry for error monitoring in non-test environments.
// Sentry.withSentry proxies the fetch handler and its transport uses ctx.waitUntil,
// which is unavailable in the vitest-pool-workers test runtime.
// @ts-expect-error import.meta.env is set by vitest but not typed in workers
const isTest = typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test';

export type AppType = typeof app;

// Named exports for cross-package consumption (packages/web mounts this worker
// during the Phase 2 "build alongside" window and in the consolidated state).
export { app, workerHandler };

export default isTest ? workerHandler : (
  Sentry.withSentry(
    (env: Env) => ({
      dsn: env.SENTRY_DSN || '',
      release: env.CF_VERSION_METADATA?.id,
      environment: env.ENVIRONMENT,
      enabled: !!env.SENTRY_DSN,
      tracesSampleRate: env.ENVIRONMENT === 'production' ? 0.1 : 1.0,
      sendDefaultPii: true,
    }),
    workerHandler,
  )
);
