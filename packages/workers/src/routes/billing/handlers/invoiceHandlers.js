/**
 * Invoice webhook event handlers
 * Handles invoice.* events from Stripe
 * Critical for payment failure recovery and dunning
 */

import { eq } from 'drizzle-orm';
import { subscription, user } from '@/db/schema.js';
import { queueDunningEmail } from './dunning.js';

/**
 * Handle invoice.payment_succeeded
 * Update subscription status back to active after successful payment
 * @param {Stripe.Invoice} invoice - Stripe invoice object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handleInvoicePaymentSucceeded(invoice, ctx) {
  const { db, logger } = ctx;

  // Only process subscription invoices
  if (!invoice.subscription) {
    logger.stripe('invoice_not_subscription', {
      stripeInvoiceId: invoice.id,
      billingReason: invoice.billing_reason,
    });
    return {
      handled: true,
      result: 'not_subscription_invoice',
      ledgerContext: { stripeCustomerId: invoice.customer },
    };
  }

  const stripeSubscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;

  // Find and update subscription
  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId))
    .get();

  if (!existing) {
    logger.stripe('subscription_not_found_for_invoice', {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId,
    });
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: {
        stripeSubscriptionId,
        stripeCustomerId: invoice.customer,
      },
    };
  }

  // Update subscription to active and clear failure tracking
  await db
    .update(subscription)
    .set({
      status: 'active',
      periodEnd: invoice.period_end ? new Date(invoice.period_end * 1000) : existing.periodEnd,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  logger.stripe('invoice_payment_succeeded', {
    subscriptionId: existing.id,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId,
    orgId: existing.referenceId,
    amount: invoice.amount_paid,
    currency: invoice.currency,
  });

  return {
    handled: true,
    result: 'payment_succeeded',
    ledgerContext: {
      stripeSubscriptionId,
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
      orgId: existing.referenceId,
    },
  };
}

/**
 * Handle invoice.payment_failed
 * Update subscription status and trigger dunning flow
 * @param {Stripe.Invoice} invoice - Stripe invoice object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handleInvoicePaymentFailed(invoice, ctx) {
  const { db, logger, env } = ctx;

  // Only process subscription invoices
  if (!invoice.subscription) {
    logger.stripe('invoice_payment_failed_not_subscription', {
      stripeInvoiceId: invoice.id,
    });
    return {
      handled: true,
      result: 'not_subscription_invoice',
      ledgerContext: { stripeCustomerId: invoice.customer },
    };
  }

  const stripeSubscriptionId =
    typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription.id;

  // Find subscription
  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, stripeSubscriptionId))
    .get();

  if (!existing) {
    logger.stripe('subscription_not_found_for_failed_invoice', {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId,
    });
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: {
        stripeSubscriptionId,
        stripeCustomerId: invoice.customer,
      },
    };
  }

  // Update subscription to past_due
  await db
    .update(subscription)
    .set({
      status: 'past_due',
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  // Extract failure details
  const failureReason =
    invoice.last_finalization_error?.message ||
    invoice.status_transitions?.finalized_at ||
    'unknown';

  logger.stripe('invoice_payment_failed', {
    subscriptionId: existing.id,
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId,
    orgId: existing.referenceId,
    attemptCount: invoice.attempt_count,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    failureReason,
    nextPaymentAttempt: invoice.next_payment_attempt,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
  });

  // Look up the user to send dunning email
  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;

  if (stripeCustomerId && env?.EMAIL_QUEUE) {
    const billingUser = await db
      .select({ id: user.id, email: user.email, name: user.name, displayName: user.displayName })
      .from(user)
      .where(eq(user.stripeCustomerId, stripeCustomerId))
      .get();

    if (billingUser?.email) {
      // Queue dunning email via EmailQueue DO
      await queueDunningEmail(
        {
          subscriptionId: existing.id,
          orgId: existing.referenceId,
          userEmail: billingUser.email,
          userName: billingUser.displayName || billingUser.name,
          invoiceUrl: invoice.hosted_invoice_url,
          amountDue: invoice.amount_due,
          currency: invoice.currency,
          attemptCount: invoice.attempt_count || 1,
        },
        ctx,
      );
    } else {
      logger.stripe('dunning_email_skipped_no_user', {
        subscriptionId: existing.id,
        stripeCustomerId,
      });
    }
  }

  return {
    handled: true,
    result: 'payment_failed_processed',
    ledgerContext: {
      stripeSubscriptionId,
      stripeCustomerId,
      orgId: existing.referenceId,
    },
  };
}

/**
 * Handle invoice.finalized
 * Log invoice finalization for audit trail
 * @param {Stripe.Invoice} invoice - Stripe invoice object
 * @param {object} ctx - Context with db, logger, env
 */
export async function handleInvoiceFinalized(invoice, ctx) {
  const { logger } = ctx;

  logger.stripe('invoice_finalized', {
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: invoice.subscription,
    stripeCustomerId: invoice.customer,
    amount: invoice.amount_due,
    currency: invoice.currency,
    billingReason: invoice.billing_reason,
    hostedInvoiceUrl: invoice.hosted_invoice_url,
  });

  return {
    handled: true,
    result: 'finalized_logged',
    ledgerContext: {
      stripeSubscriptionId:
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id,
      stripeCustomerId:
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id,
    },
  };
}
