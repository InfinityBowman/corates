/**
 * Payment intent webhook event handlers
 * Handles payment_intent.* events from Stripe
 * Important for ACH payments and tracking payment lifecycle
 */
import type Stripe from 'stripe';
import type { WebhookContext, WebhookResult } from './types.js';

// Extended type for PaymentIntent with invoice field
interface PaymentIntentWithInvoice extends Stripe.PaymentIntent {
  invoice?: string | Stripe.Invoice | null;
}

/**
 * Handle payment_intent.processing
 * ACH payments take 3-5 business days to process
 */
export async function handlePaymentIntentProcessing(
  paymentIntent: Stripe.PaymentIntent,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const { logger } = ctx;

  // Log for visibility - ACH payments in processing state
  logger.stripe('payment_intent_processing', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentMethodTypes: paymentIntent.payment_method_types,
    // ACH-specific info
    isACH: paymentIntent.payment_method_types?.includes('us_bank_account'),
    metadata: paymentIntent.metadata,
  });

  return {
    handled: true,
    result: 'processing_logged',
    ledgerContext: {
      stripeCustomerId:
        typeof paymentIntent.customer === 'string' ?
          paymentIntent.customer
        : paymentIntent.customer?.id,
      stripePaymentIntentId: paymentIntent.id,
    },
  };
}

/**
 * Handle payment_intent.succeeded
 * Final confirmation that payment is complete
 * Most processing happens in invoice.payment_succeeded for subscriptions
 */
export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const { logger } = ctx;

  logger.stripe('payment_intent_succeeded', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentMethodTypes: paymentIntent.payment_method_types,
    metadata: paymentIntent.metadata,
    // Invoice info if available
    invoice: (paymentIntent as PaymentIntentWithInvoice).invoice,
  });

  return {
    handled: true,
    result: 'succeeded_logged',
    ledgerContext: {
      stripeCustomerId:
        typeof paymentIntent.customer === 'string' ?
          paymentIntent.customer
        : paymentIntent.customer?.id,
      stripePaymentIntentId: paymentIntent.id,
    },
  };
}

/**
 * Handle payment_intent.payment_failed
 * Log failure details for debugging and alerting
 */
export async function handlePaymentIntentFailed(
  paymentIntent: Stripe.PaymentIntent,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const { logger } = ctx;

  const error = paymentIntent.last_payment_error;

  logger.stripe('payment_intent_failed', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    // Error details
    errorCode: error?.code,
    errorMessage: error?.message,
    errorType: error?.type,
    declineCode: error?.decline_code,
    // Payment method info
    paymentMethodTypes: paymentIntent.payment_method_types,
    // Metadata for debugging
    metadata: paymentIntent.metadata,
  });

  return {
    handled: true,
    result: 'failure_logged',
    ledgerContext: {
      stripeCustomerId:
        typeof paymentIntent.customer === 'string' ?
          paymentIntent.customer
        : paymentIntent.customer?.id,
      stripePaymentIntentId: paymentIntent.id,
    },
  };
}
