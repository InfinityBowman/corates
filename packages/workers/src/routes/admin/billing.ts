/**
 * Admin billing management routes
 * Handles org-scoped subscription and grant management
 */

import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import { subscription, orgAccessGrants, organization } from '@/db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { resolveOrgAccess } from '@/lib/billingResolver.js';
import {
  createGrant,
  getGrantById,
  getGrantByOrgIdAndType,
  updateGrantExpiresAt,
  revokeGrant,
  getGrantsByOrgId,
} from '@/db/orgAccessGrants.js';
import { getPlan, getGrantPlan, type GrantType } from '@corates/shared/plans';
import { notifyOrgMembers, EventTypes } from '@/lib/notify.js';
import { validationHook } from '@/lib/honoValidationHook.js';
import type { Env, AppVariables } from '../../types';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import type * as schema from '@/db/schema.js';

type Database = DrizzleD1Database<typeof schema>;

const billingRoutes = new OpenAPIHono<{ Bindings: Env; Variables: AppVariables }>({
  defaultHook: validationHook,
});

interface SubscriptionNotificationData {
  subscriptionId?: string;
  tier?: string;
  status?: string;
  periodEnd?: Date | number | null;
  cancelAtPeriodEnd?: boolean | number | null;
  endedAt?: Date | number | null;
}

/**
 * Helper to send subscription notifications asynchronously
 */
function notifySubscriptionChange(
  c: Context<{ Bindings: Env; Variables: AppVariables }>,
  db: Database,
  orgId: string,
  subscriptionData: SubscriptionNotificationData,
  action: string,
) {
  if (!c.executionCtx?.waitUntil) return;

  c.executionCtx.waitUntil(
    (async () => {
      try {
        const result = await notifyOrgMembers(c.env, db, orgId, {
          type: EventTypes.SUBSCRIPTION_UPDATED,
          data: subscriptionData as Record<string, unknown>,
        });
        console.log(`[Admin] Subscription ${action} notification sent:`, {
          orgId,
          subscriptionId: subscriptionData.subscriptionId || subscriptionData.tier,
          notified: result.notified,
          failed: result.failed,
        });
      } catch (err) {
        const error = err as Error;
        console.error(`[Admin] Subscription ${action} notification error:`, {
          orgId,
          error: error.message,
        });
      }
    })(),
  );
}

// Response schemas
const PlanDetailsSchema = z
  .object({
    name: z.string(),
    entitlements: z.record(z.string(), z.boolean()).optional(),
    quotas: z.record(z.string(), z.number()).optional(),
  })
  .openapi('AdminBillingPlanDetails');

const BillingInfoSchema = z
  .object({
    effectivePlanId: z.string(),
    source: z.string(),
    accessMode: z.string(),
    plan: PlanDetailsSchema,
    subscription: z.record(z.string(), z.unknown()).nullable(),
    grant: z.record(z.string(), z.unknown()).nullable(),
  })
  .openapi('AdminBillingInfo');

const SubscriptionSchema = z
  .object({
    id: z.string(),
    plan: z.string(),
    referenceId: z.string(),
    stripeCustomerId: z.string().nullable(),
    stripeSubscriptionId: z.string().nullable(),
    status: z.string(),
    periodStart: z.union([z.string(), z.date(), z.number()]).nullable(),
    periodEnd: z.union([z.string(), z.date(), z.number()]).nullable(),
    cancelAtPeriodEnd: z.union([z.boolean(), z.number()]).nullable(),
    cancelAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    canceledAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    endedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    updatedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
  })
  .openapi('AdminSubscription');

const GrantSchema = z
  .object({
    id: z.string(),
    orgId: z.string(),
    type: z.string(),
    startsAt: z.union([z.string(), z.date(), z.number()]),
    expiresAt: z.union([z.string(), z.date(), z.number()]),
    createdAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    revokedAt: z.union([z.string(), z.date(), z.number()]).nullable(),
    metadata: z.string().nullable(),
  })
  .openapi('AdminGrant');

const BillingResponseSchema = z
  .object({
    orgId: z.string(),
    orgName: z.string(),
    orgSlug: z.string().nullable(),
    billing: BillingInfoSchema,
    subscriptions: z.array(SubscriptionSchema),
    grants: z.array(GrantSchema),
  })
  .openapi('AdminBillingResponse');

const SubscriptionSuccessResponseSchema = z
  .object({
    success: z.boolean(),
    subscription: SubscriptionSchema,
  })
  .openapi('SubscriptionSuccessResponse');

const GrantSuccessResponseSchema = z
  .object({
    success: z.boolean(),
    grant: GrantSchema,
    action: z.enum(['created', 'extended']).optional(),
  })
  .openapi('GrantSuccessResponse');

const SuccessMessageResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string(),
  })
  .openapi('AdminBillingSuccessMessage');

const BillingErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('AdminBillingError');

// Request schemas
const CreateSubscriptionBodySchema = z.object({
  plan: z
    .enum(['starter_team', 'team', 'unlimited_team'])
    .openapi({ description: 'Subscription plan' }),
  status: z
    .enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid'])
    .openapi({ description: 'Subscription status' }),
  periodStart: z.coerce.date().optional().openapi({ description: 'Period start date' }),
  periodEnd: z.coerce.date().optional().openapi({ description: 'Period end date' }),
  stripeCustomerId: z.string().optional().openapi({ description: 'Stripe customer ID' }),
  stripeSubscriptionId: z.string().optional().openapi({ description: 'Stripe subscription ID' }),
  cancelAtPeriodEnd: z
    .boolean()
    .optional()
    .default(false)
    .openapi({ description: 'Cancel at period end' }),
});

const UpdateSubscriptionBodySchema = z.object({
  plan: z
    .enum(['starter_team', 'team', 'unlimited_team'])
    .optional()
    .openapi({ description: 'Subscription plan' }),
  status: z
    .enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid', 'incomplete'])
    .optional()
    .openapi({ description: 'Subscription status' }),
  periodStart: z.coerce.date().optional().openapi({ description: 'Period start date' }),
  periodEnd: z.coerce.date().optional().openapi({ description: 'Period end date' }),
  cancelAtPeriodEnd: z.boolean().optional().openapi({ description: 'Cancel at period end' }),
  canceledAt: z.coerce.date().optional().nullable().openapi({ description: 'Canceled at date' }),
  endedAt: z.coerce.date().optional().nullable().openapi({ description: 'Ended at date' }),
});

const CreateGrantBodySchema = z.object({
  type: z.enum(['trial', 'single_project']).openapi({ description: 'Grant type' }),
  startsAt: z.coerce.date().openapi({ description: 'Grant start date' }),
  expiresAt: z.coerce.date().openapi({ description: 'Grant expiration date' }),
  metadata: z
    .record(z.string(), z.unknown())
    .optional()
    .openapi({ description: 'Optional metadata' }),
});

const UpdateGrantBodySchema = z.object({
  expiresAt: z.coerce.date().optional().openapi({ description: 'New expiration date' }),
  revokedAt: z.coerce
    .date()
    .optional()
    .nullable()
    .openapi({ description: 'Revoke date (null to unrevoke)' }),
});

// Route definitions
const getBillingRoute = createRoute({
  method: 'get',
  path: '/orgs/{orgId}/billing',
  tags: ['Admin - Billing'],
  summary: 'Get org billing',
  description: 'Get org billing resolution and details. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Billing details',
      content: {
        'application/json': {
          schema: BillingResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid org ID',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const createSubscriptionRoute = createRoute({
  method: 'post',
  path: '/orgs/{orgId}/subscriptions',
  tags: ['Admin - Billing'],
  summary: 'Create subscription',
  description: 'Manually create a subscription for an org. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateSubscriptionBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Subscription created',
      content: {
        'application/json': {
          schema: SubscriptionSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const updateSubscriptionRoute = createRoute({
  method: 'put',
  path: '/orgs/{orgId}/subscriptions/{subscriptionId}',
  tags: ['Admin - Billing'],
  summary: 'Update subscription',
  description: 'Update a subscription. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
      subscriptionId: z.string().openapi({ description: 'Subscription ID', example: 'sub-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateSubscriptionBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Subscription updated',
      content: {
        'application/json': {
          schema: SubscriptionSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const deleteSubscriptionRoute = createRoute({
  method: 'delete',
  path: '/orgs/{orgId}/subscriptions/{subscriptionId}',
  tags: ['Admin - Billing'],
  summary: 'Cancel subscription',
  description: 'Cancel/delete a subscription. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
      subscriptionId: z.string().openapi({ description: 'Subscription ID', example: 'sub-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Subscription canceled',
      content: {
        'application/json': {
          schema: SuccessMessageResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid subscription ID',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const createGrantRoute = createRoute({
  method: 'post',
  path: '/orgs/{orgId}/grants',
  tags: ['Admin - Billing'],
  summary: 'Create grant',
  description: 'Create a grant manually. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: CreateGrantBodySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Grant created',
      content: {
        'application/json': {
          schema: GrantSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const updateGrantRoute = createRoute({
  method: 'put',
  path: '/orgs/{orgId}/grants/{grantId}',
  tags: ['Admin - Billing'],
  summary: 'Update grant',
  description: 'Update a grant. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
      grantId: z.string().openapi({ description: 'Grant ID', example: 'grant-123' }),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateGrantBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Grant updated',
      content: {
        'application/json': {
          schema: GrantSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const deleteGrantRoute = createRoute({
  method: 'delete',
  path: '/orgs/{orgId}/grants/{grantId}',
  tags: ['Admin - Billing'],
  summary: 'Revoke grant',
  description: 'Revoke a grant. Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
      grantId: z.string().openapi({ description: 'Grant ID', example: 'grant-123' }),
    }),
  },
  responses: {
    200: {
      description: 'Grant revoked',
      content: {
        'application/json': {
          schema: SuccessMessageResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid grant ID',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const grantTrialRoute = createRoute({
  method: 'post',
  path: '/orgs/{orgId}/grant-trial',
  tags: ['Admin - Billing'],
  summary: 'Grant trial',
  description: 'Convenience endpoint to create a trial grant (14 days). Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
  },
  responses: {
    201: {
      description: 'Trial grant created',
      content: {
        'application/json': {
          schema: GrantSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Trial already exists or invalid org',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

const grantSingleProjectRoute = createRoute({
  method: 'post',
  path: '/orgs/{orgId}/grant-single-project',
  tags: ['Admin - Billing'],
  summary: 'Grant single project',
  description: 'Convenience endpoint to create a single_project grant (6 months). Admin only.',
  request: {
    params: z.object({
      orgId: z.string().openapi({ description: 'Organization ID', example: 'org-123' }),
    }),
  },
  responses: {
    201: {
      description: 'Single project grant created or extended',
      content: {
        'application/json': {
          schema: GrantSuccessResponseSchema,
        },
      },
    },
    200: {
      description: 'Existing grant extended',
      content: {
        'application/json': {
          schema: GrantSuccessResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid org',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
    500: {
      description: 'Database error',
      content: {
        'application/json': {
          schema: BillingErrorSchema,
        },
      },
    },
  },
});

/**
 * GET /api/admin/orgs/:orgId/billing
 * Get org billing resolution and details
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(getBillingRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Get billing resolution
    const orgBilling = await resolveOrgAccess(db, orgId);

    // Get all subscriptions for this org
    const allSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, orgId))
      .orderBy(desc(subscription.createdAt))
      .all();

    // Get all grants for this org
    const allGrants = await getGrantsByOrgId(db, orgId);

    // Format response
    const effectivePlan =
      orgBilling.source === 'grant' ?
        getGrantPlan(orgBilling.effectivePlanId as GrantType)
      : getPlan(orgBilling.effectivePlanId);

    return c.json({
      orgId,
      orgName: org.name,
      orgSlug: org.slug,
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
      subscriptions: allSubscriptions,
      grants: allGrants,
    });
  } catch (err) {
    const error = err as Error;
    console.error('Error fetching org billing:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_org_billing',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/subscriptions
 * Manually create a subscription for an org
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(createSubscriptionRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Validate plan
    const plan = getPlan(body.plan);
    if (!plan) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'plan',
        value: body.plan,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const subscriptionId = crypto.randomUUID();
    const now = new Date();

    const subscriptionData = {
      id: subscriptionId,
      plan: body.plan,
      referenceId: orgId,
      status: body.status,
      stripeCustomerId: body.stripeCustomerId || null,
      stripeSubscriptionId: body.stripeSubscriptionId || null,
      periodStart: body.periodStart || now,
      periodEnd: body.periodEnd || null,
      cancelAtPeriodEnd: body.cancelAtPeriodEnd || false,
      createdAt: now,
      updatedAt: now,
    };

    const createdSubscription = await db
      .insert(subscription)
      .values(subscriptionData)
      .returning()
      .get();

    // Notify org members about the new subscription (async, don't block response)
    notifySubscriptionChange(
      c,
      db,
      orgId,
      {
        subscriptionId: createdSubscription.id,
        tier: createdSubscription.plan,
        status: createdSubscription.status,
        periodEnd: createdSubscription.periodEnd,
      },
      'creation',
    );

    return c.json({ success: true, subscription: createdSubscription }, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error creating subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId
 * Update a subscription
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(updateSubscriptionRoute, async c => {
  const { orgId, subscriptionId } = c.req.valid('param');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  try {
    // Verify subscription exists and belongs to org
    const existingSubscription = await db
      .select()
      .from(subscription)
      .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
      .get();

    if (!existingSubscription) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'subscriptionId',
        value: subscriptionId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.periodStart !== undefined) updateData.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updateData.periodEnd = body.periodEnd;
    if (body.cancelAtPeriodEnd !== undefined) updateData.cancelAtPeriodEnd = body.cancelAtPeriodEnd;
    if (body.canceledAt !== undefined) updateData.canceledAt = body.canceledAt;
    if (body.endedAt !== undefined) updateData.endedAt = body.endedAt;

    const updatedSubscription = await db
      .update(subscription)
      .set(updateData)
      .where(eq(subscription.id, subscriptionId))
      .returning()
      .get();

    // Notify org members about the subscription update (async, don't block response)
    notifySubscriptionChange(
      c,
      db,
      orgId,
      {
        subscriptionId: updatedSubscription.id,
        tier: updatedSubscription.plan,
        status: updatedSubscription.status,
        periodEnd: updatedSubscription.periodEnd,
        cancelAtPeriodEnd: updatedSubscription.cancelAtPeriodEnd,
      },
      'update',
    );

    return c.json({ success: true, subscription: updatedSubscription });
  } catch (err) {
    const error = err as Error;
    console.error('Error updating subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/admin/orgs/:orgId/subscriptions/:subscriptionId
 * Cancel/delete a subscription
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(deleteSubscriptionRoute, async c => {
  const { orgId, subscriptionId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify subscription exists and belongs to org
    const existingSubscription = await db
      .select()
      .from(subscription)
      .where(and(eq(subscription.id, subscriptionId), eq(subscription.referenceId, orgId)))
      .get();

    if (!existingSubscription) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'subscriptionId',
        value: subscriptionId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Cancel subscription (set status to canceled and endedAt)
    const now = new Date();
    const canceledSubscription = await db
      .update(subscription)
      .set({
        status: 'canceled',
        endedAt: now,
        updatedAt: now,
      })
      .where(eq(subscription.id, subscriptionId))
      .returning()
      .get();

    // Notify org members about the subscription cancellation (async, don't block response)
    notifySubscriptionChange(
      c,
      db,
      orgId,
      {
        subscriptionId,
        tier: canceledSubscription.plan,
        status: 'canceled',
        periodEnd: canceledSubscription.periodEnd,
        endedAt: canceledSubscription.endedAt,
      },
      'cancellation',
    );

    return c.json({ success: true, message: 'Subscription canceled' });
  } catch (err) {
    const error = err as Error;
    console.error('Error canceling subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'cancel_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grants
 * Create a grant manually
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(createGrantRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Validate grant type
    if (body.type !== 'trial' && body.type !== 'single_project') {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'type',
        value: body.type,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Enforce trial uniqueness
    if (body.type === 'trial') {
      const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
      if (existingTrial) {
        const error = createDomainError(
          VALIDATION_ERRORS.INVALID_INPUT,
          {
            field: 'type',
            value: 'trial',
          },
          'Trial grant already exists for this organization. Each organization can only have one trial grant.',
        );
        return c.json(error, error.statusCode as ContentfulStatusCode);
      }
    }

    // Validate dates
    if (body.expiresAt <= body.startsAt) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'expiresAt',
        value: 'expiresAt must be after startsAt',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const grantId = crypto.randomUUID();
    const createdGrant = await createGrant(db, {
      id: grantId,
      orgId,
      type: body.type,
      startsAt: body.startsAt,
      expiresAt: body.expiresAt,
      metadata: body.metadata || null,
    });

    return c.json({ success: true, grant: createdGrant }, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error creating grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * PUT /api/admin/orgs/:orgId/grants/:grantId
 * Update a grant
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(updateGrantRoute, async c => {
  const { orgId, grantId } = c.req.valid('param');
  const db = createDb(c.env.DB);
  const body = c.req.valid('json');

  try {
    // Verify grant exists and belongs to org
    const existingGrant = await getGrantById(db, grantId);
    if (!existingGrant || existingGrant.orgId !== orgId) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Update grant
    if (body.expiresAt !== undefined) {
      const updatedGrant = await updateGrantExpiresAt(db, grantId, body.expiresAt);
      return c.json({ success: true, grant: updatedGrant });
    }

    if (body.revokedAt !== undefined) {
      if (body.revokedAt === null) {
        // Unrevoke (set revokedAt to null) - need to update directly
        const result = await db
          .update(orgAccessGrants)
          .set({ revokedAt: null })
          .where(eq(orgAccessGrants.id, grantId))
          .returning()
          .get();
        return c.json({ success: true, grant: result });
      } else {
        // Revoke
        const revokedGrant = await revokeGrant(db, grantId);
        return c.json({ success: true, grant: revokedGrant });
      }
    }

    // No updates provided
    const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
      field: 'body',
      value: 'At least one field (expiresAt or revokedAt) must be provided',
    });
    return c.json(error, error.statusCode as ContentfulStatusCode);
  } catch (err) {
    const error = err as Error;
    console.error('Error updating grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * DELETE /api/admin/orgs/:orgId/grants/:grantId
 * Revoke a grant
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(deleteGrantRoute, async c => {
  const { orgId, grantId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify grant exists and belongs to org
    const existingGrant = await getGrantById(db, grantId);
    if (!existingGrant || existingGrant.orgId !== orgId) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Revoke grant
    await revokeGrant(db, grantId);

    return c.json({ success: true, message: 'Grant revoked' });
  } catch (err) {
    const error = err as Error;
    console.error('Error revoking grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grant-trial
 * Convenience endpoint to create a trial grant (14 days from now)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(grantTrialRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check for existing trial
    const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
    if (existingTrial) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          field: 'trial',
          value: 'already_exists',
        },
        'Trial grant already exists for this organization.',
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    const grantId = crypto.randomUUID();
    const createdGrant = await createGrant(db, {
      id: grantId,
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
      metadata: { createdBy: 'admin' },
    });

    return c.json({ success: true, grant: createdGrant }, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error creating trial grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_trial_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grant-single-project
 * Convenience endpoint to create a single_project grant (6 months from now)
 */
// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingRoutes.openapi(grantSingleProjectRoute, async c => {
  const { orgId } = c.req.valid('param');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check for existing single_project grant (extend if exists)
    const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');
    const now = new Date();

    if (existingGrant && !existingGrant.revokedAt) {
      // Extend existing grant by 6 months from max(now, expiresAt)
      const existingExpiresAtTimestamp =
        existingGrant.expiresAt instanceof Date ?
          Math.floor(existingGrant.expiresAt.getTime() / 1000)
        : (existingGrant.expiresAt as number);
      const nowTimestamp = Math.floor(now.getTime() / 1000);
      const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
      const newExpiresAt = new Date(baseExpiresAt * 1000);
      newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

      const updatedGrant = await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);
      return c.json({ success: true, grant: updatedGrant, action: 'extended' as const });
    }

    // Create new grant (6 months from now)
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const grantId = crypto.randomUUID();
    const createdGrant = await createGrant(db, {
      id: grantId,
      orgId,
      type: 'single_project',
      startsAt: now,
      expiresAt,
      metadata: { createdBy: 'admin' },
    });

    return c.json({ success: true, grant: createdGrant, action: 'created' as const }, 201);
  } catch (err) {
    const error = err as Error;
    console.error('Error creating single_project grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_single_project_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode as ContentfulStatusCode);
  }
});

export { billingRoutes };
