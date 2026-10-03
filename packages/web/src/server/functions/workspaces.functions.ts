import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { workspaceNameSchema } from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listMyWorkspaces,
  updateWorkspaceSettings,
  getWorkspaceMembers as fetchWorkspaceMembers,
  removeWorkspaceMember as removeWorkspaceMemberById,
} from './workspaces.server';

export const getMyWorkspaces = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => listMyWorkspaces(session, db));

export const updateWorkspace = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), name: workspaceNameSchema }))
  .handler(async ({ data, context: { session, db } }) =>
    updateWorkspaceSettings(session, db, data.orgId as OrgId, { name: data.name }),
  );

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
