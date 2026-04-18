/**
 * Org-scoped project member routes — migrated to TanStack Start at
 * packages/web/src/routes/api/orgs/$orgId/projects/$projectId/members/*.
 * This file stubs out an empty router so the top-level mount still compiles.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const orgProjectMemberRoutes = $(base.use('*', requireAuth));

export { orgProjectMemberRoutes };
