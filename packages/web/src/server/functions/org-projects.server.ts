import { captureError } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import { projects, projectMembers, projectInvitations, user } from '@corates/db/schema';
import { eq, and, count, desc, isNull } from 'drizzle-orm';
import {
  DomainErrorException,
  isDomainError,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
  throwDomainError,
  USER_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { OrgId, ProjectId, UserId, ProjectInvitationId } from '@corates/shared/ids';
import { createProject } from '@corates/workers/commands/projects';
import {
  updateProject as updateProjectCmd,
  deleteProject as deleteProjectCmd,
} from '@corates/workers/commands/projects';
import { addMember } from '@corates/workers/commands/members';
import {
  updateMemberRole as updateMemberRoleCmd,
  removeMember as removeMemberCmd,
} from '@corates/workers/commands/members';
import { createInvitation } from '@corates/workers/commands/invitations';
import { requireMemberRemoval } from '@corates/workers/policies';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import { requireProjectAccess } from '@/server/guards/requireProjectAccess';
import { requireOrgWriteAccess } from '@/server/guards/requireOrgWriteAccess';
import { requireEntitlement } from '@/server/guards/requireEntitlement';
import { requireQuota } from '@/server/guards/requireQuota';
import type { Session } from '@/server/middleware/auth';

// -- Projects --

export async function listOrgProjects(session: Session, db: Database, orgId: OrgId) {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  try {
    const results = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        role: projectMembers.role,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
      .where(and(eq(projects.orgId, orgId), eq(projectMembers.userId, membership.context.userId)))
      .orderBy(desc(projects.updatedAt));

    return results;
  } catch (err) {
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'list' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_org_projects',
      originalError: error.message,
    });
  }
}

export async function createOrgProject(
  session: Session,
  db: Database,
  orgId: OrgId,
  data: { name: string; description?: string },
) {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  const writeAccess = await requireOrgWriteAccess('POST', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const entitlement = await requireEntitlement(db, orgId, 'project.create');
  if (!entitlement.ok) throw entitlement.error;

  const getProjectCount = async () => {
    const result = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .get();
    return result?.count || 0;
  };

  const quota = await requireQuota(db, orgId, 'projects.max', getProjectCount, 1);
  if (!quota.ok) throw quota.error;

  try {
    const { project } = await createProject(
      env,
      { id: membership.context.userId },
      {
        orgId,
        name: data.name,
        description: data.description,
      },
    );

    return project;
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'create' } });
    throwDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
      operation: 'create_project',
      originalError: error.message,
    });
  }
}

export async function getProject(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.error;

  try {
    const result = await db
      .select({
        id: projects.id,
        name: projects.name,
        description: projects.description,
        orgId: projects.orgId,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        createdBy: projects.createdBy,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();

    if (!result) {
      throwDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
    }

    return { ...result, role: access.context.projectRole };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'get' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_project',
      originalError: error.message,
    });
  }
}

export async function updateProjectById(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  data: { name?: string; description?: string },
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'member');
  if (!access.ok) throw access.error;

  try {
    const result = await updateProjectCmd(
      env,
      { id: access.context.userId },
      { projectId, name: data.name, description: data.description },
    );
    return { success: true as const, projectId: result.projectId };
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'update' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project',
      originalError: error.message,
    });
  }
}

export async function deleteProjectById(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  try {
    const result = await deleteProjectCmd(
      env,
      { id: access.context.userId, email: access.context.userEmail },
      { projectId },
    );
    return { success: true as const, deleted: result.deleted };
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'delete' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_project',
      originalError: error.message,
    });
  }
}

// -- Project Members --

export async function listProjectMembers(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.error;

  try {
    const results = await db
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        joinedAt: projectMembers.joinedAt,
        name: user.name,
        email: user.email,
        username: user.username,
        givenName: user.givenName,
        familyName: user.familyName,
        image: user.image,
      })
      .from(projectMembers)
      .innerJoin(user, eq(projectMembers.userId, user.id))
      .where(eq(projectMembers.projectId, projectId))
      .orderBy(projectMembers.joinedAt);

    return results;
  } catch (err) {
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'list-members' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_project_members',
      originalError: error.message,
    });
  }
}

export async function addProjectMember(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  data: { userId?: string; email?: string; role?: 'owner' | 'member' },
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('POST', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  const role = data.role ?? 'member';

  if (!data.userId && !data.email) {
    throwDomainError(VALIDATION_ERRORS.FIELD_REQUIRED, {
      field: 'userId/email',
      detail: 'userId_or_email_required',
    });
  }

  try {
    let userToAdd;
    if (data.userId) {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          givenName: user.givenName,
          familyName: user.familyName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.id, data.userId))
        .get();
    } else if (data.email) {
      userToAdd = await db
        .select({
          id: user.id,
          name: user.name,
          email: user.email,
          username: user.username,
          givenName: user.givenName,
          familyName: user.familyName,
          image: user.image,
        })
        .from(user)
        .where(eq(user.email, data.email.toLowerCase()))
        .get();
    }

    if (!userToAdd && data.email) {
      try {
        const result = await createInvitation(
          env,
          { id: access.context.userId },
          { orgId, projectId, email: data.email, role },
        );
        return {
          success: true,
          invitation: true,
          message:
            result.emailQueued ?
              'Invitation sent successfully'
            : 'Invitation created but email delivery may be delayed',
          email: data.email,
        };
      } catch (err) {
        if (isDomainError(err)) {
          throw new DomainErrorException(err);
        }
        throw err;
      }
    }

    if (!userToAdd) {
      throwDomainError(USER_ERRORS.NOT_FOUND, { userId: data.userId, email: data.email });
    }

    const { member: addedMember } = await addMember(
      env,
      { id: access.context.userId },
      { orgId, projectId, userToAdd, role },
    );

    return addedMember;
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'add-member' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_project_member',
      originalError: error.message,
    });
  }
}

export async function updateProjectMemberRole(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  targetUserId: UserId,
  data: { role: 'owner' | 'member' },
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('PUT', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  try {
    const result = await updateMemberRoleCmd(
      env,
      { id: access.context.userId },
      {
        orgId,
        projectId,
        userId: targetUserId,
        role: data.role,
      },
    );
    return { success: true as const, userId: result.userId, role: result.role };
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'update-member-role' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_project_member_role',
      originalError: error.message,
    });
  }
}

export async function removeProjectMember(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  targetUserId: UserId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.error;

  const isSelf = targetUserId === access.context.userId;

  try {
    await requireMemberRemoval(db, access.context.userId, projectId, targetUserId);
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    throw err;
  }

  try {
    const result = await removeMemberCmd(
      env,
      { id: access.context.userId },
      {
        orgId,
        projectId,
        userId: targetUserId,
        isSelfRemoval: isSelf,
      },
    );
    return { success: true as const, removed: result.removed };
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'remove-member' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_project_member',
      originalError: error.message,
    });
  }
}

// -- Project Invitations --

export async function listProjectInvitations(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const access = await requireProjectAccess(session, db, orgId, projectId);
  if (!access.ok) throw access.error;

  try {
    const invitations = await db
      .select({
        id: projectInvitations.id,
        email: projectInvitations.email,
        role: projectInvitations.role,
        orgRole: projectInvitations.orgRole,
        expiresAt: projectInvitations.expiresAt,
        acceptedAt: projectInvitations.acceptedAt,
        createdAt: projectInvitations.createdAt,
        invitedBy: projectInvitations.invitedBy,
      })
      .from(projectInvitations)
      .where(
        and(eq(projectInvitations.projectId, projectId), isNull(projectInvitations.acceptedAt)),
      )
      .orderBy(desc(projectInvitations.createdAt));

    return invitations;
  } catch (err) {
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'list-invitations' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_invitations',
      originalError: error.message,
    });
  }
}

export async function createProjectInvitation(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  data: { email: string; role: 'owner' | 'member' },
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('POST', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  try {
    const result = await createInvitation(
      env,
      { id: access.context.userId },
      { orgId, projectId, email: data.email, role: data.role },
    );

    return {
      success: true,
      invitationId: result.invitationId,
      message:
        result.emailQueued ?
          'Invitation sent successfully'
        : 'Invitation created but email delivery may be delayed',
      email: data.email,
    };
  } catch (err) {
    if (isDomainError(err)) {
      throw new DomainErrorException(err as DomainError);
    }
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'create-invitation' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_invitation',
      originalError: error.message,
    });
  }
}

export async function cancelProjectInvitation(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  invitationId: ProjectInvitationId,
) {
  const orgMembership = await requireOrgMembership(session, db, orgId);
  if (!orgMembership.ok) throw orgMembership.error;

  const writeAccess = await requireOrgWriteAccess('DELETE', db, orgId);
  if (!writeAccess.ok) throw writeAccess.error;

  const access = await requireProjectAccess(session, db, orgId, projectId, 'owner');
  if (!access.ok) throw access.error;

  try {
    const invitation = await db
      .select({ acceptedAt: projectInvitations.acceptedAt })
      .from(projectInvitations)
      .where(
        and(eq(projectInvitations.id, invitationId), eq(projectInvitations.projectId, projectId)),
      )
      .get();

    if (!invitation) {
      throwDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'invitationId',
        value: invitationId,
      });
    }

    if (invitation.acceptedAt) {
      throwDomainError(PROJECT_ERRORS.INVITATION_ALREADY_ACCEPTED, {
        invitationId,
      });
    }

    await db.delete(projectInvitations).where(eq(projectInvitations.id, invitationId));

    return { success: true as const, cancelled: invitationId };
  } catch (err) {
    if (err instanceof DomainErrorException) throw err;
    const error = err as Error;
    captureError(error, { tags: { component: 'org-projects', action: 'cancel-invitation' } });
    throwDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'cancel_invitation',
      originalError: error.message,
    });
  }
}
