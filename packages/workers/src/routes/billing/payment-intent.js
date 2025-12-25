/**
 * Stripe Payment Intent creation for Elements
 */

import Stripe from 'stripe';
import { createDb } from '../../db/client.js';
import { getSubscriptionByUserId } from '../../db/subscriptions.js';
import { getPriceId } from '../../config/stripe.js';
import { createDomainError, VALIDATION_ERRORS } from '@corates/shared';

/**
 * Create a Payment Intent for Stripe Elements
 * @param {Object} env - Cloudflare Worker environment
 * @param {Object} user - Authenticated user
 * @param {string} tier - Subscription tier
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @returns {Promise<{ clientSecret: string }>}
 */
export async function createPaymentIntent(env, user, tier, interval = 'monthly') {
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

  // Create or retrieve customer
  let customer;
  if (customerId) {
    customer = await stripe.customers.retrieve(customerId);
  } else {
    customer = await stripe.customers.create({
      email: user.email,
      metadata: {
        userId: user.id,
      },
    });
  }

  // Create subscription with payment intent
  // Using payment_behavior: 'default_incomplete' is the recommended Stripe pattern for Elements
  // This creates the subscription with status 'incomplete' until payment is confirmed
  // If payment is not confirmed within 23 hours, Stripe automatically:
  // - Transitions subscription to 'incomplete_expired' status
  // - Voids the open invoice
  // - Prevents future invoices
  // Our webhook handler (customer.subscription.updated) will catch status changes
  const subscription = await stripe.subscriptions.create({
    customer: customer.id,
    items: [
      {
        price: priceId,
      },
    ],
    payment_behavior: 'default_incomplete',
    payment_settings: { save_default_payment_method: 'on_subscription' },
    expand: ['latest_invoice.payment_intent'],
    metadata: {
      userId: user.id,
      tier,
    },
  });

  const invoice = subscription.latest_invoice;

  // Handle expanded invoice object
  let paymentIntent;
  if (typeof invoice === 'object' && invoice.payment_intent) {
    paymentIntent = invoice.payment_intent;
  } else {
    // If invoice is just an ID, retrieve it
    const fullInvoice = await stripe.invoices.retrieve(invoice, {
      expand: ['payment_intent'],
    });
    paymentIntent = fullInvoice.payment_intent;
  }

  // Handle payment intent as object or string ID
  if (typeof paymentIntent === 'string') {
    paymentIntent = await stripe.paymentIntents.retrieve(paymentIntent);
  }

  if (!paymentIntent || !paymentIntent.client_secret) {
    const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
      field: 'payment_intent',
      value: 'Failed to create payment intent',
    });
    throw error;
  }

  return {
    clientSecret: paymentIntent.client_secret,
    subscriptionId: subscription.id,
  };
}
