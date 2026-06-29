import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listAdminProjects,
  getAdminProjectDetails,
  getAdminProjectDocStats,
  removeAdminProjectMember,
  deleteAdminProject,
  wakeAllProjectDOs,
} from './admin-projects.server';

export const getAdminProjectsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      page: z.number().optional(),
      limit: z.number().optional(),
      search: z.string().optional(),
      orgId: z.string().optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => listAdminProjects(session, db, data));

export const getAdminProjectDetailsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminProjectDetails(session, db, data.projectId),
  );

export const getAdminProjectDocStatsAction = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getAdminProjectDocStats(session, db, data.projectId),
  );

export const removeAdminProjectMemberAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string(), memberId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    removeAdminProjectMember(session, db, data.projectId, data.memberId),
  );

export const deleteAdminProjectAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    deleteAdminProject(session, db, data.projectId),
  );

export const wakeAllProjectDOsAction = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .handler(async ({ context: { session, db } }) => wakeAllProjectDOs(session, db));
