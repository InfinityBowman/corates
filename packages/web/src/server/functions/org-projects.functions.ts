import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type { OrgId, ProjectId, UserId, ProjectInvitationId } from '@corates/shared/ids';
import { authMiddleware } from '@/server/middleware/auth';
import {
  listOrgProjects,
  createOrgProject,
  getProject,
  updateProjectById,
  deleteProjectById,
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
  listProjectInvitations,
  createProjectInvitation,
  cancelProjectInvitation,
} from './org-projects.server';

// -- Projects --

export const getOrgProjects = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listOrgProjects(session, db, data.orgId as OrgId),
  );

export const createProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
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

export const getProjectById = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    getProject(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const updateProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
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

export const deleteProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    deleteProjectById(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

// -- Project Members --

export const getProjectMembers = createServerFn({ method: 'GET' })
  .middleware([authMiddleware])
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listProjectMembers(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const addMemberToProject = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
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

export const updateMemberRole = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      userId: z.string(),
      role: z.enum(['owner', 'member']),
    }),
  )
  .handler(async ({ data, context: { session, db } }) =>
    updateProjectMemberRole(
      session,
      db,
      data.orgId as OrgId,
      data.projectId as ProjectId,
      data.userId as UserId,
      { role: data.role },
    ),
  );

export const removeMember = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
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
  .inputValidator(z.object({ orgId: z.string(), projectId: z.string() }))
  .handler(async ({ data, context: { session, db } }) =>
    listProjectInvitations(session, db, data.orgId as OrgId, data.projectId as ProjectId),
  );

export const createInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
    z.object({
      orgId: z.string(),
      projectId: z.string(),
      email: z.string().email(),
      role: z.enum(['owner', 'member']),
    }),
  )
  .handler(async ({ data, context: { session, db } }) => {
    const { orgId, projectId, ...inviteData } = data;
    return createProjectInvitation(session, db, orgId as OrgId, projectId as ProjectId, inviteData);
  });

export const cancelInvitation = createServerFn({ method: 'POST' })
  .middleware([authMiddleware])
  .inputValidator(
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
