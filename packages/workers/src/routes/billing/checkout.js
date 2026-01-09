/**
 * Billing checkout routes
 * Handles Stripe Checkout session creation for subscriptions and one-time purchases
 */
import { Hono } from 'hono';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDb } from '@/db/client.js';
import { validatePlanChange } from '@/lib/billingResolver.js';
import { DEFAULT_PLAN } from '@corates/shared/plans';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import Stripe from 'stripe';
import { createLogger, truncateError, withTiming } from '@/lib/observability/logger.js';
import { billingCheckoutRateLimit } from '@/middleware/rateLimit.js';
import { billingSchemas, validateRequest } from '@/config/validation.js';
import { resolveOrgIdWithRole } from './helpers/orgContext.js';
import { requireOrgOwner } from './helpers/ownerGate.js';

const billingCheckoutRoutes = new Hono();

/**
 * POST /validate-coupon
 * Validate a promotion code and return discount details
 */
billingCheckoutRoutes.post(
  '/validate-coupon',
  requireAuth,
  validateRequest(billingSchemas.validateCoupon),
  async c => {
    const logger = createLogger({ c, service: 'billing', env: c.env });

    try {
      const { code } = c.get('validatedBody');

      if (!c.env.STRIPE_SECRET_KEY) {
        logger.error('validate_coupon_failed', { error: 'Stripe not configured' });
        return c.json({ valid: false, error: 'Payment system not available' });
      }

      const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
        apiVersion: '2025-11-17.clover',
      });

      // Look up promotion code (user-facing codes)
      const promoCodes = await stripe.promotionCodes.list({
        code: code,
        active: true,
        limit: 1,
      });

      if (promoCodes.data.length === 0) {
        logger.info('validate_coupon_invalid', { code: code.trim() });
        return c.json({ valid: false, error: 'Invalid or expired promo code' });
      }

      const promo = promoCodes.data[0];
      const coupon = promo.coupon;

      // Check if expired
      if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) {
        return c.json({ valid: false, error: 'This promo code has expired' });
      }

      // Check if max redemptions reached
      if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
        return c.json({ valid: false, error: 'This promo code is no longer available' });
      }

      logger.info('validate_coupon_success', {
        code: promo.code,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
      });

      return c.json({
        valid: true,
        promoCodeId: promo.id,
        code: promo.code,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
        durationMonths: coupon.duration_in_months,
        name: coupon.name,
      });
    } catch (error) {
      logger.error('validate_coupon_error', { error: truncateError(error) });
      return c.json({ valid: false, error: 'Failed to validate promo code' });
    }
  },
);

/**
 * POST /checkout
 * Create a Stripe Checkout session (delegates to Better Auth Stripe plugin)
 * This endpoint is deprecated - use Better Auth Stripe client plugin directly
 */
billingCheckoutRoutes.post('/checkout', billingCheckoutRateLimit, requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);
  const logger = createLogger({ c, service: 'billing', env: c.env });

  try {
    const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

    // Verify user is org owner
    requireOrgOwner({ orgId, role });

    const body = await c.req.json();
    const { tier, interval = 'monthly' } = body;

    if (!tier || tier === DEFAULT_PLAN) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'tier',
        value: tier,
      });
      return c.json(error, error.statusCode);
    }

    // Validate plan change to prevent downgrades that exceed quotas
    const validationResult = await validatePlanChange(db, orgId, tier);
    if (!validationResult.valid) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          reason: 'downgrade_exceeds_quotas',
          violations: validationResult.violations,
          usage: validationResult.usage,
          targetPlan: validationResult.targetPlan,
        },
        validationResult.violations.map(v => v.message).join(' '),
      );
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
    const { createAuth } = await import('@/auth/config.js');
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
          returnUrl: `${c.env.APP_URL || 'https://corates.org'}/settings/billing`,
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
      userId: user.id,
      error: truncateError(error),
      errorCode: error.code || 'unknown',
    });

    // If error is already a domain error, return it as-is
    if (error.code && error.statusCode) {
      return c.json(error, error.statusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_checkout_session',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /single-project/checkout
 * Create a Stripe Checkout session for one-time Single Project purchase
 * Owner-gated: only org owners can purchase
 */
billingCheckoutRoutes.post(
  '/single-project/checkout',
  billingCheckoutRateLimit,
  requireAuth,
  async c => {
    const { user, session } = getAuth(c);
    const db = createDb(c.env.DB);
    const logger = createLogger({ c, service: 'billing', env: c.env });

    try {
      const { orgId, role } = await resolveOrgIdWithRole({ db, session, userId: user.id });

      // Verify user is org owner
      requireOrgOwner({ orgId, role });

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
      const { user: userTable } = await import('@/db/schema.js');
      const { eq } = await import('drizzle-orm');
      const userRecord = await db
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

      // Validate single project price ID is configured
      const priceId = c.env.STRIPE_PRICE_ID_SINGLE_PROJECT;
      if (!priceId) {
        logger.stripe('single_project_checkout_failed', {
          outcome: 'failed',
          orgId,
          userId: user.id,
          errorCode: 'stripe_price_not_configured',
        });

        const error = createDomainError(
          SYSTEM_ERRORS.INTERNAL_ERROR,
          { operation: 'stripe_price_not_configured' },
          'Single project pricing is not configured. Please contact support.',
        );
        return c.json(error, error.statusCode);
      }

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
        userId: user.id,
        error: truncateError(error),
        errorCode: error.code || 'unknown',
      });

      // If error is already a domain error, return it as-is
      if (error.code && error.statusCode) {
        return c.json(error, error.statusCode);
      }

      const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'create_single_project_checkout',
        originalError: error.message,
      });
      return c.json(systemError, systemError.statusCode);
    }
  },
);

export { billingCheckoutRoutes };
