/**
 * Billing subscription routes
 * Handles org-scoped billing status and member info (read-only endpoints)
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import { getPlan, getGrantPlan } from '@corates/shared/plans';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';

const billingSubscriptionRoutes = new Hono();

/**
 * GET /usage
 * Get the current org's resource usage (projects, collaborators)
 */
billingSubscriptionRoutes.get('/usage', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    const { projects, projectMembers } = await import('@/db/schema.js');
    const { eq, count, countDistinct } = await import('drizzle-orm');

    // Count projects for this org
    const [projectCountResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    // Count unique collaborators across all org projects
    // This counts distinct users who are members of any project in this org
    const [collaboratorCountResult] = await db
      .select({ count: countDistinct(projectMembers.userId) })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.projectId, projects.id))
      .where(eq(projects.orgId, orgId));

    return c.json({
      projects: Number(projectCountResult?.count ?? 0),
      collaborators: Number(collaboratorCountResult?.count ?? 0),
    });
  } catch (error) {
    console.error('Error fetching org usage:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_usage',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /subscription
 * Get the current org's billing status (adapter for frontend compatibility)
 * Returns org-scoped billing resolution
 * Uses session's activeOrganizationId to determine the org
 */
billingSubscriptionRoutes.get('/subscription', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    const orgBilling = await resolveOrgAccess(db, orgId);

    // Get project count for usage display
    const { projects } = await import('@/db/schema.js');
    const { eq, count } = await import('drizzle-orm');
    const [projectCountResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    // Convert to frontend-compatible format
    // Use getGrantPlan for grants, getPlan for subscriptions/free
    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId)
      : getPlan(orgBilling.effectivePlanId);
    const currentPeriodEnd =
      orgBilling.subscription?.periodEnd ?
        orgBilling.subscription.periodEnd instanceof Date ?
          Math.floor(orgBilling.subscription.periodEnd.getTime() / 1000)
        : orgBilling.subscription.periodEnd
      : null;

    return c.json({
      tier: orgBilling.effectivePlanId,
      status:
        orgBilling.subscription?.status || (orgBilling.source === 'free' ? 'inactive' : 'active'),
      tierInfo: {
        name: effectivePlan.name,
        description: `Plan: ${effectivePlan.name}`,
      },
      stripeSubscriptionId: orgBilling.subscription?.id || null,
      currentPeriodEnd,
      cancelAtPeriodEnd: orgBilling.subscription?.cancelAtPeriodEnd || false,
      accessMode: orgBilling.accessMode,
      source: orgBilling.source,
      projectCount: projectCountResult?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching org billing:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_billing',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /members
 * Get the current org's members (uses session's activeOrganizationId)
 * Returns list of members with count
 */
billingSubscriptionRoutes.get('/members', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    // Use Better Auth API to list members (consistent with orgs endpoint)
    const { createAuth } = await import('@/auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.listMembers({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    return c.json({
      members: result.members || [],
      count: result.members?.length || 0,
    });
  } catch (error) {
    console.error('Error fetching org members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_members',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { billingSubscriptionRoutes };
