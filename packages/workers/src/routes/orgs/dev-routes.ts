/**
 * Dev-only routes that proxy to the ProjectDoc Durable Object
 * Only available when DEV_MODE is enabled
 *
 * These routes are kept in a separate file for organization.
 * Each route checks DEV_MODE at runtime.
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import {
  requireOrgMembership,
  requireProjectAccess,
  getProjectContext,
  getOrgContext,
} from '@/middleware/requireOrg.js';
import { getAuth } from '@/middleware/auth.js';
import { getProjectDocStub } from '@/lib/project-doc-id.js';
import type { Env } from '../../types';

const devRoutes = new OpenAPIHono<{ Bindings: Env }>();

// Middleware to check DEV_MODE for all dev routes
devRoutes.use('*', async (c, next) => {
  if (!c.env.DEV_MODE) {
    return c.json({ error: 'Dev endpoints disabled' }, 403);
  }
  await next();
});

// Middleware to set org context - required before requireProjectAccess
devRoutes.use('*', requireOrgMembership());

// Apply project access middleware to all dev routes
devRoutes.use('/templates', requireProjectAccess());
devRoutes.use('/apply-template', requireProjectAccess());
devRoutes.use('/export', requireProjectAccess());
devRoutes.use('/import', requireProjectAccess());
devRoutes.use('/reset', requireProjectAccess());

// Response schemas
const DevErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('DevError');

const TemplateSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().optional(),
  })
  .openapi('DevTemplate');

const TemplatesResponseSchema = z
  .object({
    templates: z.array(TemplateSchema),
  })
  .openapi('DevTemplatesResponse');

const ApplyTemplateResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .openapi('DevApplyTemplateResponse');

const ExportResponseSchema = z
  .object({
    state: z.record(z.string(), z.unknown()),
    version: z.string().optional(),
  })
  .openapi('DevExportResponse');

const ImportResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .openapi('DevImportResponse');

const ResetResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
  })
  .openapi('DevResetResponse');

// Route definitions
const getTemplatesRoute = createRoute({
  method: 'get',
  path: '/templates',
  tags: ['Dev'],
  summary: 'List available templates',
  description: 'Get list of available dev templates. Dev mode only.',
  responses: {
    200: {
      description: 'List of templates',
      content: {
        'application/json': {
          schema: TemplatesResponseSchema,
        },
      },
    },
    403: {
      description: 'Dev mode disabled or no access',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
  },
});

const applyTemplateRoute = createRoute({
  method: 'post',
  path: '/apply-template',
  tags: ['Dev'],
  summary: 'Apply a template',
  description: 'Apply a dev template to the project. Dev mode only.',
  request: {
    query: z.object({
      template: z.string().optional().openapi({ description: 'Template ID to apply' }),
      mode: z
        .enum(['replace', 'merge'])
        .optional()
        .openapi({ description: 'Apply mode', example: 'replace' }),
    }),
  },
  responses: {
    200: {
      description: 'Template applied',
      content: {
        'application/json': {
          schema: ApplyTemplateResponseSchema,
        },
      },
    },
    403: {
      description: 'Dev mode disabled or no access',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
  },
});

const exportRoute = createRoute({
  method: 'get',
  path: '/export',
  tags: ['Dev'],
  summary: 'Export project state',
  description: 'Export the current project state. Dev mode only.',
  responses: {
    200: {
      description: 'Exported state',
      content: {
        'application/json': {
          schema: ExportResponseSchema,
        },
      },
    },
    403: {
      description: 'Dev mode disabled or no access',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
  },
});

const importRoute = createRoute({
  method: 'post',
  path: '/import',
  tags: ['Dev'],
  summary: 'Import project state',
  description: 'Import project state from JSON. Dev mode only.',
  responses: {
    200: {
      description: 'State imported',
      content: {
        'application/json': {
          schema: ImportResponseSchema,
        },
      },
    },
    403: {
      description: 'Dev mode disabled or no access',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
  },
});

const resetRoute = createRoute({
  method: 'post',
  path: '/reset',
  tags: ['Dev'],
  summary: 'Reset project state',
  description: 'Reset the project to initial state. Dev mode only.',
  responses: {
    200: {
      description: 'State reset',
      content: {
        'application/json': {
          schema: ResetResponseSchema,
        },
      },
    },
    403: {
      description: 'Dev mode disabled or no access',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
    500: {
      description: 'Internal error',
      content: {
        'application/json': {
          schema: DevErrorSchema,
        },
      },
    },
  },
});

// GET /dev/templates
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
devRoutes.openapi(getTemplatesRoute, async c => {
  const { projectId } = getProjectContext(c);
  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 403);
  }

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/templates', {
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to fetch templates:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/apply-template
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
devRoutes.openapi(applyTemplateRoute, async c => {
  const { projectId } = getProjectContext(c);
  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 403);
  }
  const query = c.req.valid('query');
  const template = query.template;
  const mode = query.mode || 'replace';

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request(`https://internal/dev/apply-template?template=${template}&mode=${mode}`, {
        method: 'POST',
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to apply template:', error);
    return c.json({ error: error.message }, 500);
  }
});

// GET /dev/export
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
devRoutes.openapi(exportRoute, async c => {
  const { projectId } = getProjectContext(c);
  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 403);
  }

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/export', {
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to export state:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/import
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
devRoutes.openapi(importRoute, async c => {
  const { projectId } = getProjectContext(c);
  const { orgId } = getOrgContext(c);
  const { user } = getAuth(c);

  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 403);
  }

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
            userId: user?.id,
            email: user?.email,
            name: user?.name,
            image: user?.image,
          },
        }),
      }),
    );
    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to import state:', error);
    return c.json({ error: error.message }, 500);
  }
});

// POST /dev/reset
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
devRoutes.openapi(resetRoute, async c => {
  const { projectId } = getProjectContext(c);
  if (!projectId) {
    return c.json({ error: 'Project ID required' }, 403);
  }

  try {
    const projectDoc = getProjectDocStub(c.env, projectId);
    const response = await projectDoc.fetch(
      new Request('https://internal/dev/reset', {
        method: 'POST',
        headers: { 'X-Internal-Request': 'true' },
      }),
    );
    const data = await response.json();
    return c.json(data, response.status as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('[Dev] Failed to reset state:', error);
    return c.json({ error: error.message }, 500);
  }
});

export { devRoutes };
