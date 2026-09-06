import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, ProjectId, UserId, ProjectInvitationId } from '@corates/shared/ids';
import { PROJECT_SETUP_STEPS } from '@corates/shared';
import { authMiddleware } from '@/server/middleware/auth';
import {
  createOrgProject,
  updateProjectById,
  updateProjectSetupStepById,
  deleteProjectById,
  listProjectMembers,
  addProjectMember,
  removeProjectMember,
  listProjectInvitations,
  cancelProjectInvitation,
} from './org-projects.server';

// -- Projects --

export const createProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      name: z.string().trim().min(1).max(255),
      description: z.string().trim().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, ...projectData } = data;
    return createOrgProject(session, db, orgId as OrgId, projectData);
  });

export const updateProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      name: z.string().min(1).max(255).optional(),
      description: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...updateData } = data;
    return updateProjectById(session, db, orgId as OrgId, projectId as ProjectId, updateData);
  });

export const updateProjectSetupStep = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      setupStep: z.enum(PROJECT_SETUP_STEPS).nullable(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    updateProjectSetupStepById(
      session,
      db,
      data.orgId as OrgId,
      data.projectId as ProjectId,
      data.setupStep,
    ),
  );

export const deleteProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    deleteProjectById(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

// -- Project Members --

export const getProjectMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listProjectMembers(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const addMemberToProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      userId: z.string().optional(),
      email: z.string().optional(),
      role: z.enum(['owner', 'member']).default('member'),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...memberData } = data;
    return addProjectMember(session, db, orgId as OrgId, projectId as ProjectId, memberData);
  });

export const removeMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      userId: z.string(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    removeProjectMember(
      session,
      db,
      data.orgId as OrgId,
      data.projectId as ProjectId,
      data.userId as UserId,
    ),
  );

// -- Project Invitations --

export const getInvitations = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .validator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listProjectInvitations(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const cancelInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .validator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      invitationId: z.string(),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    cancelProjectInvitation(
      session,
      db,
      data.orgId as OrgId,
      data.projectId as ProjectId,
      data.invitationId as ProjectInvitationId,
    ),
  );
