import type { Context, MiddlewareHandler } from 'hono';
import { createDb } from '../db/client';
import { member, organization, projects, projectMembers } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { getAuth } from './auth';
import { createDomainError, AUTH_ERRORS, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { hasOrgRole, hasProjectRole } from '@/policies';
import type { AppContext, OrgContext, ProjectContext } from '../types';

export function requireOrgMembership(minRole?: string): MiddlewareHandler {
  return async (c, next) => {
    const { user } = getAuth(c);
    const orgId = c.req.param('orgId');

    if (!user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode as 401);
    }

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_id_required',
      });
      return c.json(error, error.statusCode as 403);
    }

    const db = createDb((c as AppContext).env.DB);

    const membership = await db
      .select({
        id: member.id,
        role: member.role,
        orgName: organization.name,
        orgSlug: organization.slug,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();

    if (!membership) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'not_org_member',
        orgId,
      });
      return c.json(error, error.statusCode as 403);
    }

    if (minRole && !hasOrgRole(membership.role, minRole)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'insufficient_org_role', required: minRole, actual: membership.role },
        `This action requires ${minRole} role or higher`,
      );
      return c.json(error, error.statusCode as 403);
    }

    c.set('orgId', orgId);
    c.set('orgRole', membership.role);
    c.set('org', {
      id: orgId,
      name: membership.orgName,
      slug: membership.orgSlug,
    } as OrgContext);

    await next();
  };
}

export function requireProjectAccess(minRole?: string): MiddlewareHandler {
  return async (c, next) => {
    const { user } = getAuth(c);
    const orgId = c.get('orgId') as string | undefined;
    const projectId = c.req.param('projectId');

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_context_required',
      });
      return c.json(error, error.statusCode as 403);
    }

    if (!projectId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'project_id_required',
      });
      return c.json(error, error.statusCode as 403);
    }

    if (!user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode as 401);
    }

    const db = createDb((c as AppContext).env.DB);

    let projectData;
    try {
      projectData = await db
        .select({
          id: projects.id,
          name: projects.name,
          orgId: projects.orgId,
        })
        .from(projects)
        .where(eq(projects.id, projectId))
        .get();
    } catch (err) {
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_project_for_access_check',
        projectId,
        orgId,
        userId: user.id,
        originalError: err instanceof Error ? err.message : String(err),
      });
      return c.json(dbError, dbError.statusCode as 500);
    }

    if (!projectData) {
      const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
      return c.json(error, error.statusCode as 404);
    }

    if (projectData.orgId !== orgId) {
      const error = createDomainError(PROJECT_ERRORS.NOT_IN_ORG, {
        projectId,
        requestedOrgId: orgId,
        actualOrgId: projectData.orgId,
      });
      return c.json(error, error.statusCode as 403);
    }

    let projectMembership;
    try {
      projectMembership = await db
        .select({
          role: projectMembers.role,
        })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
        .get();
    } catch (err) {
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'check_project_membership',
        projectId,
        orgId,
        userId: user.id,
        originalError: err instanceof Error ? err.message : String(err),
      });
      return c.json(dbError, dbError.statusCode as 500);
    }

    if (!projectMembership) {
      const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, {
        projectId,
        orgId,
      });
      return c.json(error, error.statusCode as 403);
    }

    const projectRole = projectMembership.role as string;
    const projectAccess = {
      projectId: projectData.id,
      projectName: projectData.name,
      projectRole,
    };

    if (minRole && !hasProjectRole(projectRole, minRole)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        {
          reason: 'insufficient_project_role',
          required: minRole,
          actual: projectAccess.projectRole,
        },
        `This action requires ${minRole} role or higher`,
      );
      return c.json(error, error.statusCode as 403);
    }

    c.set('projectId', projectId);
    c.set('projectRole', projectAccess.projectRole);
    c.set('project', {
      id: projectId,
      name: projectAccess.projectName,
    } as ProjectContext);

    await next();
  };
}

export function getOrgContext(c: Context): {
  orgId: string | null;
  orgRole: string | null;
  org: OrgContext | null;
} {
  return {
    orgId: (c.get('orgId') as string | undefined) || null,
    orgRole: (c.get('orgRole') as string | undefined) || null,
    org: (c.get('org') as OrgContext | undefined) || null,
  };
}

export function getProjectContext(c: Context): {
  projectId: string | null;
  projectRole: string | null;
  project: ProjectContext | null;
} {
  return {
    projectId: (c.get('projectId') as string | undefined) || null,
    projectRole: (c.get('projectRole') as string | undefined) || null,
    project: (c.get('project') as ProjectContext | undefined) || null,
  };
}
