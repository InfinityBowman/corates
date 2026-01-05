/**
 * Admin organization management routes
 * Handles org listing, search, and details with billing info
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { organization, member, projects } from '../../db/schema.js';
import { eq, count, desc, like, or, sql } from 'drizzle-orm';
import {
  createDomainError,
  SYSTEM_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared';
import { resolveOrgAccess } from '../../lib/billingResolver.js';
import { getPlan, getGrantPlan } from '@corates/shared/plans';

const orgRoutes = new Hono();

/**
 * GET /api/admin/orgs
 * List all orgs with pagination and search
 * Query params:
 *   - page: page number (default 1)
 *   - limit: results per page (default 20, max 100)
 *   - search: search by name or slug
 */
orgRoutes.get('/orgs', async c => {
  const db = createDb(c.env.DB);

  try {
    const page = parseInt(c.req.query('page') || '1', 10);
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const search = c.req.query('search');

    const offset = (page - 1) * limit;

    let query = db.select().from(organization);

    // Apply search filter if provided
    if (search) {
      const searchLower = search.toLowerCase();
      query = db
        .select()
        .from(organization)
        .where(
          or(
            like(sql`LOWER(${organization.name})`, `%${searchLower}%`),
            like(sql`LOWER(${organization.slug})`, `%${searchLower}%`),
          ),
        );
    }

    // Get total count for pagination
    const totalCountQuery =
      search ?
        db
          .select({ count: count() })
          .from(organization)
          .where(
            or(
              like(sql`LOWER(${organization.name})`, `%${search.toLowerCase()}%`),
              like(sql`LOWER(${organization.slug})`, `%${search.toLowerCase()}%`),
            ),
          )
      : db.select({ count: count() }).from(organization);

    const [totalResult] = await totalCountQuery.all();
    const total = totalResult?.count || 0;

    // Get paginated results
    const orgs = await query
      .orderBy(desc(organization.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Get stats for all orgs in parallel
    const orgIds = orgs.map(org => org.id);
    const statsMap = {};

    if (orgIds.length > 0) {
      // Get member counts
      const memberCounts = await db
        .select({
          organizationId: member.organizationId,
          count: count(),
        })
        .from(member)
        .where(
          sql`${member.organizationId} IN (${sql.join(
            orgIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(member.organizationId)
        .all();

      // Get project counts
      const projectCounts = await db
        .select({
          orgId: projects.orgId,
          count: count(),
        })
        .from(projects)
        .where(
          sql`${projects.orgId} IN (${sql.join(
            orgIds.map(id => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(projects.orgId)
        .all();

      // Build stats map
      memberCounts.forEach(({ organizationId, count: cnt }) => {
        if (!statsMap[organizationId]) statsMap[organizationId] = {};
        statsMap[organizationId].memberCount = cnt;
      });

      projectCounts.forEach(({ orgId, count: cnt }) => {
        if (!statsMap[orgId]) statsMap[orgId] = {};
        statsMap[orgId].projectCount = cnt;
      });
    }

    // Attach stats to each org
    const orgsWithStats = orgs.map(org => ({
      ...org,
      stats: {
        memberCount: statsMap[org.id]?.memberCount || 0,
        projectCount: statsMap[org.id]?.projectCount || 0,
      },
    }));

    return c.json({
      orgs: orgsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching orgs:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_orgs',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/orgs/:orgId
 * Get org details with billing summary
 */
orgRoutes.get('/orgs/:orgId', async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);

  try {
    // Get org
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_not_found',
        orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Get member count
    const [memberCountResult] = await db
      .select({ count: count() })
      .from(member)
      .where(eq(member.organizationId, orgId))
      .all();
    const memberCount = memberCountResult?.count || 0;

    // Get project count
    const [projectCountResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId))
      .all();
    const projectCount = projectCountResult?.count || 0;

    // Get billing summary
    const orgBilling = await resolveOrgAccess(db, orgId);
    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId)
      : getPlan(orgBilling.effectivePlanId);

    return c.json({
      org,
      stats: {
        memberCount,
        projectCount,
      },
      billing: {
        effectivePlanId: orgBilling.effectivePlanId,
        source: orgBilling.source,
        accessMode: orgBilling.accessMode,
        plan: {
          name: effectivePlan.name,
          entitlements: effectivePlan.entitlements,
          quotas: effectivePlan.quotas,
        },
        subscription: orgBilling.subscription,
        grant: orgBilling.grant,
      },
    });
  } catch (error) {
    console.error('Error fetching org details:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_details',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { orgRoutes };
