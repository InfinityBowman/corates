import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { workspaceNameSchema, workspaceSlugSchema } from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listMyWorkspaces,
  checkWorkspaceSlug,
  createWorkspaceForUser,
  updateWorkspaceSettings,
  getWorkspaceMembers as fetchWorkspaceMembers,
  removeWorkspaceMember as removeWorkspaceMemberById,
} from './workspaces.server';

export const getMyWorkspaces = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => listMyWorkspaces(session, db));

export const checkSlug = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ slug: z.string().max(100), orgId: z.string().optional() }))
  .handler(async ({ data, context: { db } }) =>
    checkWorkspaceSlug(db, data.slug, data.orgId as OrgId | undefined),
  );

export const createWorkspace = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ name: workspaceNameSchema, slug: workspaceSlugSchema }))
  .handler(async ({ data, context: { session, db } }) => createWorkspaceForUser(session, db, data));

export const updateWorkspace = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      name: workspaceNameSchema.optional(),
      slug: workspaceSlugSchema.optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...changes } = data;
    return updateWorkspaceSettings(session, db, orgId as OrgId, changes);
  });

export const getWorkspaceMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    fetchWorkspaceMembers(session, db, data.orgId as OrgId),
  );

export const removeWorkspaceMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), userId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    removeWorkspaceMemberById(session, db, data.orgId as OrgId, data.userId as UserId),
  );
