/**
 * Dev-only routes that proxy to the ProjectDoc Durable Object
 * Only available when DEV_MODE is enabled
 *
 * These routes are kept in a separate file for organization.
 * Each route checks DEV_MODE at runtime.
 */

import { Hono } from 'hono';
import {
  requireOrgMembership,
  requireProjectAccess,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { getProjectDocStub } from '@/lib/project-doc-id.js';

const devRoutes = new Hono();

// Middleware to check DEV_MODE for all dev routes
devRoutes.use('*', async (c, next) => {
  if (!c.env.DEV_MODE) {
    return c.json({ error: 'Dev endpoints disabled' }, 403);
  }
  await next();
});

// Middleware to set org context - required before requireProjectAccess
devRoutes.use('*', requireOrgMembership());

// GET /dev/templates
devRoutes.get('/templates', requireProjectAccess(), async c => {
  const { projectId } = getProjectContext(c);

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/templates', {
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('[Dev] Failed to fetch templates:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/apply-template
devRoutes.post('/apply-template', requireProjectAccess(), async c => {
  const { projectId } = getProjectContext(c);
  const template = c.req.query('template');
  const mode = c.req.query('mode') || 'replace';

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request(`https://internal/dev/apply-template?template=${template}&mode=${mode}`, {
        method: 'POST',
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('[Dev] Failed to apply template:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /dev/export
devRoutes.get('/export', requireProjectAccess(), async c => {
  const { projectId } = getProjectContext(c);

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/export', {
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('[Dev] Failed to export state:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/import
devRoutes.post('/import', requireProjectAccess(), async c => {
  const { projectId, orgId } = getProjectContext(c);
  const user = c.get('user');

  try {
    const body = await c.req.json();
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true',
        },
        // Pass correct orgId and importer info to ensure they're added as member
        body: JSON.stringify({
          ...body,
          targetOrgId: orgId,
          importer: {
            userId: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
          },
        }),
      }),
    );
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('[Dev] Failed to import state:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/reset
devRoutes.post('/reset', requireProjectAccess(), async c => {
  const { projectId } = getProjectContext(c);

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/reset', {
        method: 'POST',
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status);
  } catch (error) {
    console.error('[Dev] Failed to reset state:', error);
    return c.json({ error: error.message }, 500);
  }
});

export { devRoutes };
