/**
 * Org-scoped project invitation routes -- migrated to TanStack Start at
 * packages/web/src/routes/api/orgs/$orgId/projects/$projectId/invitations/*.
 * This file stubs out an empty router so the top-level mount still compiles.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const orgInvitationRoutes = $(base.use('*', requireAuth));

export { orgInvitationRoutes };
