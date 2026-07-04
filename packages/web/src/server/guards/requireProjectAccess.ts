import type { Database } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasProjectRole } from '@corates/workers/policies';
import {
  createDomainError,
  DomainErrorException,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  SYSTEM_ERRORS,
} from '@corates/shared';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import type { Session } from '@/server/middleware/auth';

export interface ProjectContext {
  userId: UserId;
  userEmail: string;
  orgId: OrgId;
  projectId: ProjectId;
  projectName: string;
  projectRole: string;
}

export type ProjectGuardResult =
  | { ok: true; context: ProjectContext }
  | { ok: false; error: DomainErrorException };

export async function requireProjectAccess(
  session: Session,
  db: Database,
  orgId: OrgId,
  projectId: ProjectId,
  minRole?: string,
): Promise<ProjectGuardResult> {
  if (!orgId) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
      ),
    };
  }

  if (!projectId) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'project_id_required' }),
      ),
    };
  }

  let projectData;
  try {
    projectData = await db
      .select({ id: projects.id, name: projects.name, orgId: projects.orgId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
  } catch (err) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'fetch_project_for_access_check',
          projectId,
          orgId,
          userId: session.user.id as UserId,
          originalError: err instanceof Error ? err.message : String(err),
        }),
      ),
    };
  }

  if (!projectData) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }),
      ),
    };
  }

  if (projectData.orgId !== orgId) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(PROJECT_ERRORS.NOT_IN_ORG, {
          projectId,
          requestedOrgId: orgId,
          actualOrgId: projectData.orgId,
        }),
      ),
    };
  }

  let projectMembership;
  try {
    projectMembership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, session.user.id as UserId),
        ),
      )
      .get();
  } catch (err) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'check_project_membership',
          projectId,
          orgId,
          userId: session.user.id as UserId,
          originalError: err instanceof Error ? err.message : String(err),
        }),
      ),
    };
  }

  if (!projectMembership) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId, orgId }),
      ),
    };
  }

  const projectRole = projectMembership.role as string;

  if (minRole && !hasProjectRole(projectRole, minRole)) {
    return {
      ok: false,
      error: new DomainErrorException(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'insufficient_project_role', required: minRole, actual: projectRole },
          `This action requires ${minRole} role or higher`,
        ),
      ),
    };
  }

  return {
    ok: true,
    context: {
      userId: session.user.id as UserId,
      userEmail: session.user.email,
      orgId,
      projectId,
      projectName: projectData.name,
      projectRole,
    },
  };
}
