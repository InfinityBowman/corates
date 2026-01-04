/**
 * Organization routes for Hono
 * Wraps Better Auth organization plugin APIs - delegates to plugin as service boundary
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { projects } from '../../db/schema.js';
import { eq, count } from 'drizzle-orm';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { requireOrgMembership, getOrgContext } from '../../middleware/requireOrg.js';
import { requireOrgWriteAccess } from '../../middleware/requireOrgWriteAccess.js';
import { createDomainError, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { createAuth } from '../../auth/config.js';
import { orgProjectRoutes } from './projects.js';

const orgRoutes = new Hono();

// Apply auth middleware to all routes
orgRoutes.use('*', requireAuth);

/**
 * GET /api/orgs
 * List organizations the user is a member of
 */
orgRoutes.get('/', async c => {
  try {
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.listOrganizations({
      headers: c.req.raw.headers,
    });

    return c.json(result);
  } catch (error) {
    console.error('Error listing organizations:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_organizations',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs
 * Create a new organization
 */
orgRoutes.post('/', async c => {
  try {
    const body = await c.req.json();

    if (!body.name?.trim()) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'name_required',
      });
      return c.json(error, error.statusCode);
    }

    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.createOrganization({
      headers: c.req.raw.headers,
      body: {
        name: body.name.trim(),
        slug: body.slug,
        logo: body.logo,
        metadata: body.metadata,
      },
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating organization:', error);
    // Check for slug taken error
    if (error.message?.includes('slug')) {
      const slugError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'slug_taken',
      });
      return c.json(slugError, slugError.statusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/orgs/:orgId
 * Get organization details (requires membership)
 */
orgRoutes.get('/:orgId', requireOrgMembership(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.getFullOrganization({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    if (!result) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_not_found',
        orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Add project count (not provided by Better Auth)
    const db = createDb(c.env.DB);
    const [projectCount] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    return c.json({
      ...result,
      projectCount: projectCount?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * PUT /api/orgs/:orgId
 * Update organization (requires admin or owner role)
 */
orgRoutes.put('/:orgId', requireOrgMembership('admin'), requireOrgWriteAccess(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const body = await c.req.json();

    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.updateOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
        data: {
          name: body.name,
          slug: body.slug,
          logo: body.logo,
          metadata: body.metadata,
        },
      },
    });

    return c.json({ success: true, orgId, ...result });
  } catch (error) {
    console.error('Error updating organization:', error);
    if (error.message?.includes('slug')) {
      const slugError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'slug_taken',
      });
      return c.json(slugError, slugError.statusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/orgs/:orgId
 * Delete organization (requires owner role)
 */
orgRoutes.delete('/:orgId', requireOrgMembership('owner'), requireOrgWriteAccess(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const auth = createAuth(c.env, c.executionCtx);
    await auth.api.deleteOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
      },
    });

    return c.json({ success: true, deleted: orgId });
  } catch (error) {
    console.error('Error deleting organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'delete_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/orgs/:orgId/members
 * List organization members
 */
orgRoutes.get('/:orgId/members', requireOrgMembership(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.listMembers({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    return c.json(result);
  } catch (error) {
    console.error('Error listing org members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'list_org_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/members
 * Add member to organization (requires admin or owner role)
 */
orgRoutes.post('/:orgId/members', requireOrgMembership('admin'), requireOrgWriteAccess(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const body = await c.req.json();
    const { userId, role = 'member' } = body;

    if (!userId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'user_id_required',
      });
      return c.json(error, error.statusCode);
    }

    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.addMember({
      body: {
        organizationId: orgId,
        userId,
        role,
      },
      headers: c.req.raw.headers,
    });

    return c.json({ success: true, ...result }, 201);
  } catch (error) {
    console.error('Error adding org member:', error);
    // Check for already member error
    if (error.message?.includes('already') || error.message?.includes('member')) {
      const memberError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'already_member',
      });
      return c.json(memberError, memberError.statusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'add_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * PUT /api/orgs/:orgId/members/:memberId
 * Update member role (requires admin or owner role)
 */
orgRoutes.put('/:orgId/members/:memberId', requireOrgMembership('admin'), requireOrgWriteAccess(), async c => {
  const orgId = c.req.param('orgId');
  const memberId = c.req.param('memberId');

  try {
    const body = await c.req.json();
    const { role } = body;

    if (!role) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'role_required',
      });
      return c.json(error, error.statusCode);
    }

    const auth = createAuth(c.env, c.executionCtx);
    await auth.api.updateMemberRole({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
        memberId,
        role,
      },
    });

    return c.json({ success: true, memberId, role });
  } catch (error) {
    console.error('Error updating org member:', error);
    // Check for permission errors
    if (error.message?.includes('owner') || error.message?.includes('permission')) {
      const permError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'owner_role_change_requires_owner',
      });
      return c.json(permError, permError.statusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * DELETE /api/orgs/:orgId/members/:memberId
 * Remove member from organization (requires admin or owner role, or self-removal)
 */
orgRoutes.delete('/:orgId/members/:memberId', requireOrgMembership(), requireOrgWriteAccess(), async c => {
  const { user: authUser } = getAuth(c);
  const { orgRole } = getOrgContext(c);
  const orgId = c.req.param('orgId');
  const memberId = c.req.param('memberId');

  // Allow self-removal (leave org) or admin/owner removal
  // Better Auth's removeMember requires admin/owner, but leaveOrganization allows self-removal
  const isSelf = memberId === authUser.id;
  const isAdminOrOwner = orgRole === 'admin' || orgRole === 'owner';

  if (!isSelf && !isAdminOrOwner) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'cannot_remove_member',
    });
    return c.json(error, error.statusCode);
  }

  try {
    const auth = createAuth(c.env, c.executionCtx);

    if (isSelf) {
      // Use leaveOrganization for self-removal
      await auth.api.leaveOrganization({
        headers: c.req.raw.headers,
        body: {
          organizationId: orgId,
        },
      });
    } else {
      // Use removeMember for admin/owner removal
      await auth.api.removeMember({
        headers: c.req.raw.headers,
        body: {
          organizationId: orgId,
          memberIdOrEmail: memberId,
        },
      });
    }

    return c.json({ success: true, removed: memberId, isSelf });
  } catch (error) {
    console.error('Error removing org member:', error);
    // Check for last owner error
    if (error.message?.includes('owner') || error.message?.includes('last')) {
      const ownerError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'cannot_remove_last_owner',
      });
      return c.json(ownerError, ownerError.statusCode);
    }
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'remove_org_member',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/orgs/:orgId/set-active
 * Set this organization as the user's active organization
 */
orgRoutes.post('/:orgId/set-active', requireOrgMembership(), async c => {
  const orgId = c.req.param('orgId');

  try {
    const auth = createAuth(c.env, c.executionCtx);
    await auth.api.setActiveOrganization({
      headers: c.req.raw.headers,
      body: {
        organizationId: orgId,
      },
    });

    return c.json({ success: true, activeOrganizationId: orgId });
  } catch (error) {
    console.error('Error setting active organization:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'set_active_organization',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// Mount org-scoped project routes
orgRoutes.route('/:orgId/projects', orgProjectRoutes);

export { orgRoutes };
