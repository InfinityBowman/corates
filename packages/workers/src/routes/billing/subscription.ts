/**
 * Billing subscription routes
 * Handles org-scoped billing status and member info (read-only endpoints)
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { resolveOrgId } from './helpers/orgContext.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env } from '../../types';
import { ErrorResponseSchema } from '@/schemas/common.js';

const billingSubscriptionRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Response schemas
const UsageResponseSchema = z
  .object({
    projects: z.number(),
    collaborators: z.number(),
  })
  .openapi('UsageResponse');

const SubscriptionResponseSchema = z
  .object({
    tier: z.string(),
    status: z.string(),
    tierInfo: z.object({
      name: z.string(),
      description: z.string(),
    }),
    stripeSubscriptionId: z.string().nullable(),
    currentPeriodEnd: z.number().nullable(),
    cancelAtPeriodEnd: z.boolean(),
    accessMode: z.string(),
    source: z.string(),
    projectCount: z.number(),
  })
  .openapi('SubscriptionResponse');

const MemberSchema = z
  .object({
    id: z.string(),
    userId: z.string(),
    organizationId: z.string(),
    role: z.string(),
    createdAt: z.string(),
    user: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        email: z.string(),
        image: z.string().nullable(),
      })
      .optional(),
  })
  .openapi('OrgMember');

const MembersResponseSchema = z
  .object({
    members: z.array(MemberSchema),
    count: z.number(),
  })
  .openapi('MembersResponse');

// Route definitions
const usageRoute = createRoute({
  method: 'get',
  path: '/usage',
  tags: ['Billing'],
  summary: 'Get org usage',
  description: "Get the current org's resource usage (projects, collaborators)",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: UsageResponseSchema } },
      description: 'Usage data',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No org found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const subscriptionRoute = createRoute({
  method: 'get',
  path: '/subscription',
  tags: ['Billing'],
  summary: 'Get subscription status',
  description: "Get the current org's billing status",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SubscriptionResponseSchema } },
      description: 'Subscription data',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No org found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

const membersRoute = createRoute({
  method: 'get',
  path: '/members',
  tags: ['Billing'],
  summary: 'Get org members',
  description: "Get the current org's members",
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: MembersResponseSchema } },
      description: 'Members list',
    },
    403: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'No org found',
    },
    500: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Database error',
    },
  },
});

// Route handlers
billingSubscriptionRoutes.use('*', requireAuth);

billingSubscriptionRoutes.openapi(usageRoute, async c => {
  const { user, session } = getAuth(c);

  if (!user || !session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 403);
  }

  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, 403);
    }

    const { getOrgResourceUsage } = await import('@/lib/billingResolver.js');
    const usage = await getOrgResourceUsage(db, orgId);

    return c.json(
      {
        projects: usage.projects,
        collaborators: usage.collaborators,
      },
      200,
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org usage:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_usage',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
});

billingSubscriptionRoutes.openapi(subscriptionRoute, async c => {
  const { user, session } = getAuth(c);

  if (!user || !session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 403);
  }

  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, 403);
    }

    const orgBilling = await resolveOrgAccess(db, orgId);

    const { projects } = await import('@/db/schema.js');
    const { eq, count } = await import('drizzle-orm');
    const [projectCountResult] = await db
      .select({ count: count() })
      .from(projects)
      .where(eq(projects.orgId, orgId));

    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId as GrantType)
      : getPlan(orgBilling.effectivePlanId);
    const currentPeriodEnd =
      orgBilling.subscription?.periodEnd ?
        orgBilling.subscription.periodEnd instanceof Date ?
          Math.floor(orgBilling.subscription.periodEnd.getTime() / 1000)
        : orgBilling.subscription.periodEnd
      : null;

    return c.json(
      {
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
      },
      200,
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org billing:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_billing',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
});

billingSubscriptionRoutes.openapi(membersRoute, async c => {
  const { user, session } = getAuth(c);

  if (!user || !session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return c.json(error, 403);
  }

  const db = createDb(c.env.DB);

  try {
    const orgId = await resolveOrgId({ db, session, userId: user.id });

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, 403);
    }

    const { createAuth } = await import('@/auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);
    const listMembersApi = auth.api as unknown as {
      listMembers: (_req: {
        headers: Headers;
        query: { organizationId: string };
      }) => Promise<{ members?: Array<Record<string, unknown>> }>;
    };
    const result = await listMembersApi.listMembers({
      headers: c.req.raw.headers,
      query: {
        organizationId: orgId,
      },
    });

    const members = (result.members || []) as z.infer<typeof MemberSchema>[];
    return c.json(
      {
        members,
        count: members.length,
      },
      200,
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org members:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_members',
      originalError: error.message,
    });
    return c.json(dbError, 500);
  }
});

export { billingSubscriptionRoutes };
