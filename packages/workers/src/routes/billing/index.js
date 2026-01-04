/**
 * Billing routes for Hono
 * Handles org-scoped billing status (adapter for frontend compatibility)
 * Stripe subscription management is handled by Better Auth Stripe plugin
 */

import { Hono } from 'hono';
import { requireAuth, getAuth } from '../../middleware/auth.js';
import { createDb } from '../../db/client.js';
import { resolveOrgAccess } from '../../lib/billingResolver.js';
import { getPlan, DEFAULT_PLAN, getGrantPlan } from '@corates/shared/plans';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import Stripe from 'stripe';

const billingRoutes = new Hono();

/**
 * GET /api/billing/subscription
 * Get the current org's billing status (adapter for frontend compatibility)
 * Returns org-scoped billing resolution
 * Uses session's activeOrganizationId to determine the org
 */
billingRoutes.get('/subscription', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    // Get orgId from session's activeOrganizationId
    let orgId = session?.activeOrganizationId;

    // If no active org in session, get user's first org
    if (!orgId) {
      const { member } = await import('../../db/schema.js');
      const { eq } = await import('drizzle-orm');
      const firstMembership = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, user.id))
        .limit(1)
        .get();
      orgId = firstMembership?.organizationId;
    }

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'no_org_found',
      });
      return c.json(error, error.statusCode);
    }

    const orgBilling = await resolveOrgAccess(db, orgId);

    // Convert to frontend-compatible format
    // Use getGrantPlan for grants, getPlan for subscriptions/free
    const effectivePlan = orgBilling.source === 'grant' ?
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
 * GET /api/billing/plans
 * Get available subscription plans
 */
billingRoutes.get('/plans', async c => {
  // Return available plans with pricing info
  const { getPlan } = await import('@corates/shared/plans');
  const freePlan = getPlan('free');
  const starterTeamPlan = getPlan('starter_team');
  const teamPlan = getPlan('team');
  const unlimitedTeamPlan = getPlan('unlimited_team');

  return c.json({
    plans: [
      {
        tier: 'free',
        name: freePlan.name,
        description: 'For individuals getting started',
        price: { monthly: 0, yearly: 0 },
        features: ['Basic features', 'Limited projects', 'Community support'],
      },
      {
        tier: 'starter_team',
        name: starterTeamPlan.name,
        description: 'For small teams',
        price: { monthly: null, yearly: null }, // TODO: Update with actual prices
        features: [
          'Everything in Free',
          `${starterTeamPlan.quotas['projects.max']} projects`,
          `${starterTeamPlan.quotas['collaborators.org.max']} collaborators`,
          'Email support',
        ],
      },
      {
        tier: 'team',
        name: teamPlan.name,
        description: 'For collaborative research teams',
        price: { monthly: null, yearly: null }, // TODO: Update with actual prices
        features: [
          'Everything in Starter Team',
          `${teamPlan.quotas['projects.max']} projects`,
          `${teamPlan.quotas['collaborators.org.max']} collaborators`,
          'Priority support',
        ],
      },
      {
        tier: 'unlimited_team',
        name: unlimitedTeamPlan.name,
        description: 'For organizations with advanced needs',
        price: { monthly: null, yearly: null }, // TODO: Update with actual prices
        features: [
          'Everything in Team',
          'Unlimited projects',
          'Unlimited collaborators',
          'Dedicated support',
        ],
      },
    ],
  });
});

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout session (delegates to Better Auth Stripe plugin)
 * This endpoint is deprecated - use Better Auth Stripe client plugin directly
 */
billingRoutes.post('/checkout', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  // Get orgId from session's activeOrganizationId or first org
  let orgId = session?.activeOrganizationId;
  if (!orgId) {
    const { member } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
    // Check if user is org owner
    if (firstMembership?.role !== 'owner') {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_owner_required',
      });
      return c.json(error, error.statusCode);
    }
  } else {
    // Verify user is org owner
    const { member } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();
    if (membership?.role !== 'owner') {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_owner_required',
      });
      return c.json(error, error.statusCode);
    }
  }

  if (!orgId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'no_org_found',
    });
    return c.json(error, error.statusCode);
  }

  try {
    const body = await c.req.json();
    const { tier, interval = 'monthly' } = body;

    if (!tier || tier === DEFAULT_PLAN) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'tier',
        value: tier,
      });
      return c.json(error, error.statusCode);
    }

    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('../../auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.upgradeSubscription({
      headers: c.req.raw.headers,
      body: {
        plan: tier,
        annual: interval === 'yearly',
        referenceId: orgId,
        successUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing?success=true`,
        cancelUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing?canceled=true`,
      },
    });

    return c.json(result);
  } catch (error) {
    console.error('Error creating checkout session:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_checkout_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /api/billing/portal
 * Create a Stripe Customer Portal session (delegates to Better Auth Stripe plugin)
 */
billingRoutes.post('/portal', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  // Get orgId from session's activeOrganizationId or first org
  let orgId = session?.activeOrganizationId;
  if (!orgId) {
    const { member } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
    // Check if user is org owner
    if (firstMembership?.role !== 'owner') {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_owner_required',
      });
      return c.json(error, error.statusCode);
    }
  } else {
    // Verify user is org owner
    const { member } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();
    if (membership?.role !== 'owner') {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_owner_required',
      });
      return c.json(error, error.statusCode);
    }
  }

  if (!orgId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'no_org_found',
    });
    return c.json(error, error.statusCode);
  }

  try {
    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('../../auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);
    const result = await auth.api.createBillingPortal({
      headers: c.req.raw.headers,
      body: {
        referenceId: orgId,
        returnUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing`,
      },
    });

    return c.json(result);
  } catch (error) {
    console.error('Error creating portal session:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_portal_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /api/billing/single-project/checkout
 * Create a Stripe Checkout session for one-time Single Project purchase
 * Owner-gated: only org owners can purchase
 */
billingRoutes.post('/single-project/checkout', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  // Get orgId from session's activeOrganizationId or first org
  let orgId = session?.activeOrganizationId;
  let isOwner = false;

  if (!orgId) {
    const { member } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
    isOwner = firstMembership?.role === 'owner';
  } else {
    // Verify user is org owner
    const { member } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();
    isOwner = membership?.role === 'owner';
  }

  if (!orgId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'no_org_found',
    });
    return c.json(error, error.statusCode);
  }

  if (!isOwner) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'org_owner_required',
    });
    return c.json(error, error.statusCode);
  }

  try {
    if (!c.env.STRIPE_SECRET_KEY) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode);
    }

    // Get user's Stripe customer ID (required by Better Auth Stripe plugin)
    const db = createDb(c.env.DB);
    const { user: userTable } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const userRecord = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .get();

    if (!userRecord?.stripeCustomerId) {
      const error = createDomainError(
        SYSTEM_ERRORS.INTERNAL_ERROR,
        {
          operation: 'stripe_customer_not_found',
        },
        'Stripe customer ID not found. Please sign out and sign in again, or contact support.',
      );
      return c.json(error, error.statusCode);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Get single project price ID from env (or use a default)
    const priceId = c.env.STRIPE_PRICE_ID_SINGLE_PROJECT || 'price_single_project';

    const baseUrl = c.env.APP_URL || 'https://corates.org';
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer: userRecord.stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        orgId,
        grantType: 'single_project',
        purchaserUserId: user.id,
      },
      success_url: `${baseUrl}/settings/billing?success=true&purchase=single_project`,
      cancel_url: `${baseUrl}/settings/billing?canceled=true`,
    });

    return c.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    console.error('Error creating single-project checkout session:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_single_project_checkout',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /api/billing/purchases/webhook
 * Handle Stripe webhook events for one-time purchases (checkout.session.completed)
 * Separate from Better Auth Stripe plugin webhook which handles subscriptions
 */
billingRoutes.post('/purchases/webhook', async c => {
  try {
    if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    const signature = c.req.header('stripe-signature');
    if (!signature) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'missing_signature',
      });
      return c.json(error, error.statusCode);
    }

    const rawBody = await c.req.text();

    // Verify webhook signature
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        c.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'invalid_signature',
      });
      return c.json(error, error.statusCode);
    }

    // Handle checkout.session.completed for one-time purchases
    if (event.type === 'checkout.session.completed') {
      const session = event.data?.object;

      // Only process payment mode (one-time purchases), not subscription mode
      if (!session || session.mode !== 'payment') {
        return c.json({ received: true, skipped: 'not_payment_mode' });
      }

      // Verify metadata contains required fields
      const orgId = session.metadata?.orgId;
      const grantType = session.metadata?.grantType;
      if (!orgId || grantType !== 'single_project') {
        console.error('Invalid checkout session metadata:', session.metadata);
        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'metadata',
          value: session.metadata,
        });
        return c.json(error, error.statusCode);
      }

      const purchaserUserId = session.metadata?.purchaserUserId;

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        console.error('Checkout session not paid:', session.id, session.payment_status);
        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'payment_status',
          value: session.payment_status,
        });
        return c.json(error, error.statusCode);
      }

      const db = createDb(c.env.DB);
      const {
        getGrantByStripeCheckoutSessionId,
        getGrantByOrgIdAndType,
        createGrant,
        updateGrantExpiresAt,
      } = await import('../../db/orgAccessGrants.js');

      // Check for idempotency - if grant already exists for this checkout session, skip
      const existingGrantBySession = await getGrantByStripeCheckoutSessionId(db, session.id);
      if (existingGrantBySession) {
        console.log('Grant already exists for checkout session:', session.id);
        return c.json({ received: true, skipped: 'already_processed' });
      }

      const now = new Date();
      const nowTimestamp = Math.floor(now.getTime() / 1000);

      // Check if org already has a single_project grant (active or expired, but not revoked)
      const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');

      if (existingGrant && !existingGrant.revokedAt) {
        // Extension rule: expiresAt = max(now, currentExpiresAt) + 6 months
        const existingExpiresAtTimestamp = existingGrant.expiresAt instanceof Date ?
            Math.floor(existingGrant.expiresAt.getTime() / 1000)
          : existingGrant.expiresAt;

        const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
        const newExpiresAt = new Date(baseExpiresAt * 1000);
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

        await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);
        return c.json({ received: true, action: 'extended', grantId: existingGrant.id });
      }

      // Create new grant (6 months from now)
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 6);

      const grantId = crypto.randomUUID();
      await createGrant(db, {
        id: grantId,
        orgId,
        type: grantType,
        startsAt: now,
        expiresAt,
        stripeCheckoutSessionId: session.id,
        metadata: {
          purchaserUserId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        },
      });

      return c.json({ received: true, action: 'created', grantId });
    }

    // Ignore other event types
    return c.json({ received: true, skipped: 'event_type_not_handled' });
  } catch (error) {
    console.error('Error processing purchase webhook:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'process_purchase_webhook',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events
 * NOTE: Better Auth Stripe plugin handles webhooks at /api/auth/stripe/webhook
 * This endpoint is kept for backwards compatibility but should not be used
 */
billingRoutes.post('/webhook', async c => {
  // Redirect to Better Auth webhook endpoint
  const error = createDomainError(
    SYSTEM_ERRORS.INTERNAL_ERROR,
    {
      operation: 'webhook_deprecated',
    },
    'Webhooks are handled by Better Auth at /api/auth/stripe/webhook',
  );
  return c.json(error, error.statusCode);
});

/**
 * POST /api/billing/trial/start
 * Start a trial grant for the current org (owner-only)
 * Uniqueness: Only one trial grant per org (active, expired, or revoked)
 */
billingRoutes.post('/trial/start', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  // Get orgId from session's activeOrganizationId or first org
  let orgId = session?.activeOrganizationId;
  let isOwner = false;

  if (!orgId) {
    const { member } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const firstMembership = await db
      .select({ organizationId: member.organizationId, role: member.role })
      .from(member)
      .where(eq(member.userId, user.id))
      .limit(1)
      .get();
    orgId = firstMembership?.organizationId;
    isOwner = firstMembership?.role === 'owner';
  } else {
    // Verify user is org owner
    const { member } = await import('../../db/schema.js');
    const { eq, and } = await import('drizzle-orm');
    const membership = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();
    isOwner = membership?.role === 'owner';
  }

  if (!orgId) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'no_org_found',
    });
    return c.json(error, error.statusCode);
  }

  if (!isOwner) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'org_owner_required',
    });
    return c.json(error, error.statusCode);
  }

  try {
    const { getGrantByOrgIdAndType, createGrant } = await import('../../db/orgAccessGrants.js');

    // Check if trial grant already exists (uniqueness requirement)
    const existingTrial = await getGrantByOrgIdAndType(db, orgId, 'trial');
    if (existingTrial) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          field: 'trial',
          value: 'already_exists',
        },
        'Trial grant already exists for this organization. Each organization can only have one trial grant.',
      );
      return c.json(error, error.statusCode);
    }

    // Create trial grant (14 days from now)
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 14);

    const grantId = crypto.randomUUID();
    await createGrant(db, {
      id: grantId,
      orgId,
      type: 'trial',
      startsAt: now,
      expiresAt,
    });

    return c.json({
      success: true,
      grantId,
      expiresAt: Math.floor(expiresAt.getTime() / 1000),
    });
  } catch (error) {
    console.error('Error starting trial:', error);
    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'start_trial',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

export { billingRoutes };
