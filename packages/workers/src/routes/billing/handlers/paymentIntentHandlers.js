/**
 * Payment intent webhook event handlers
 * Handles payment_intent.* events from Stripe
 * Important for ACH payments and tracking payment lifecycle
 */

/**
 * Handle payment_intent.processing
 * ACH payments take 3-5 business days to process
 * @param {Stripe.PaymentIntent} paymentIntent - Stripe payment intent object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handlePaymentIntentProcessing(paymentIntent, ctx) {
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
 * @param {Stripe.PaymentIntent} paymentIntent - Stripe payment intent object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handlePaymentIntentSucceeded(paymentIntent, ctx) {
  const { logger } = ctx;

  logger.stripe('payment_intent_succeeded', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentMethodTypes: paymentIntent.payment_method_types,
    metadata: paymentIntent.metadata,
    // Invoice info if available
    invoice: paymentIntent.invoice,
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
 * @param {Stripe.PaymentIntent} paymentIntent - Stripe payment intent object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handlePaymentIntentFailed(paymentIntent, ctx) {
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
