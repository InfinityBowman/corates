/**
 * Billing checkout routes
 * Handles Stripe Checkout session creation for subscriptions and one-time purchases
 */
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { requireAuth, getAuth } from '@/middleware/auth';
import { createDb } from '@/db/client';
import { user as userTable } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { validatePlanChange, resolveOrgAccess } from '@/lib/billingResolver';
import { DEFAULT_PLAN } from '@corates/shared/plans';
import { createDomainError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type Stripe from 'stripe';
import { createStripeClient, isStripeConfigured } from '@/lib/stripe.js';
import { createLogger, truncateError, withTiming } from '@/lib/observability/logger';
import { billingCheckoutRateLimit } from '@/middleware/rateLimit';
import { resolveOrgIdWithRole } from './helpers/orgContext';
import { requireOrgOwner } from '@/policies';
import { createSingleProjectCheckout } from '@/commands';
import { validationHook } from '@/lib/honoValidationHook';
import type { Env } from '@/types';

const billingCheckoutRoutes = new OpenAPIHono<{ Bindings: Env }>({
  defaultHook: validationHook,
});

// Request schemas
const ValidateCouponRequestSchema = z
  .object({
    code: z.string().min(1).openapi({ example: 'PROMO50' }),
  })
  .openapi('ValidateCouponRequest');

const CheckoutRequestSchema = z
  .object({
    tier: z.string().min(1).openapi({ example: 'pro' }),
    interval: z.enum(['monthly', 'yearly']).default('monthly').openapi({ example: 'monthly' }),
  })
  .openapi('CheckoutRequest');

// Response schemas
const CouponValidResponseSchema = z
  .object({
    valid: z.literal(true),
    promoCodeId: z.string(),
    code: z.string(),
    percentOff: z.number().nullable(),
    amountOff: z.number().nullable(),
    currency: z.string().nullable(),
    duration: z.string(),
    durationMonths: z.number().nullable(),
    name: z.string().nullable(),
  })
  .openapi('CouponValidResponse');

const CouponInvalidResponseSchema = z
  .object({
    valid: z.literal(false),
    error: z.string(),
  })
  .openapi('CouponInvalidResponse');

const CheckoutResponseSchema = z
  .object({
    url: z.string(),
  })
  .openapi('CheckoutResponse');

const SingleProjectCheckoutResponseSchema = z
  .object({
    url: z.string(),
    sessionId: z.string(),
  })
  .openapi('SingleProjectCheckoutResponse');

const CheckoutErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .openapi('CheckoutError');

// Route definitions
const validateCouponRoute = createRoute({
  method: 'post',
  path: '/validate-coupon',
  tags: ['Billing'],
  summary: 'Validate promotion code',
  description: 'Validate a promotion code and return discount details',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ValidateCouponRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.union([CouponValidResponseSchema, CouponInvalidResponseSchema]),
        },
      },
      description: 'Coupon validation result',
    },
  },
});

const checkoutRoute = createRoute({
  method: 'post',
  path: '/checkout',
  tags: ['Billing'],
  summary: 'Create checkout session',
  description:
    'Create a Stripe Checkout session (delegates to Better Auth Stripe plugin). This endpoint is deprecated - use Better Auth Stripe client plugin directly.',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CheckoutRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: CheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    400: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Invalid tier or downgrade validation failed',
    },
    403: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Not org owner',
    },
    429: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Internal error',
    },
  },
});

const singleProjectCheckoutRoute = createRoute({
  method: 'post',
  path: '/single-project/checkout',
  tags: ['Billing'],
  summary: 'Create single project checkout',
  description:
    'Create a Stripe Checkout session for one-time Single Project purchase. Owner-gated: only org owners can purchase.',
  security: [{ cookieAuth: [] }],
  responses: {
    200: {
      content: { 'application/json': { schema: SingleProjectCheckoutResponseSchema } },
      description: 'Checkout session created',
    },
    403: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Not org owner',
    },
    429: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Rate limit exceeded',
    },
    500: {
      content: { 'application/json': { schema: CheckoutErrorSchema } },
      description: 'Internal error or Stripe not configured',
    },
  },
});

// Route handlers
billingCheckoutRoutes.use('/checkout', billingCheckoutRateLimit);
billingCheckoutRoutes.use('/single-project/checkout', billingCheckoutRateLimit);
billingCheckoutRoutes.use('*', requireAuth);

billingCheckoutRoutes.openapi(validateCouponRoute, async c => {
  const logger = createLogger({ c, service: 'billing', env: c.env });

  try {
    const { code } = c.req.valid('json');

    if (!isStripeConfigured(c.env)) {
      logger.error('validate_coupon_failed', { error: 'Stripe not configured' });
      return c.json({ valid: false as const, error: 'Payment system not available' });
    }

    const stripe = createStripeClient(c.env);

    // Look up promotion code (user-facing codes)
    const promoCodes = await stripe.promotionCodes.list({
      code: code,
      active: true,
      limit: 1,
    });

    if (promoCodes.data.length === 0) {
      logger.info('validate_coupon_invalid', { code: code.trim() });
      return c.json({ valid: false as const, error: 'Invalid or expired promo code' });
    }

    const promo = promoCodes.data[0];
    // Access coupon through the expand or direct access
    const coupon = (promo as unknown as { coupon: Stripe.Coupon }).coupon;

    // Check if expired
    if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) {
      return c.json({ valid: false as const, error: 'This promo code has expired' });
    }

    // Check if max redemptions reached
    if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
      return c.json({ valid: false as const, error: 'This promo code is no longer available' });
    }

    logger.info('validate_coupon_success', {
      code: promo.code,
      percentOff: coupon.percent_off,
      amountOff: coupon.amount_off,
    });

    return c.json({
      valid: true as const,
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
    logger.error('validate_coupon_error', { error: truncateError(error as Error) });
    return c.json({ valid: false as const, error: 'Failed to validate promo code' });
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingCheckoutRoutes.openapi(checkoutRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);
  const logger = createLogger({ c, service: 'billing', env: c.env });

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session as unknown as Record<string, unknown>,
      userId: user!.id,
    });

    // Verify user is org owner using centralized policy
    requireOrgOwner({ orgId, role });

    const { tier, interval } = c.req.valid('json');

    if (!tier || tier === DEFAULT_PLAN) {
      const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
        field: 'tier',
        value: tier,
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Check if user already has an active subscription with the same plan
    // Allow grant/trial/free users to checkout (they're upgrading to paid)
    // For interval changes on existing subscriptions, users should use the billing portal
    const currentBilling = await resolveOrgAccess(db, orgId!);
    if (currentBilling.source === 'subscription' && currentBilling.effectivePlanId === tier) {
      const error = createDomainError(
        VALIDATION_ERRORS.INVALID_INPUT,
        {
          reason: 'already_on_plan',
          currentPlan: tier,
        },
        `You are already subscribed to the ${tier} plan. To change your billing interval, use the billing portal.`,
      );
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Validate plan change to prevent downgrades that exceed quotas
    const validationResult = await validatePlanChange(db, orgId!, tier);
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
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Log checkout initiation
    logger.info('checkout_initiated', {
      orgId: orgId || undefined,
      userId: user!.id,
      plan: tier,
      interval,
    });

    // Delegate to Better Auth Stripe plugin
    const { createAuth } = await import('@/auth/config');
    const auth = createAuth(c.env, c.executionCtx);

    const { result, durationMs } = await withTiming(async () => {
      // Use the generic api call interface
      return (auth.api as Record<string, CallableFunction>).upgradeSubscription({
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
    logger.info('checkout_created', {
      outcome: 'success',
      orgId: orgId || undefined,
      userId: user!.id,
      plan: tier,
      interval,
      durationMs,
      stripeCheckoutSessionId:
        result?.url?.includes('cs_') ? result.url.split('/').pop() : undefined,
    });

    return c.json(result);
  } catch (error) {
    const err = error as Error & { code?: string; statusCode?: number };
    logger.error('checkout_failed', {
      outcome: 'failed',
      userId: user!.id,
      error: truncateError(error as Error) || undefined,
      errorCode: err.code || 'unknown',
    });

    // If error is already a domain error, return it as-is
    if (err.code && err.statusCode) {
      return c.json(error, err.statusCode as ContentfulStatusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_checkout_session',
      originalError: err.message,
    });
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
  }
});

// @ts-expect-error OpenAPIHono strict return types don't account for error responses
billingCheckoutRoutes.openapi(singleProjectCheckoutRoute, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);
  const logger = createLogger({ c, service: 'billing', env: c.env });

  try {
    const { orgId, role } = await resolveOrgIdWithRole({
      db,
      session: session as unknown as Record<string, unknown>,
      userId: user!.id,
    });

    // Verify user is org owner using centralized policy
    requireOrgOwner({ orgId, role });

    // Log checkout initiation
    logger.stripe('single_project_checkout_initiated', {
      orgId: orgId || undefined,
      userId: user!.id,
      plan: 'single_project',
    });

    // Get user's Stripe customer ID
    const userRecord = await db
      .select({ stripeCustomerId: userTable.stripeCustomerId })
      .from(userTable)
      .where(eq(userTable.id, user!.id))
      .get();

    // Use the command to create the checkout session
    const result = await createSingleProjectCheckout(
      c.env,
      {
        id: user!.id,
        stripeCustomerId: userRecord?.stripeCustomerId || null,
      },
      { orgId: orgId! },
    );

    logger.stripe('single_project_checkout_created', {
      outcome: 'success',
      orgId: orgId || undefined,
      userId: user!.id,
      plan: 'single_project',
      stripeCheckoutSessionId: result.sessionId,
      stripeCustomerId: userRecord?.stripeCustomerId || undefined,
    });

    return c.json(result);
  } catch (error) {
    const err = error as Error & { code?: string; statusCode?: number };
    logger.stripe('single_project_checkout_failed', {
      outcome: 'failed',
      userId: user!.id,
      error: truncateError(error as Error) || undefined,
      errorCode: err.code || 'unknown',
    });

    // If error is already a domain error, return it as-is
    if (err.code && err.statusCode) {
      return c.json(error, err.statusCode as ContentfulStatusCode);
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'create_single_project_checkout',
      originalError: err.message,
    });
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
  }
});

export { billingCheckoutRoutes };
