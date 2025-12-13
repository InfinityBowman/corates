/**
 * Stripe webhook handlers
 */

import Stripe from 'stripe';
import { createDb } from '../../db/client.js';
import { upsertSubscription, updateSubscriptionByStripeId } from '../../db/subscriptions.js';

/**
 * Map Stripe subscription status to our status
 * @param {string} stripeStatus - Stripe subscription status
 * @returns {string}
 */
function mapStripeStatus(stripeStatus) {
  const statusMap = {
    active: 'active',
    trialing: 'trialing',
    past_due: 'past_due',
    canceled: 'canceled',
    unpaid: 'past_due',
    incomplete: 'incomplete',
    incomplete_expired: 'canceled',
    paused: 'canceled',
  };
  return statusMap[stripeStatus] ?? 'inactive';
}

/**
 * Map Stripe price ID to tier
 * This needs to be updated with your actual price IDs
 * @param {string} priceId - Stripe price ID
 * @returns {string}
 */
function getTierFromPriceId(priceId) {
  // TODO: Update these mappings with your actual Stripe price IDs
  const priceToTier = {
    price_pro_monthly: 'pro',
    price_pro_yearly: 'pro',
    price_team_monthly: 'team',
    price_team_yearly: 'team',
    price_enterprise_monthly: 'enterprise',
    price_enterprise_yearly: 'enterprise',
  };
  return priceToTier[priceId] ?? 'pro';
}

/**
 * Handle incoming Stripe webhook
 * @param {Object} env - Cloudflare Worker environment
 * @param {string} rawBody - Raw request body
 * @param {string} signature - Stripe signature header
 * @returns {Promise<{ received: boolean }>}
 */
export async function handleWebhook(env, rawBody, signature) {
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);

  // Verify webhook signature
  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    throw new Error(`Webhook signature verification failed: ${err.message}`);
  }

  const db = createDb(env.DB);

  // Handle the event
  switch (event.type) {
    case 'checkout.session.completed':
      await handleCheckoutCompleted(db, stripe, event.data.object);
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      await handleSubscriptionUpdated(db, event.data.object);
      break;

    case 'customer.subscription.deleted':
      await handleSubscriptionDeleted(db, event.data.object);
      break;

    case 'invoice.paid':
      await handleInvoicePaid(db, event.data.object);
      break;

    case 'invoice.payment_failed':
      await handlePaymentFailed(db, event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  return { received: true };
}

/**
 * Handle checkout.session.completed event
 * This is triggered when a customer completes checkout
 */
async function handleCheckoutCompleted(db, stripe, session) {
  const userId = session.metadata?.userId;
  const tier = session.metadata?.tier;

  if (!userId) {
    console.error('Checkout session missing userId in metadata');
    return;
  }

  // Retrieve the subscription details
  const subscription = await stripe.subscriptions.retrieve(session.subscription);

  const subscriptionId = `sub_${crypto.randomUUID()}`;

  await upsertSubscription(db, {
    id: subscriptionId,
    userId,
    stripeCustomerId: session.customer,
    stripeSubscriptionId: subscription.id,
    tier: tier ?? getTierFromPriceId(subscription.items.data[0]?.price.id),
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  console.log(`Subscription created for user ${userId}: ${subscription.id}`);
}

/**
 * Handle customer.subscription.updated event
 * This handles upgrades, downgrades, and status changes
 */
async function handleSubscriptionUpdated(db, subscription) {
  const priceId = subscription.items.data[0]?.price.id;
  const tier = getTierFromPriceId(priceId);

  await updateSubscriptionByStripeId(db, subscription.id, {
    tier,
    status: mapStripeStatus(subscription.status),
    currentPeriodStart: new Date(subscription.current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  console.log(`Subscription updated: ${subscription.id} - ${tier} (${subscription.status})`);
}

/**
 * Handle customer.subscription.deleted event
 * This is triggered when a subscription is canceled
 */
async function handleSubscriptionDeleted(db, subscription) {
  await updateSubscriptionByStripeId(db, subscription.id, {
    tier: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
  });

  console.log(`Subscription canceled: ${subscription.id}`);
}

/**
 * Handle invoice.paid event
 * This is triggered when a payment succeeds
 */
async function handleInvoicePaid(db, invoice) {
  if (invoice.subscription) {
    await updateSubscriptionByStripeId(db, invoice.subscription, {
      status: 'active',
    });
    console.log(`Invoice paid for subscription: ${invoice.subscription}`);
  }
}

/**
 * Handle invoice.payment_failed event
 * This is triggered when a payment fails
 */
async function handlePaymentFailed(db, invoice) {
  if (invoice.subscription) {
    await updateSubscriptionByStripeId(db, invoice.subscription, {
      status: 'past_due',
    });
    console.log(`Payment failed for subscription: ${invoice.subscription}`);
  }
}
