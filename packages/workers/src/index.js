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

// Export Durable Objects
export { UserSession, ProjectDoc, EmailQueue };

// Create main Hono app
const app = new Hono();

// Apply CORS middleware globally (needs env, so we do it per-request)
app.use('*', async (c, next) => {
  const corsMiddleware = createCorsMiddleware(c.env);
  return corsMiddleware(c, next);
});

// Health check
app.get('/health', (c) => c.text('OK'));

// Root endpoint
app.get('/', (c) => c.text('Corates Workers API'));

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

// Project Document Durable Object routes
app.all('/api/project/:projectId/*', async (c) => {
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
app.all('/api/sessions/:sessionId/*', async (c) => {
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
app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// Error handler
app.onError((err, c) => {
  console.error('Worker error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default app;
