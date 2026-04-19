import { createDb } from '@corates/db/client';
import { projects, projectMembers } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { hasProjectRole } from '@corates/workers/policies';
import { createDomainError, AUTH_ERRORS, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import { getSession } from '@corates/workers/auth';

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
  | { ok: false; response: Response };

export async function requireProjectAccess(
  request: Request,
  env: Env,
  orgId: OrgId,
  projectId: ProjectId,
  minRole?: string,
): Promise<ProjectGuardResult> {
  const session = await getSession(request, env);
  if (!session) {
    return {
      ok: false,
      response: Response.json(createDomainError(AUTH_ERRORS.REQUIRED), { status: 401 }),
    };
  }

  if (!orgId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'org_context_required' }),
        { status: 403 },
      ),
    };
  }

  if (!projectId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'project_id_required' }),
        { status: 403 },
      ),
    };
  }

  const db = createDb(env.DB);

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
      response: Response.json(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'fetch_project_for_access_check',
          projectId,
          orgId,
          userId: session.user.id as UserId,
          originalError: err instanceof Error ? err.message : String(err),
        }),
        { status: 500 },
      ),
    };
  }

  if (!projectData) {
    return {
      ok: false,
      response: Response.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId }), {
        status: 404,
      }),
    };
  }

  if (projectData.orgId !== orgId) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(PROJECT_ERRORS.NOT_IN_ORG, {
          projectId,
          requestedOrgId: orgId,
          actualOrgId: projectData.orgId,
        }),
        { status: 403 },
      ),
    };
  }

  let projectMembership;
  try {
    projectMembership = await db
      .select({ role: projectMembers.role })
      .from(projectMembers)
      .where(
        and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, session.user.id as UserId)),
      )
      .get();
  } catch (err) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(SYSTEM_ERRORS.DB_ERROR, {
          operation: 'check_project_membership',
          projectId,
          orgId,
          userId: session.user.id as UserId,
          originalError: err instanceof Error ? err.message : String(err),
        }),
        { status: 500 },
      ),
    };
  }

  if (!projectMembership) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId, orgId }),
        { status: 403 },
      ),
    };
  }

  const projectRole = projectMembership.role as string;

  if (minRole && !hasProjectRole(projectRole, minRole)) {
    return {
      ok: false,
      response: Response.json(
        createDomainError(
          AUTH_ERRORS.FORBIDDEN,
          { reason: 'insufficient_project_role', required: minRole, actual: projectRole },
          `This action requires ${minRole} role or higher`,
        ),
        { status: 403 },
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
