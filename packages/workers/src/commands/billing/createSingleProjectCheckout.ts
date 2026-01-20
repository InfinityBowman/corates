/**
 * Create a Stripe checkout session for single project purchase
 *
 * @param env - Cloudflare environment bindings
 * @param actor - User creating the checkout (must have stripeCustomerId)
 * @param params - Checkout parameters
 * @returns Promise with checkout URL and session ID
 * @throws DomainError INTERNAL_ERROR if Stripe not configured
 * @throws DomainError INTERNAL_ERROR if user has no Stripe customer ID
 */

import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createStripeClient } from '@/lib/stripe.js';
import type { Env } from '@/types';

export interface CreateSingleProjectCheckoutParams {
  orgId: string;
}

export interface CreateSingleProjectCheckoutResult {
  url: string;
  sessionId: string;
}

export interface SingleProjectCheckoutActor {
  id: string;
  stripeCustomerId: string | null;
}

export async function createSingleProjectCheckout(
  env: Env,
  actor: SingleProjectCheckoutActor,
  params: CreateSingleProjectCheckoutParams,
): Promise<CreateSingleProjectCheckoutResult> {
  const { orgId } = params;

  // Validate Stripe configuration
  if (!env.STRIPE_SECRET_KEY) {
    throw createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'stripe_not_configured',
    });
  }

  const priceId = env.STRIPE_PRICE_ID_SINGLE_PROJECT;
  if (!priceId) {
    throw createDomainError(
      SYSTEM_ERRORS.INTERNAL_ERROR,
      { operation: 'stripe_price_not_configured' },
      'Single project pricing is not configured. Please contact support.',
    );
  }

  // Validate actor has Stripe customer ID
  if (!actor.stripeCustomerId) {
    throw createDomainError(
      SYSTEM_ERRORS.INTERNAL_ERROR,
      { operation: 'stripe_customer_not_found' },
      'Stripe customer ID not found. Please sign out and sign in again, or contact support.',
    );
  }

  const stripe = createStripeClient(env);

  const baseUrl = env.APP_URL || 'https://corates.org';

  // Generate idempotency key to prevent duplicate checkout sessions from rapid clicks
  // Uses 1-minute time window granularity
  const idempotencyKey = `sp_checkout_${orgId}_${actor.id}_${Math.floor(Date.now() / 60000)}`;

  const checkoutSession = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      payment_method_types: ['card'],
      customer: actor.stripeCustomerId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        orgId,
        grantType: 'single_project',
        purchaserUserId: actor.id,
      },
      success_url: `${baseUrl}/settings/billing?success=true&purchase=single_project`,
      cancel_url: `${baseUrl}/settings/billing?canceled=true`,
    },
    {
      idempotencyKey,
    },
  );

  if (!checkoutSession.url) {
    throw createDomainError(
      SYSTEM_ERRORS.INTERNAL_ERROR,
      { operation: 'checkout_session_no_url' },
      'Failed to create checkout session',
    );
  }

  return {
    url: checkoutSession.url,
    sessionId: checkoutSession.id,
  };
}
