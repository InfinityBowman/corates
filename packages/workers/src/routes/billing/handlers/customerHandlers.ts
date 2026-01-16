/**
 * Customer webhook event handlers
 *
 * Handles Stripe customer lifecycle events for data synchronization.
 * These events ensure local customer data stays in sync with Stripe.
 */
import type Stripe from 'stripe';
import { eq } from 'drizzle-orm';
import { user } from '@/db/schema.js';
import type { WebhookContext, WebhookResult } from './types.js';
import { createDb } from '@/db/client.js';

// Helper to get typed db from context
function getDb(ctx: WebhookContext) {
  return ctx.db as ReturnType<typeof createDb>;
}

/**
 * Handle customer.updated events
 *
 * Syncs customer metadata changes from Stripe to local records.
 * Important for keeping email, name, and metadata in sync.
 */
export async function handleCustomerUpdated(
  customer: Stripe.Customer,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  const stripeCustomerId = customer.id;

  // Find the user by their Stripe customer ID
  const existingUser = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.stripeCustomerId, stripeCustomerId),
  });

  if (!existingUser) {
    logger.stripe('customer_updated_user_not_found', {
      stripeCustomerId,
      customerEmail: customer.email,
    });

    return {
      handled: true,
      result: 'user_not_found',
      ledgerContext: {
        stripeCustomerId,
        reason: 'no_matching_user',
      },
    };
  }

  // Extract syncable fields from Stripe customer
  const updates: { name?: string } = {};
  let hasChanges = false;

  // Only sync email if it changed and Stripe is the source of truth
  // Be careful here - some apps prefer local email as authoritative
  if (customer.email && customer.email !== existingUser.email) {
    // Log but don't auto-update email (could break auth)
    logger.stripe('customer_email_mismatch', {
      userId: existingUser.id,
      localEmail: existingUser.email,
      stripeEmail: customer.email,
    });
  }

  // Sync name if available
  if (customer.name && customer.name !== existingUser.name) {
    updates.name = customer.name;
    hasChanges = true;
  }

  if (hasChanges) {
    await db
      .update(user)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(user.id, existingUser.id));

    logger.stripe('customer_updated_synced', {
      userId: existingUser.id,
      stripeCustomerId,
      fieldsUpdated: Object.keys(updates),
    });
  }

  return {
    handled: true,
    result: hasChanges ? 'user_updated' : 'no_changes',
    ledgerContext: {
      userId: existingUser.id,
      stripeCustomerId,
      fieldsUpdated: Object.keys(updates),
    },
  };
}

/**
 * Handle customer.deleted events
 *
 * Handles customer deletion from Stripe. This is a rare event that
 * typically only happens via Stripe Dashboard or API deletion.
 * We don't delete the user, just clear their Stripe association.
 */
export async function handleCustomerDeleted(
  customer: Stripe.Customer,
  ctx: WebhookContext,
): Promise<WebhookResult> {
  const db = getDb(ctx);
  const { logger } = ctx;

  const stripeCustomerId = customer.id;

  // Find the user by their Stripe customer ID
  const existingUser = await db.query.user.findFirst({
    where: (user, { eq }) => eq(user.stripeCustomerId, stripeCustomerId),
  });

  if (!existingUser) {
    logger.stripe('customer_deleted_user_not_found', {
      stripeCustomerId,
    });

    return {
      handled: true,
      result: 'user_not_found',
      ledgerContext: {
        stripeCustomerId,
        reason: 'no_matching_user',
      },
    };
  }

  // Clear the Stripe customer association but keep the user
  // The user can create a new Stripe customer if needed
  await db
    .update(user)
    .set({
      stripeCustomerId: null,
      updatedAt: new Date(),
    })
    .where(eq(user.id, existingUser.id));

  logger.stripe('customer_deleted_association_cleared', {
    userId: existingUser.id,
    stripeCustomerId,
  });

  return {
    handled: true,
    result: 'association_cleared',
    ledgerContext: {
      userId: existingUser.id,
      stripeCustomerId,
      action: 'stripe_customer_id_cleared',
    },
  };
}
