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
import { createLogger, sha256, truncateError, withTiming } from '../../lib/observability/logger.js';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  updateLedgerStatus,
  getLedgerByPayloadHash,
  LedgerStatus,
} from '../../db/stripeEventLedger.js';
import { billingCheckoutRateLimit, billingPortalRateLimit } from '../../middleware/rateLimit.js';

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
 * GET /api/billing/members
 * Get the current org's members (uses session's activeOrganizationId)
 * Returns list of members with count
 */
billingRoutes.get('/members', requireAuth, async c => {
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

    // Use Better Auth API to list members (consistent with orgs endpoint)
    const { createAuth } = await import('../../auth/config.js');
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

/**
 * POST /api/billing/checkout
 * Create a Stripe Checkout session (delegates to Better Auth Stripe plugin)
 * This endpoint is deprecated - use Better Auth Stripe client plugin directly
 */
billingRoutes.post('/checkout', billingCheckoutRateLimit, requireAuth, async c => {
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

  const logger = createLogger({ c, service: 'billing', env: c.env });

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

    // Log checkout initiation
    logger.stripe('checkout_initiated', {
      orgId,
      userId: user.id,
      plan: tier,
      interval,
    });

    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('../../auth/config.js');
    const auth = createAuth(c.env, c.executionCtx);

    const { result, durationMs } = await withTiming(async () => {
      return auth.api.upgradeSubscription({
        headers: c.req.raw.headers,
        body: {
          plan: tier,
          annual: interval === 'yearly',
          referenceId: orgId,
          successUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing?success=true`,
          cancelUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing?canceled=true`,
        },
      });
    });

    // Log checkout created
    logger.stripe('checkout_created', {
      outcome: 'success',
      orgId,
      userId: user.id,
      plan: tier,
      interval,
      durationMs,
      // Extract any identifiers from the result if available
      stripeCheckoutSessionId: result?.url?.includes('cs_') ? result.url.split('/').pop() : null,
    });

    return c.json(result);
  } catch (error) {
    logger.stripe('checkout_failed', {
      outcome: 'failed',
      orgId,
      userId: user.id,
      error: truncateError(error),
      errorCode: error.code || 'unknown',
    });

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
billingRoutes.post('/portal', billingPortalRateLimit, requireAuth, async c => {
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
billingRoutes.post('/single-project/checkout', billingCheckoutRateLimit, requireAuth, async c => {
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

  const logger = createLogger({ c, service: 'billing', env: c.env });

  try {
    if (!c.env.STRIPE_SECRET_KEY) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode);
    }

    // Log checkout initiation
    logger.stripe('single_project_checkout_initiated', {
      orgId,
      userId: user.id,
      plan: 'single_project',
    });

    // Get user's Stripe customer ID (required by Better Auth Stripe plugin)
    const dbForUser = createDb(c.env.DB);
    const { user: userTable } = await import('../../db/schema.js');
    const { eq } = await import('drizzle-orm');
    const userRecord = await dbForUser
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, user.id))
      .get();

    if (!userRecord?.stripeCustomerId) {
      logger.stripe('single_project_checkout_failed', {
        outcome: 'failed',
        orgId,
        userId: user.id,
        errorCode: 'stripe_customer_not_found',
      });

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

    // Generate idempotency key to prevent duplicate checkout sessions from rapid clicks
    // Uses 1-minute time window granularity
    const idempotencyKey = `sp_checkout_${orgId}_${user.id}_${Math.floor(Date.now() / 60000)}`;

    const { result: checkoutSession, durationMs } = await withTiming(async () => {
      return stripe.checkout.sessions.create(
        {
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
        },
        {
          idempotencyKey,
        },
      );
    });

    logger.stripe('single_project_checkout_created', {
      outcome: 'success',
      orgId,
      userId: user.id,
      plan: 'single_project',
      stripeCheckoutSessionId: checkoutSession.id,
      stripeCustomerId: userRecord.stripeCustomerId,
      durationMs,
    });

    return c.json({
      url: checkoutSession.url,
      sessionId: checkoutSession.id,
    });
  } catch (error) {
    logger.stripe('single_project_checkout_failed', {
      outcome: 'failed',
      orgId,
      userId: user.id,
      error: truncateError(error),
      errorCode: error.code || 'unknown',
    });

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
 * Uses two-phase trust model for ledger: trust-minimal on receipt, verified after signature check
 */
billingRoutes.post('/purchases/webhook', async c => {
  const logger = createLogger({ c, service: 'billing-purchases-webhook', env: c.env });
  const db = createDb(c.env.DB);
  const route = '/api/billing/purchases/webhook';

  let rawBody;
  let ledgerId;
  let payloadHash;

  try {
    if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET_PURCHASES) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Phase 1: Read request and store trust-minimal fields
    const signature = c.req.header('stripe-signature');
    const signaturePresent = !!signature;

    // Read raw body
    try {
      rawBody = await c.req.text();
    } catch (bodyError) {
      // Body unreadable - insert ledger entry and return 400
      ledgerId = crypto.randomUUID();
      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash: 'unreadable_body',
        signaturePresent: false,
        route,
        requestId: logger.requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: truncateError(bodyError),
        httpStatus: 400,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'body_unreadable',
        error: bodyError,
      });

      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'body_unreadable',
      });
      return c.json(error, 400);
    }

    // If signature header is missing, insert ledger and return 403
    if (!signaturePresent) {
      ledgerId = crypto.randomUUID();
      payloadHash = await sha256(rawBody);

      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash,
        signaturePresent: false,
        route,
        requestId: logger.requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'missing_signature',
        httpStatus: 403,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'missing_signature',
        payloadHash,
        signaturePresent: false,
      });

      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'missing_signature',
      });
      return c.json(error, error.statusCode);
    }

    // Compute payload hash for dedupe
    payloadHash = await sha256(rawBody);

    // Check for duplicate by payload hash
    const existingEntry = await getLedgerByPayloadHash(db, payloadHash);
    if (existingEntry) {
      logger.stripe('webhook_dedupe', {
        outcome: 'skipped_duplicate',
        payloadHash,
        existingLedgerId: existingEntry.id,
        existingStatus: existingEntry.status,
      });

      return c.json({ received: true, skipped: 'duplicate_payload' }, 200);
    }

    // Insert ledger entry with trust-minimal fields
    ledgerId = crypto.randomUUID();
    await insertLedgerEntry(db, {
      id: ledgerId,
      payloadHash,
      signaturePresent: true,
      route,
      requestId: logger.requestId,
      status: LedgerStatus.RECEIVED,
    });

    logger.stripe('webhook_received', {
      payloadHash,
      signaturePresent: true,
      ledgerId,
    });

    // Phase 2: Verify signature and process
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        c.env.STRIPE_WEBHOOK_SECRET_PURCHASES,
      );
    } catch (err) {
      // Signature verification failed
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'invalid_signature',
        httpStatus: 403,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'invalid_signature',
        payloadHash,
        error: truncateError(err),
      });

      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'invalid_signature',
      });
      return c.json(error, error.statusCode);
    }

    // Signature verified - now we can trust the parsed event
    const stripeEventId = event.id;
    const eventType = event.type;
    const livemode = event.livemode;
    const apiVersion = event.api_version;
    const created = event.created ? new Date(event.created * 1000) : null;

    // Handle checkout.session.completed for one-time purchases
    if (eventType === 'checkout.session.completed') {
      const session = event.data?.object;

      // Only process payment mode (one-time purchases), not subscription mode
      if (!session || session.mode !== 'payment') {
        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.PROCESSED,
          httpStatus: 200,
          stripeCheckoutSessionId: session?.id,
        });

        logger.stripe('webhook_skipped', {
          outcome: 'skipped',
          stripeEventId,
          stripeEventType: eventType,
          reason: 'not_payment_mode',
          payloadHash,
        });

        return c.json({ received: true, skipped: 'not_payment_mode' });
      }

      // Verify metadata contains required fields
      const orgId = session.metadata?.orgId;
      const grantType = session.metadata?.grantType;
      if (!orgId || grantType !== 'single_project') {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: 'invalid_metadata',
          httpStatus: 400,
        });

        logger.stripe('webhook_failed', {
          outcome: 'failed',
          stripeEventId,
          stripeEventType: eventType,
          errorCode: 'invalid_metadata',
          payloadHash,
        });

        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'metadata',
          value: session.metadata,
        });
        return c.json(error, error.statusCode);
      }

      const purchaserUserId = session.metadata?.purchaserUserId;

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: `payment_not_paid:${session.payment_status}`,
          httpStatus: 400,
        });

        logger.stripe('webhook_failed', {
          outcome: 'failed',
          stripeEventId,
          stripeEventType: eventType,
          errorCode: 'payment_not_paid',
          payloadHash,
        });

        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'payment_status',
          value: session.payment_status,
        });
        return c.json(error, error.statusCode);
      }

      const {
        getGrantByStripeCheckoutSessionId,
        getGrantByOrgIdAndType,
        createGrant,
        updateGrantExpiresAt,
      } = await import('../../db/orgAccessGrants.js');

      // Check for idempotency - if grant already exists for this checkout session, skip
      const existingGrantBySession = await getGrantByStripeCheckoutSessionId(db, session.id);
      if (existingGrantBySession) {
        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.SKIPPED_DUPLICATE,
          httpStatus: 200,
          orgId,
          stripeCustomerId: session.customer,
          stripeCheckoutSessionId: session.id,
        });

        logger.stripe('webhook_skipped', {
          outcome: 'skipped_duplicate',
          stripeEventId,
          stripeEventType: eventType,
          reason: 'already_processed',
          orgId,
          stripeCheckoutSessionId: session.id,
          payloadHash,
        });

        return c.json({ received: true, skipped: 'already_processed' });
      }

      const now = new Date();
      const nowTimestamp = Math.floor(now.getTime() / 1000);

      // Check if org already has a single_project grant (active or expired, but not revoked)
      const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');

      if (existingGrant && !existingGrant.revokedAt) {
        // Extension rule: expiresAt = max(now, currentExpiresAt) + 6 months
        const existingExpiresAtTimestamp =
          existingGrant.expiresAt instanceof Date ?
            Math.floor(existingGrant.expiresAt.getTime() / 1000)
          : existingGrant.expiresAt;

        const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
        const newExpiresAt = new Date(baseExpiresAt * 1000);
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

        await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);

        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.PROCESSED,
          httpStatus: 200,
          orgId,
          stripeCustomerId: session.customer,
          stripeCheckoutSessionId: session.id,
        });

        logger.stripe('webhook_processed', {
          outcome: 'processed',
          action: 'extended',
          stripeEventId,
          stripeEventType: eventType,
          orgId,
          userId: purchaserUserId,
          stripeCheckoutSessionId: session.id,
          grantId: existingGrant.id,
          payloadHash,
        });

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

      await updateLedgerWithVerifiedFields(db, ledgerId, {
        stripeEventId,
        type: eventType,
        livemode,
        apiVersion,
        created,
        status: LedgerStatus.PROCESSED,
        httpStatus: 200,
        orgId,
        stripeCustomerId: session.customer,
        stripeCheckoutSessionId: session.id,
      });

      logger.stripe('webhook_processed', {
        outcome: 'processed',
        action: 'created',
        stripeEventId,
        stripeEventType: eventType,
        orgId,
        userId: purchaserUserId,
        stripeCheckoutSessionId: session.id,
        grantId,
        payloadHash,
      });

      return c.json({ received: true, action: 'created', grantId });
    }

    // Other event types - record but don't process
    await updateLedgerWithVerifiedFields(db, ledgerId, {
      stripeEventId,
      type: eventType,
      livemode,
      apiVersion,
      created,
      status: LedgerStatus.PROCESSED,
      httpStatus: 200,
    });

    logger.stripe('webhook_skipped', {
      outcome: 'skipped',
      stripeEventId,
      stripeEventType: eventType,
      reason: 'event_type_not_handled',
      payloadHash,
    });

    return c.json({ received: true, skipped: 'event_type_not_handled' });
  } catch (error) {
    logger.error('Purchase webhook handler error', {
      error: truncateError(error),
      ledgerId,
      payloadHash,
    });

    // Update ledger if we have an entry
    if (ledgerId) {
      try {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: truncateError(error),
          httpStatus: 500,
        });
      } catch {
        // Ignore ledger update errors in error handler
      }
    }

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
