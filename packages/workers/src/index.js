/**
 * Corates Workers API - Main Entry Point
 *
 * This is the main router that delegates to specific route handlers.
 */

import { UserSession } from './durable-objects/UserSession.js';
import { ProjectDoc } from './durable-objects/ProjectDoc.js';
import { EmailQueue } from './durable-objects/EmailQueue.js';
import { handleAuthRoutes } from './auth/routes.js';
import { requireAuth } from './auth/config.js';
import {
  getCorsHeaders,
  handlePreflight,
  wrapWithCors,
  jsonResponse,
  errorResponse,
  setAllowedOrigins,
} from './middleware/cors.js';
import { handleProjects } from './routes/projects.js';
import { handleMembers } from './routes/members.js';
import { handleUsers } from './routes/users.js';
import { handleDatabase } from './routes/database.js';
import { handleEmailQueue } from './routes/email-queue.js';
import { uploadPdf, downloadPdf, deletePdf, listPdfs } from './routes/pdfs.js';

// Export Durable Objects
export { UserSession, ProjectDoc, EmailQueue };

export default {
  async fetch(request, env, ctx) {
    // Set allowed origins from environment
    if (env.ALLOWED_ORIGINS) {
      setAllowedOrigins(env.ALLOWED_ORIGINS.split(','));
    }
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handlePreflight(request);
    }

    try {
      // Auth routes (handled by better-auth)
      if (path.startsWith('/api/auth/')) {
        return await handleAuthRoutes(request, env, ctx, path);
      }

      // Email queue endpoint - forward to Durable Object
      if (path === '/api/email/queue' && request.method === 'POST') {
        return await handleEmailQueue(request, env);
      }

      // API Routes
      if (path.startsWith('/api/')) {
        return await handleAPI(request, env, path);
      }

      // Health check
      if (path === '/health') {
        const corsHeaders = getCorsHeaders(request);
        return new Response('OK', {
          headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
        });
      }

      // Default response
      const corsHeaders = getCorsHeaders(request);
      return new Response('Corates Workers API', {
        headers: { ...corsHeaders, 'Content-Type': 'text/plain' },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return errorResponse('Internal Server Error', 500, request);
    }
  },
};

/**
 * Main API router
 */
async function handleAPI(request, env, path) {
  // Project document endpoints (Durable Object - real-time sync)
  if (path.startsWith('/api/project/')) {
    return await handleProjectDoc(request, env, path);
  }

  // User session endpoints (Durable Object)
  if (path.startsWith('/api/sessions/')) {
    return await handleUserSession(request, env, path);
  }

  // Database operations
  if (path.startsWith('/api/db/')) {
    return await handleDatabaseRoutes(request, env, path);
  }

  // Project members management: /api/projects/:id/members
  if (path.match(/^\/api\/projects\/[^/]+\/members/)) {
    return await handleMembers(request, env, path);
  }

  // PDF routes: /api/projects/:id/studies/:studyId/pdf(s)
  if (path.match(/^\/api\/projects\/[^/]+\/studies\/[^/]+\/pdfs?/)) {
    return await handlePdfRoutes(request, env, path);
  }

  // Project CRUD: /api/projects or /api/projects/:id
  if (path.match(/^\/api\/projects(\/[^/]+)?$/)) {
    return await handleProjects(request, env, path);
  }

  // User endpoints: /api/users/:id/...
  if (path.startsWith('/api/users/')) {
    return await handleUsers(request, env, path);
  }

  return errorResponse('Not Found', 404, request);
}

/**
 * Handle ProjectDoc Durable Object requests
 */
async function handleProjectDoc(request, env, path) {
  const projectId = path.split('/')[3];

  if (!projectId) {
    return errorResponse('Project ID required', 400, request);
  }

  const id = env.PROJECT_DOC.idFromName(projectId);
  const projectDoc = env.PROJECT_DOC.get(id);
  const response = await projectDoc.fetch(request);

  return wrapWithCors(response, request);
}

/**
 * Handle UserSession Durable Object requests
 */
async function handleUserSession(request, env, path) {
  const sessionId = path.split('/')[3];

  if (!sessionId) {
    return errorResponse('Session ID required', 400, request);
  }

  const id = env.USER_SESSION.idFromName(sessionId);
  const session = env.USER_SESSION.get(id);
  const response = await session.fetch(request);

  return wrapWithCors(response, request);
}

/**
 * Handle database routes with auth
 */
async function handleDatabaseRoutes(request, env, path) {
  // Public migration endpoint (for development)
  if (path === '/api/db/migrate' && request.method === 'POST') {
    return await handleDatabase(request, env, path);
  }

  // Other DB operations require auth
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) {
    return authResult;
  }

  return await handleDatabase(request, env, path, authResult.user);
}

/**
 * Handle PDF routes
 */
async function handlePdfRoutes(request, env, path) {
  // List PDFs: GET /api/projects/:id/studies/:studyId/pdfs
  if (path.endsWith('/pdfs') && request.method === 'GET') {
    const response = await listPdfs(request, env);
    return wrapWithCors(response, request);
  }

  // Upload PDF: POST /api/projects/:id/studies/:studyId/pdf
  if (path.endsWith('/pdf') && request.method === 'POST') {
    const response = await uploadPdf(request, env);
    return wrapWithCors(response, request);
  }

  // Download PDF: GET /api/projects/:id/studies/:studyId/pdf/:fileName
  if (path.match(/\/pdf\/[^/]+$/) && request.method === 'GET') {
    const response = await downloadPdf(request, env);
    return wrapWithCors(response, request);
  }

  // Delete PDF: DELETE /api/projects/:id/studies/:studyId/pdf/:fileName
  if (path.match(/\/pdf\/[^/]+$/) && request.method === 'DELETE') {
    const response = await deletePdf(request, env);
    return wrapWithCors(response, request);
  }

  return errorResponse('Not Found', 404, request);
}
