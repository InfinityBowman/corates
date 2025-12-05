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

// Route imports
import { auth } from './auth/routes.js';
import { projectRoutes } from './routes/projects.js';
import { memberRoutes } from './routes/members.js';
import { userRoutes } from './routes/users.js';
import { pdfRoutes } from './routes/pdfs.js';
import { dbRoutes } from './routes/database.js';
import { emailRoutes } from './routes/email.js';
import { googleDriveRoutes } from './routes/google-drive.js';

// Export Durable Objects
export { UserSession, ProjectDoc, EmailQueue };

// Create main Hono app
const app = new Hono();

// Apply CORS middleware globally (needs env, so we do it per-request)
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

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

// Mount auth routes
app.route('/api/auth', auth);

// Mount email routes
app.route('/api/email', emailRoutes);

// Mount database routes
app.route('/api/db', dbRoutes);

// Mount user routes
app.route('/api/users', userRoutes);

// Mount project routes (must be before members to avoid conflicts)
app.route('/api/projects', projectRoutes);

// Mount project member routes: /api/projects/:projectId/members
app.route('/api/projects/:projectId/members', memberRoutes);

// Mount PDF routes: /api/projects/:projectId/studies/:studyId/pdf(s)
app.route('/api/projects/:projectId/studies/:studyId/pdfs', pdfRoutes);
app.route('/api/projects/:projectId/studies/:studyId/pdf', pdfRoutes);

// Mount Google Drive routes
app.route('/api/google-drive', googleDriveRoutes);

// Project Document Durable Object routes
app.all('/api/project/:projectId/*', async c => {
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
});

// User Session Durable Object routes
app.all('/api/sessions/:sessionId/*', async c => {
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
});

// 404 handler
app.notFound(c => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
