/**
 * Organization route wrapper - only mounts the :orgId/projects sub-router.
 * Top-level org CRUD and org member CRUD have been migrated to TanStack Start
 * routes in packages/web/src/routes/api/orgs/*.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { orgProjectRoutes } from './projects.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const orgRoutes = $(base.use('*', requireAuth)).route('/:orgId/projects', orgProjectRoutes);

export { orgRoutes };
