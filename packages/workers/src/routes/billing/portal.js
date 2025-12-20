/**
 * Stripe Customer Portal session creation
 */

import Stripe from 'stripe';
import { createDb } from '../../db/client.js';
import { getSubscriptionByUserId } from '../../db/subscriptions.js';
import { createDomainError, USER_ERRORS } from '@corates/shared';

/**
 * Create a Stripe Customer Portal session
 * Allows customers to manage their subscription, payment methods, and billing history
 * @param {Object} env - Cloudflare Worker environment
 * @param {Object} user - Authenticated user
 * @returns {Promise<{ url: string }>}
 */
export async function createPortalSession(env, user) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const db = createDb(env.DB);

  // Get the user's subscription to find their Stripe customer ID
  const subscription = await getSubscriptionByUserId(db, user.id);

  if (!subscription?.stripeCustomerId) {
    const error = createDomainError(USER_ERRORS.NOT_FOUND, {
      context: 'billing_account',
      message: 'No billing account found. Please subscribe to a plan first.',
    });
    throw error;
  }

  // Create the portal session
  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${env.APP_URL}/settings/billing`,
  });

  return {
    url: session.url,
  };
}
