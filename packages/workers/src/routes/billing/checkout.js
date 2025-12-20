/**
 * Stripe Checkout session creation
 */

import Stripe from 'stripe';
import { createDb } from '../../db/client.js';
import { getSubscriptionByUserId } from '../../db/subscriptions.js';
import { getPriceId } from '../../config/stripe.js';
import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';

/**
 * Create a Stripe Checkout session for subscription
 * @param {Object} env - Cloudflare Worker environment
 * @param {Object} user - Authenticated user
 * @param {string} tier - Subscription tier
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @returns {Promise<{ url: string }>}
 */
export async function createCheckoutSession(env, user, tier, interval = 'monthly') {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const db = createDb(env.DB);

  // Get price ID for the selected tier and interval
  const priceId = getPriceId(tier, interval);
  if (!priceId) {
    const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
      field: 'tier/interval',
      value: `${tier}/${interval}`,
    });
    throw error;
  }

  // Check for existing subscription
  const existingSubscription = await getSubscriptionByUserId(db, user.id);
  const customerId = existingSubscription?.stripeCustomerId;

  // Build checkout session config
  const sessionConfig = {
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${env.APP_URL}/settings/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${env.APP_URL}/settings/billing?canceled=true`,
    metadata: {
      userId: user.id,
      tier,
      interval,
    },
    subscription_data: {
      metadata: {
        userId: user.id,
        tier,
      },
    },
  };

  // If user already has a Stripe customer ID, use it
  if (customerId) {
    sessionConfig.customer = customerId;
  } else {
    // Create new customer with user info
    sessionConfig.customer_email = user.email;
    sessionConfig.customer_creation = 'always';
  }

  // Allow promotion codes
  sessionConfig.allow_promotion_codes = true;

  // Create the checkout session
  const session = await stripe.checkout.sessions.create(sessionConfig);

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Retrieve a checkout session by ID
 * @param {Object} env - Cloudflare Worker environment
 * @param {string} sessionId - Checkout session ID
 * @returns {Promise<Object>}
 */
export async function getCheckoutSession(env, sessionId) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['subscription', 'customer'],
  });

  return session;
}
