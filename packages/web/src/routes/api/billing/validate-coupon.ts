/**
 * Stripe promotion-code validation
 *
 * POST /api/billing/validate-coupon — looks up a Stripe promotion code by name,
 * returns discount details or a structured invalid response. Always returns 200;
 * the `valid` field discriminates.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import type Stripe from 'stripe';
import { getSession } from '@corates/workers/auth';
import { createStripeClient, isStripeConfigured } from '@corates/workers/stripe';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

interface CouponBody {
  code?: unknown;
}

export const handlePost = async ({ request }: { request: Request }) => {
  const session = await getSession(request, env);
  if (!session) {
    const error = createDomainError(AUTH_ERRORS.REQUIRED, { reason: 'no_user' });
    return Response.json(error, { status: 401 });
  }

  let body: CouponBody = {};
  try {
    body = (await request.json()) as CouponBody;
  } catch {
    return Response.json({ valid: false as const, error: 'Invalid request body' }, { status: 200 });
  }

  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!code) {
    return Response.json(
      { valid: false as const, error: 'Promo code is required' },
      { status: 200 },
    );
  }

  if (!isStripeConfigured(env)) {
    console.error('validate_coupon_failed: Stripe not configured');
    return Response.json(
      { valid: false as const, error: 'Payment system not available' },
      { status: 200 },
    );
  }

  try {
    const stripe = createStripeClient(env);
    const promoCodes = await stripe.promotionCodes.list({ code, active: true, limit: 1 });

    if (promoCodes.data.length === 0) {
      return Response.json(
        { valid: false as const, error: 'Invalid or expired promo code' },
        { status: 200 },
      );
    }

    const promo = promoCodes.data[0];
    const coupon = (promo as unknown as { coupon: Stripe.Coupon }).coupon;

    if (promo.expires_at && promo.expires_at < Math.floor(Date.now() / 1000)) {
      return Response.json(
        { valid: false as const, error: 'This promo code has expired' },
        { status: 200 },
      );
    }
    if (promo.max_redemptions && promo.times_redeemed >= promo.max_redemptions) {
      return Response.json(
        { valid: false as const, error: 'This promo code is no longer available' },
        { status: 200 },
      );
    }

    return Response.json(
      {
        valid: true as const,
        promoCodeId: promo.id,
        code: promo.code,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
        durationMonths: coupon.duration_in_months,
        name: coupon.name,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('validate_coupon_error:', err);
    return Response.json(
      { valid: false as const, error: 'Failed to validate promo code' },
      { status: 200 },
    );
  }
};

export const Route = createFileRoute('/api/billing/validate-coupon')({
  server: { handlers: { POST: handlePost } },
});
