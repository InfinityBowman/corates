/**
 * Organization membership middleware for Hono
 * Requires user to be a member of the specified organization
 */

import { createDb } from '../db/client.js';
import { member, organization, projects, projectMembers } from '../db/schema.js';
import { eq, and } from 'drizzle-orm';
import { getAuth } from './auth.js';
import { createDomainError, AUTH_ERRORS, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { hasOrgRole, hasProjectRole } from '@/policies';

/**
 * Middleware that requires organization membership
 * Sets orgId, orgRole, and org on context
 * @param {string} [minRole] - Minimum required role (optional)
 * @returns {Function} Hono middleware
 */
export function requireOrgMembership(minRole) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const orgId = c.req.param('orgId');

    if (!user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode);
    }

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_id_required',
      });
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);

    // Check if user is a member of the organization
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
      return c.json(error, error.statusCode);
    }

    // Check minimum role if specified
    if (minRole && !hasOrgRole(membership.role, minRole)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        { reason: 'insufficient_org_role', required: minRole, actual: membership.role },
        `This action requires ${minRole} role or higher`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach org context to request
    c.set('orgId', orgId);
    c.set('orgRole', membership.role);
    c.set('org', {
      id: orgId,
      name: membership.orgName,
      slug: membership.orgSlug,
    });

    await next();
  };
}

/**
 * Middleware that requires project access within an org
 * Must be used after requireOrgMembership
 * Sets projectId, projectRole, and project on context
 * @param {string} [minRole] - Minimum required project role (optional)
 * @returns {Function} Hono middleware
 */
export function requireProjectAccess(minRole) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const orgId = c.get('orgId');
    const projectId = c.req.param('projectId');

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_context_required',
      });
      return c.json(error, error.statusCode);
    }

    if (!projectId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'project_id_required',
      });
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);

    // First check if project exists and get its org
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
    } catch (error) {
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'fetch_project_for_access_check',
        projectId,
        orgId,
        userId: user.id,
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }

    if (!projectData) {
      const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
      return c.json(error, error.statusCode);
    }

    // Check if project belongs to the specified org
    if (projectData.orgId !== orgId) {
      const error = createDomainError(PROJECT_ERRORS.NOT_IN_ORG, {
        projectId,
        requestedOrgId: orgId,
        actualOrgId: projectData.orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Check if user has project membership
    let projectMembership;
    try {
      projectMembership = await db
        .select({
          role: projectMembers.role,
        })
        .from(projectMembers)
        .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
        .get();
    } catch (error) {
      const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'check_project_membership',
        projectId,
        orgId,
        userId: user.id,
        originalError: error.message,
      });
      return c.json(dbError, dbError.statusCode);
    }

    if (!projectMembership) {
      const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, {
        projectId,
        orgId,
      });
      return c.json(error, error.statusCode);
    }

    const projectAccess = {
      projectId: projectData.id,
      projectName: projectData.name,
      projectRole: projectMembership.role,
    };

    // Check minimum role if specified
    if (minRole && !hasProjectRole(projectAccess.projectRole, minRole)) {
      const error = createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        {
          reason: 'insufficient_project_role',
          required: minRole,
          actual: projectAccess.projectRole,
        },
        `This action requires ${minRole} role or higher`,
      );
      return c.json(error, error.statusCode);
    }

    // Attach project context to request
    c.set('projectId', projectId);
    c.set('projectRole', projectAccess.projectRole);
    c.set('project', {
      id: projectId,
      name: projectAccess.projectName,
    });

    await next();
  };
}

/**
 * Get the current org context from Hono context
 * @param {Object} c - Hono context
 * @returns {{ orgId: string|null, orgRole: string|null, org: object|null }}
 */
export function getOrgContext(c) {
  return {
    orgId: c.get('orgId') || null,
    orgRole: c.get('orgRole') || null,
    org: c.get('org') || null,
  };
}

/**
 * Get the current project context from Hono context
 * @param {Object} c - Hono context
 * @returns {{ projectId: string|null, projectRole: string|null, project: object|null }}
 */
export function getProjectContext(c) {
  return {
    projectId: c.get('projectId') || null,
    projectRole: c.get('projectRole') || null,
    project: c.get('project') || null,
  };
}
