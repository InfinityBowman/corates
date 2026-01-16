/**
 * Webhook event router
 * Routes Stripe webhook events to appropriate handlers
 *
 * Each handler returns: { handled: boolean, result: any, ledgerContext?: object }
 * - handled: true if the event was processed (even if no action taken)
 * - result: string describing the outcome
 * - ledgerContext: optional additional fields to store in ledger
 */

import type Stripe from 'stripe';
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

interface WebhookContext {
  db: unknown;
  logger: {
    stripe: (event: string, data: Record<string, unknown>) => void;
  };
  env: unknown;
}

interface WebhookResult {
  handled: boolean;
  result: string;
  ledgerContext?: object;
}

interface LedgerContext {
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripeCheckoutSessionId?: string;
  orgId?: string;
}

/**
 * Route a Stripe event to the appropriate handler
 */
export async function routeStripeEvent(
  event: Stripe.Event,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const { type, data } = event;
  const { logger } = ctx;

  switch (type) {
    // Checkout events
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(data.object as Stripe.Checkout.Session, ctx);

    // Subscription lifecycle
    case 'customer.subscription.created':
      return handleSubscriptionCreated(data.object as Stripe.Subscription, ctx);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(data.object as Stripe.Subscription, ctx);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(data.object as Stripe.Subscription, ctx);
    case 'customer.subscription.paused':
      return handleSubscriptionPaused(data.object as Stripe.Subscription, ctx);
    case 'customer.subscription.resumed':
      return handleSubscriptionResumed(data.object as Stripe.Subscription, ctx);

    // Invoice events
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(data.object as Stripe.Invoice, ctx);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(data.object as Stripe.Invoice, ctx);
    case 'invoice.finalized':
      return handleInvoiceFinalized(data.object as Stripe.Invoice, ctx);

    // Payment intent lifecycle
    case 'payment_intent.processing':
      return handlePaymentIntentProcessing(data.object as Stripe.PaymentIntent, ctx);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(data.object as Stripe.PaymentIntent, ctx);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(data.object as Stripe.PaymentIntent, ctx);

    // Customer events
    case 'customer.updated':
      return handleCustomerUpdated(data.object as Stripe.Customer, ctx);
    case 'customer.deleted':
      return handleCustomerDeleted(data.object as unknown as Stripe.Customer, ctx);

    default:
      logger.stripe('unhandled_event_type', { eventType: type });
      return { handled: false, result: 'event_type_not_handled' };
  }
}

/**
 * Extract ledger context fields from an event
 * Used to populate linking fields in the ledger
 */
export function extractLedgerContext(event: Stripe.Event): LedgerContext {
  const obj = (event.data?.object || {}) as unknown as Record<string, unknown>;
  const context: LedgerContext = {};

  // Extract IDs based on event type
  if (obj.customer) {
    context.stripeCustomerId =
      typeof obj.customer === 'string'
        ? obj.customer
        : (obj.customer as { id: string })?.id;
  }
  if (obj.subscription) {
    context.stripeSubscriptionId =
      typeof obj.subscription === 'string'
        ? obj.subscription
        : (obj.subscription as { id: string })?.id;
  }
  if (obj.id && event.type.startsWith('checkout.session')) {
    context.stripeCheckoutSessionId = obj.id as string;
  }
  if (obj.id && event.type.startsWith('customer.subscription')) {
    context.stripeSubscriptionId = obj.id as string;
  }
  if ((obj.metadata as Record<string, string>)?.orgId) {
    context.orgId = (obj.metadata as Record<string, string>).orgId;
  }

  return context;
}
