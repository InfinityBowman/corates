/**
 * Subscription webhook event handlers
 * Handles customer.subscription.* events from Stripe
 */
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { subscription } from '@/db/schema.js';
import type { WebhookContext, WebhookResult } from './types.js';
import { createDb } from '@/db/client.js';
import type { Env } from '../../../types';

// Helper to get typed db from context
function getDb(ctx: WebhookContext) {
  return ctx.db as ReturnType<typeof createDb>;
}

// The Stripe API version used (2025-12-15.clover) uses different field names
// These interfaces extend the Stripe types with the fields we need
interface SubscriptionWithPeriods extends Stripe.Subscription {
  current_period_start?: number;
  current_period_end?: number;
}

/**
 * Handle customer.subscription.created
 * Note: Better Auth Stripe plugin typically handles initial creation
 * This handler ensures we catch any subscriptions created outside that flow
 */
export async function handleSubscriptionCreated(
  sub: Stripe.Subscription,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  // Check if subscription already exists (created by Better Auth)
  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, sub.id))
    .get();

  if (existing) {
    logger.stripe('subscription_already_exists', {
      stripeSubscriptionId: sub.id,
      existingId: existing.id,
      action: 'skip_create',
    });
    return {
      handled: true,
      result: 'already_exists',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  // Extract org ID from metadata (should be set as referenceId)
  const orgId = sub.metadata?.orgId || sub.metadata?.referenceId;

  if (!orgId) {
    logger.stripe('subscription_missing_org_id', {
      stripeSubscriptionId: sub.id,
      metadata: sub.metadata,
    });
    return {
      handled: true,
      result: 'missing_org_id',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  // Create subscription record
  // Note: This is a fallback - Better Auth should handle most creations
  const subscriptionId = crypto.randomUUID();
  await db.insert(subscription).values({
    id: subscriptionId,
    plan: sub.items.data[0]?.price?.lookup_key || 'unknown',
    referenceId: orgId,
    stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    periodStart:
      (sub as SubscriptionWithPeriods).current_period_start ?
        new Date((sub as SubscriptionWithPeriods).current_period_start! * 1000)
      : null,
    periodEnd:
      (sub as SubscriptionWithPeriods).current_period_end ?
        new Date((sub as SubscriptionWithPeriods).current_period_end! * 1000)
      : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  logger.stripe('subscription_created', {
    subscriptionId,
    stripeSubscriptionId: sub.id,
    orgId,
    status: sub.status,
  });

  return {
    handled: true,
    result: 'created',
    ledgerContext: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      orgId,
    },
  };
}

/**
 * Handle customer.subscription.updated
 * Syncs subscription status, period dates, and cancellation state
 */
export async function handleSubscriptionUpdated(
  sub: Stripe.Subscription,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  // Find subscription by Stripe ID
  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, sub.id))
    .get();

  if (!existing) {
    logger.stripe('subscription_not_found', {
      stripeSubscriptionId: sub.id,
      action: 'skip_update',
    });
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  // Track what changed for logging
  const changes: string[] = [];
  if (existing.status !== sub.status) {
    changes.push(`status: ${existing.status} -> ${sub.status}`);
  }
  if (existing.cancelAtPeriodEnd !== sub.cancel_at_period_end) {
    changes.push(`cancelAtPeriodEnd: ${existing.cancelAtPeriodEnd} -> ${sub.cancel_at_period_end}`);
  }

  // Update subscription state
  await db
    .update(subscription)
    .set({
      status: sub.status,
      periodStart:
        (sub as SubscriptionWithPeriods).current_period_start ?
          new Date((sub as SubscriptionWithPeriods).current_period_start! * 1000)
        : null,
      periodEnd:
        (sub as SubscriptionWithPeriods).current_period_end ?
          new Date((sub as SubscriptionWithPeriods).current_period_end! * 1000)
        : null,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
      // Update plan if changed
      plan: sub.items.data[0]?.price?.lookup_key || existing.plan,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  logger.stripe('subscription_updated', {
    subscriptionId: existing.id,
    stripeSubscriptionId: sub.id,
    orgId: existing.referenceId,
    status: sub.status,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    changes: changes.length > 0 ? changes : ['no_significant_changes'],
  });

  return {
    handled: true,
    result: 'updated',
    ledgerContext: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      orgId: existing.referenceId,
    },
  };
}

/**
 * Handle customer.subscription.deleted
 * Mark subscription as canceled in database
 */
export async function handleSubscriptionDeleted(
  sub: Stripe.Subscription,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, sub.id))
    .get();

  if (!existing) {
    logger.stripe('subscription_not_found_for_delete', {
      stripeSubscriptionId: sub.id,
    });
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  // Mark as canceled with ended timestamp
  await db
    .update(subscription)
    .set({
      status: 'canceled',
      canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : new Date(),
      endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  logger.stripe('subscription_deleted', {
    subscriptionId: existing.id,
    stripeSubscriptionId: sub.id,
    orgId: existing.referenceId,
  });

  return {
    handled: true,
    result: 'deleted',
    ledgerContext: {
      stripeSubscriptionId: sub.id,
      stripeCustomerId: typeof sub.customer === 'string' ? sub.customer : sub.customer?.id,
      orgId: existing.referenceId,
    },
  };
}

/**
 * Handle customer.subscription.paused
 * Mark subscription as paused
 */
export async function handleSubscriptionPaused(
  sub: Stripe.Subscription,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, sub.id))
    .get();

  if (!existing) {
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  await db
    .update(subscription)
    .set({
      status: 'paused',
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  logger.stripe('subscription_paused', {
    subscriptionId: existing.id,
    stripeSubscriptionId: sub.id,
    orgId: existing.referenceId,
  });

  return {
    handled: true,
    result: 'paused',
    ledgerContext: {
      stripeSubscriptionId: sub.id,
      orgId: existing.referenceId,
    },
  };
}

/**
 * Handle customer.subscription.resumed
 * Mark subscription as active again
 */
export async function handleSubscriptionResumed(
  sub: Stripe.Subscription,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeSubscriptionId, sub.id))
    .get();

  if (!existing) {
    return {
      handled: true,
      result: 'subscription_not_found',
      ledgerContext: { stripeSubscriptionId: sub.id },
    };
  }

  await db
    .update(subscription)
    .set({
      status: sub.status || 'active',
      periodStart:
        (sub as SubscriptionWithPeriods).current_period_start ?
          new Date((sub as SubscriptionWithPeriods).current_period_start! * 1000)
        : null,
      periodEnd:
        (sub as SubscriptionWithPeriods).current_period_end ?
          new Date((sub as SubscriptionWithPeriods).current_period_end! * 1000)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(subscription.id, existing.id));

  logger.stripe('subscription_resumed', {
    subscriptionId: existing.id,
    stripeSubscriptionId: sub.id,
    orgId: existing.referenceId,
    newStatus: sub.status,
  });

  return {
    handled: true,
    result: 'resumed',
    ledgerContext: {
      stripeSubscriptionId: sub.id,
      orgId: existing.referenceId,
    },
  };
}
