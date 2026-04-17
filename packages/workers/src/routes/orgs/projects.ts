/**
 * Org-scoped project router wrapper - only mounts sub-routers.
 * Top-level project CRUD has been migrated to TanStack Start routes in
 * packages/web/src/routes/api/orgs/$orgId/projects/*.
 */

import { OpenAPIHono, $ } from '@hono/zod-openapi';
import { requireAuth } from '../../middleware/auth.js';
import { orgProjectMemberRoutes } from './members.js';
import { orgPdfRoutes } from './pdfs.js';
import { orgInvitationRoutes } from './invitations.js';
import { devRoutes } from './dev-routes.js';
import { validationHook } from '../../lib/honoValidationHook.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

const orgProjectRoutes = $(base.use('*', requireAuth))
  .route('/:projectId/members', orgProjectMemberRoutes)
  .route('/:projectId/studies/:studyId/pdfs', orgPdfRoutes)
  .route('/:projectId/invitations', orgInvitationRoutes)
  .route('/:projectId/dev', devRoutes);

export { orgProjectRoutes };
