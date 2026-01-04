/**
 * Admin billing management routes
 * Handles org-scoped subscription and grant management
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { subscription, orgAccessGrants, organization } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import {
  createDomainError,
  VALIDATION_ERRORS,
  SYSTEM_ERRORS,
  AUTH_ERRORS,
} from '@corates/shared';
import { resolveOrgAccess } from '../../lib/billingResolver.js';
import {
  createGrant,
  getGrantById,
  getGrantByOrgIdAndType,
  updateGrantExpiresAt,
  revokeGrant,
  getGrantsByOrgId,
} from '../../db/orgAccessGrants.js';
import { getPlan, getGrantPlan } from '@corates/shared/plans';
import { validateRequest } from '../../config/validation.js';
import { z } from 'zod/v4';

const billingRoutes = new Hono();

// Validation schemas for admin billing endpoints
const adminBillingSchemas = {
  createSubscription: z.object({
    plan: z.enum(['starter_team', 'team', 'unlimited_team'], {
      errorMap: () => ({ message: 'Plan must be starter_team, team, or unlimited_team' }),
    }),
    status: z.enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid'], {
      errorMap: () => ({
        message: 'Status must be active, trialing, past_due, paused, canceled, or unpaid',
      }),
    }),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    stripeCustomerId: z.string().optional(),
    stripeSubscriptionId: z.string().optional(),
    cancelAtPeriodEnd: z.boolean().optional().default(false),
  }),

  updateSubscription: z.object({
    plan: z.enum(['starter_team', 'team', 'unlimited_team']).optional(),
    status: z
      .enum(['active', 'trialing', 'past_due', 'paused', 'canceled', 'unpaid', 'incomplete'])
      .optional(),
    periodStart: z.coerce.date().optional(),
    periodEnd: z.coerce.date().optional(),
    cancelAtPeriodEnd: z.boolean().optional(),
    canceledAt: z.coerce.date().optional().nullable(),
    endedAt: z.coerce.date().optional().nullable(),
  }),

  createGrant: z.object({
    type: z.enum(['trial', 'single_project'], {
      errorMap: () => ({ message: 'Type must be trial or single_project' }),
    }),
    startsAt: z.coerce.date(),
    expiresAt: z.coerce.date(),
    metadata: z.record(z.any()).optional(),
  }),

  updateGrant: z.object({
    expiresAt: z.coerce.date().optional(),
    revokedAt: z.coerce.date().optional().nullable(),
  }),
};

/**
 * GET /api/admin/orgs/:orgId/billing
 * Get org billing resolution and details
 */
billingRoutes.get('/orgs/:orgId/billing', async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
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
        getGrantPlan(orgBilling.effectivePlanId)
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
 * POST /api/admin/orgs/:orgId/subscriptions
 * Manually create a subscription for an org
 */
billingRoutes.post(
  '/orgs/:orgId/subscriptions',
  validateRequest(adminBillingSchemas.createSubscription),
  async c => {
    const orgId = c.req.param('orgId');
    const db = createDb(c.env.DB);
    const body = c.get('validatedBody');

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Validate plan
    const plan = getPlan(body.plan);
    if (!plan) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'plan',
        value: body.plan,
      });
      return c.json(error, error.statusCode);
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

    const createdSubscription = await db.insert(subscription).values(subscriptionData).returning().get();

    return c.json({ success: true, subscription: createdSubscription }, 201);
  } catch (error) {
    console.error('Error creating subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
  },
);

/**
 * PUT /api/admin/orgs/:orgId/subscriptions/:subscriptionId
 * Update a subscription
 */
billingRoutes.put(
  '/orgs/:orgId/subscriptions/:subscriptionId',
  validateRequest(adminBillingSchemas.updateSubscription),
  async c => {
    const orgId = c.req.param('orgId');
    const subscriptionId = c.req.param('subscriptionId');
    const db = createDb(c.env.DB);
    const body = c.get('validatedBody');

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
      return c.json(error, error.statusCode);
    }

    const updateData = {
      updatedAt: new Date(),
    };

    if (body.plan !== undefined) updateData.plan = body.plan;
    if (body.status !== undefined) updateData.status = body.status;
    if (body.periodStart !== undefined) updateData.periodStart = body.periodStart;
    if (body.periodEnd !== undefined) updateData.periodEnd = body.periodEnd;
    if (body.cancelAtPeriodEnd !== undefined)
      updateData.cancelAtPeriodEnd = body.cancelAtPeriodEnd;
    if (body.canceledAt !== undefined) updateData.canceledAt = body.canceledAt;
    if (body.endedAt !== undefined) updateData.endedAt = body.endedAt;

    const updatedSubscription = await db
      .update(subscription)
      .set(updateData)
      .where(eq(subscription.id, subscriptionId))
      .returning()
      .get();

    return c.json({ success: true, subscription: updatedSubscription });
  } catch (error) {
    console.error('Error updating subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
  },
);

/**
 * DELETE /api/admin/orgs/:orgId/subscriptions/:subscriptionId
 * Cancel/delete a subscription
 */
billingRoutes.delete('/orgs/:orgId/subscriptions/:subscriptionId', async c => {
  const orgId = c.req.param('orgId');
  const subscriptionId = c.req.param('subscriptionId');
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
      return c.json(error, error.statusCode);
    }

    // Cancel subscription (set status to canceled and endedAt)
    const now = new Date();
    await db
      .update(subscription)
      .set({
        status: 'canceled',
        endedAt: now,
        updatedAt: now,
      })
      .where(eq(subscription.id, subscriptionId));

    return c.json({ success: true, message: 'Subscription canceled' });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'cancel_subscription',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grants
 * Create a grant manually
 */
billingRoutes.post('/orgs/:orgId/grants', validateRequest(adminBillingSchemas.createGrant), async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);
  const body = c.get('validatedBody');

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Validate grant type
    if (body.type !== 'trial' && body.type !== 'single_project') {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'type',
        value: body.type,
      });
      return c.json(error, error.statusCode);
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
        return c.json(error, error.statusCode);
      }
    }

    // Validate dates
    if (body.expiresAt <= body.startsAt) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'expiresAt',
        value: 'expiresAt must be after startsAt',
      });
      return c.json(error, error.statusCode);
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
  } catch (error) {
    console.error('Error creating grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * PUT /api/admin/orgs/:orgId/grants/:grantId
 * Update a grant
 */
billingRoutes.put(
  '/orgs/:orgId/grants/:grantId',
  validateRequest(adminBillingSchemas.updateGrant),
  async c => {
    const orgId = c.req.param('orgId');
    const grantId = c.req.param('grantId');
    const db = createDb(c.env.DB);
    const body = c.get('validatedBody');

  try {
    // Verify grant exists and belongs to org
    const existingGrant = await getGrantById(db, grantId);
    if (!existingGrant || existingGrant.orgId !== orgId) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      });
      return c.json(error, error.statusCode);
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
    return c.json(error, error.statusCode);
  } catch (error) {
    console.error('Error updating grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'update_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
  },
);

/**
 * DELETE /api/admin/orgs/:orgId/grants/:grantId
 * Revoke a grant
 */
billingRoutes.delete('/orgs/:orgId/grants/:grantId', async c => {
  const orgId = c.req.param('orgId');
  const grantId = c.req.param('grantId');
  const db = createDb(c.env.DB);

  try {
    // Verify grant exists and belongs to org
    const existingGrant = await getGrantById(db, grantId);
    if (!existingGrant || existingGrant.orgId !== orgId) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'grantId',
        value: grantId,
      });
      return c.json(error, error.statusCode);
    }

    // Revoke grant
    await revokeGrant(db, grantId);

    return c.json({ success: true, message: 'Grant revoked' });
  } catch (error) {
    console.error('Error revoking grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'revoke_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grant-trial
 * Convenience endpoint to create a trial grant (14 days from now)
 */
billingRoutes.post('/orgs/:orgId/grant-trial', async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
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
      return c.json(error, error.statusCode);
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
  } catch (error) {
    console.error('Error creating trial grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_trial_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * POST /api/admin/orgs/:orgId/grant-single-project
 * Convenience endpoint to create a single_project grant (6 months from now)
 */
billingRoutes.post('/orgs/:orgId/grant-single-project', async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Check for existing single_project grant (extend if exists)
    const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');
    const now = new Date();

    if (existingGrant && !existingGrant.revokedAt) {
      // Extend existing grant by 6 months from max(now, expiresAt)
      const existingExpiresAtTimestamp = existingGrant.expiresAt instanceof Date ?
          Math.floor(existingGrant.expiresAt.getTime() / 1000)
        : existingGrant.expiresAt;
      const nowTimestamp = Math.floor(now.getTime() / 1000);
      const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
      const newExpiresAt = new Date(baseExpiresAt * 1000);
      newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

      const updatedGrant = await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);
      return c.json({ success: true, grant: updatedGrant, action: 'extended' });
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

    return c.json({ success: true, grant: createdGrant, action: 'created' }, 201);
  } catch (error) {
    console.error('Error creating single_project grant:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_single_project_grant',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { billingRoutes };
