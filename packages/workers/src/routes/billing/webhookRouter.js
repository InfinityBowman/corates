/**
 * Webhook event router
 * Routes Stripe webhook events to appropriate handlers
 *
 * Each handler returns: { handled: boolean, result: any, ledgerContext?: object }
 * - handled: true if the event was processed (even if no action taken)
 * - result: string describing the outcome
 * - ledgerContext: optional additional fields to store in ledger
 */

import { handleCheckoutSessionCompleted } from './handlers/checkoutHandlers.js';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleSubscriptionPaused,
  handleSubscriptionResumed,
} from './handlers/subscriptionHandlers.js';
import {
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleInvoiceFinalized,
} from './handlers/invoiceHandlers.js';
import {
  handlePaymentIntentProcessing,
  handlePaymentIntentSucceeded,
  handlePaymentIntentFailed,
} from './handlers/paymentIntentHandlers.js';
import { handleCustomerUpdated, handleCustomerDeleted } from './handlers/customerHandlers.js';

/**
 * Route a Stripe event to the appropriate handler
 * @param {Stripe.Event} event - Verified Stripe event
 * @param {object} ctx - Context containing db, logger, env
 * @returns {Promise<{ handled: boolean, result: string, ledgerContext?: object }>}
 */
export async function routeStripeEvent(event, ctx) {
  const { type, data } = event;
  const { logger } = ctx;

  switch (type) {
    // Checkout events
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(data.object, ctx);

    // Subscription lifecycle
    case 'customer.subscription.created':
      return handleSubscriptionCreated(data.object, ctx);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(data.object, ctx);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(data.object, ctx);
    case 'customer.subscription.paused':
      return handleSubscriptionPaused(data.object, ctx);
    case 'customer.subscription.resumed':
      return handleSubscriptionResumed(data.object, ctx);

    // Invoice events
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(data.object, ctx);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(data.object, ctx);
    case 'invoice.finalized':
      return handleInvoiceFinalized(data.object, ctx);

    // Payment intent lifecycle
    case 'payment_intent.processing':
      return handlePaymentIntentProcessing(data.object, ctx);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(data.object, ctx);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(data.object, ctx);

    // Customer events
    case 'customer.updated':
      return handleCustomerUpdated(data.object, ctx);
    case 'customer.deleted':
      return handleCustomerDeleted(data.object, ctx);

    default:
      logger.stripe('unhandled_event_type', { eventType: type });
      return { handled: false, result: 'event_type_not_handled' };
  }
}

/**
 * Extract ledger context fields from an event
 * Used to populate linking fields in the ledger
 */
export function extractLedgerContext(event) {
  const obj = event.data?.object || {};
  const context = {};

  // Extract IDs based on event type
  if (obj.customer) {
    context.stripeCustomerId = typeof obj.customer === 'string' ? obj.customer : obj.customer.id;
  }
  if (obj.subscription) {
    context.stripeSubscriptionId =
      typeof obj.subscription === 'string' ? obj.subscription : obj.subscription.id;
  }
  if (obj.id && event.type.startsWith('checkout.session')) {
    context.stripeCheckoutSessionId = obj.id;
  }
  if (obj.id && event.type.startsWith('customer.subscription')) {
    context.stripeSubscriptionId = obj.id;
  }
  if (obj.metadata?.orgId) {
    context.orgId = obj.metadata.orgId;
  }

  return context;
}
