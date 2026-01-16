/**
 * Admin organization management routes
 * Handles org listing, search, and details with billing info
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import { organization, member, projects } from '@/db/schema.js';
import { eq, count, desc, like, or, sql } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';

const orgRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const OrgStatsSchema = z
  .object({
    memberCount: z.number(),
    projectCount: z.number(),
  })
  .openapi('AdminOrgStats');

const OrgWithStatsSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    slug: z.string().nullable(),
    logo: z.string().nullable(),
    metadata: z.string().nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    stats: OrgStatsSchema,
  })
  .openapi('AdminOrgWithStats');

const PaginationSchema = z
  .object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number(),
  })
  .openapi('Pagination');

const OrgListResponseSchema = z
  .object({
    orgs: z.array(OrgWithStatsSchema),
    pagination: PaginationSchema,
  })
  .openapi('AdminOrgListResponse');

const PlanDetailsSchema = z
  .object({
    name: z.string(),
    entitlements: z.record(z.string(), z.boolean()).optional(),
    quotas: z.record(z.string(), z.number()).optional(),
  })
  .openapi('PlanDetails');

const BillingInfoSchema = z
  .object({
    effectivePlanId: z.string(),
    source: z.string(),
    accessMode: z.string(),
    plan: PlanDetailsSchema,
    subscription: z.record(z.string(), z.unknown()).nullable(),
    grant: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('BillingInfo');

const OrgDetailsResponseSchema = z
  .object({
    org: z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string().nullable(),
      logo: z.string().nullable(),
      metadata: z.string().nullable(),
      createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    }),
    stats: OrgStatsSchema,
    billing: BillingInfoSchema,
  })
  .openapi('AdminOrgDetailsResponse');

const AdminErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AdminError');

// Route definitions
const listOrgsRoute = createRoute({
  method: 'get',
  path: '/orgs',
  tags: ['Admin - Organizations'],
  summary: 'List all organizations',
  description: 'List all organizations with pagination and search. Admin only.',
  request: {
    query: z.object({
      page: z.string().optional().openapi({ description: 'Page number', example: '1' }),
      limit: z
        .string()
        .optional()
        .openapi({ description: 'Results per page (max 100)', example: '20' }),
      search: z
        .string()
        .optional()
        .openapi({ description: 'Search by name or slug', example: 'acme' }),
    }),
  },
  responses: {
    200: {
      description: 'List of organizations with stats',
      content: {
        'application/json': {
          schema: OrgListResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - not logged in',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not an admin',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

const getOrgDetailsRoute = createRoute({
  method: 'get',
  path: '/orgs/{orgId}',
  tags: ['Admin - Organizations'],
  summary: 'Get organization details',
  description: 'Get detailed organization info including billing summary. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Organization details with billing info',
      content: {
        'application/json': {
          schema: OrgDetailsResponseSchema,
        },
      },
    },
    401: {
      description: 'Unauthorized - not logged in',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    403: {
      description: 'Forbidden - not an admin or org not found',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: AdminErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/orgs
 * List all orgs with pagination and search
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(listOrgsRoute, async c => {
  const db = createDb(c.env.DB);

  try {
    const query = c.req.valid('query');
    const page = parseInt(query.page || '1', 10);
    const limit = Math.min(parseInt(query.limit || '20', 10), 100);
    const search = query.search;

    const offset = (page - 1) * limit;

    // Build search condition if provided
    const searchCondition =
      search ?
        or(
          like(sql`LOWER(${organization.name})`, `%${search.toLowerCase()}%`),
          like(sql`LOWER(${organization.slug})`, `%${search.toLowerCase()}%`),
        )
      : undefined;

    // Get total count for pagination
    const totalCountQuery =
      searchCondition ?
        db.select({ count: count() }).from(organization).where(searchCondition)
      : db.select({ count: count() }).from(organization);

    const [totalResult] = await totalCountQuery.all();
    const total = totalResult?.count || 0;

    // Get paginated results
    const baseQuery = db.select().from(organization);
    const orgs = await (searchCondition ? baseQuery.where(searchCondition) : baseQuery)
      .orderBy(desc(organization.createdAt))
      .limit(limit)
      .offset(offset)
      .all();

    // Get stats for all orgs in parallel
    const orgIds = orgs.map(org => org.id);
    const statsMap: Record<string, { memberCount?: number; projectCount?: number }> = {};

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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching orgs:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_orgs',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * GET /api/admin/orgs/:orgId
 * Get org details with billing summary
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
orgRoutes.openapi(getOrgDetailsRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Get org
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_not_found',
        orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
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
        getGrantPlan(orgBilling.effectivePlanId as GrantType)
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
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org details:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_details',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { orgRoutes };
