/**
 * Subscription database queries
 */

import { eq } from 'drizzle-orm';
import { subscriptions } from './schema.js';

/**
 * Get a user's subscription
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} userId - User ID
 * @returns {Promise<Object | null>}
 */
export async function getSubscriptionByUserId(db, userId) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.userId, userId))
    .get();

  return result ?? null;
}

/**
 * Get a subscription by Stripe customer ID
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} stripeCustomerId - Stripe customer ID
 * @returns {Promise<Object | null>}
 */
export async function getSubscriptionByStripeCustomerId(db, stripeCustomerId) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId))
    .get();

  return result ?? null;
}

/**
 * Get a subscription by Stripe subscription ID
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @returns {Promise<Object | null>}
 */
export async function getSubscriptionByStripeSubscriptionId(db, stripeSubscriptionId) {
  const result = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId))
    .get();

  return result ?? null;
}

/**
 * Create or update a subscription for a user
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {Object} data - Subscription data
 * @returns {Promise<Object>}
 */
export async function upsertSubscription(db, data) {
  const {
    id,
    userId,
    stripeCustomerId,
    stripeSubscriptionId,
    tier,
    status,
    currentPeriodStart,
    currentPeriodEnd,
    cancelAtPeriodEnd,
  } = data;

  // Check if subscription exists for this user
  const existing = await getSubscriptionByUserId(db, userId);

  if (existing) {
    // Update existing subscription
    const result = await db
      .update(subscriptions)
      .set({
        stripeCustomerId,
        stripeSubscriptionId,
        tier,
        status,
        currentPeriodStart,
        currentPeriodEnd,
        cancelAtPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(subscriptions.userId, userId))
      .returning()
      .get();

    return result;
  }

  // Create new subscription
  const result = await db
    .insert(subscriptions)
    .values({
      id,
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      tier: tier ?? 'free',
      status: status ?? 'active',
      currentPeriodStart,
      currentPeriodEnd,
      cancelAtPeriodEnd: cancelAtPeriodEnd ?? false,
    })
    .returning()
    .get();

  return result;
}

/**
 * Update subscription status
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} stripeSubscriptionId - Stripe subscription ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object | null>}
 */
export async function updateSubscriptionByStripeId(db, stripeSubscriptionId, updates) {
  await db
    .update(subscriptions)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId));

  // Query the updated record
  const result = await getSubscriptionByStripeSubscriptionId(db, stripeSubscriptionId);
  return result;
}

/**
 * Delete a subscription
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} userId - User ID
 * @returns {Promise<void>}
 */
export async function deleteSubscription(db, userId) {
  await db.delete(subscriptions).where(eq(subscriptions.userId, userId));
}

/**
 * Create a free tier subscription for a new user
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} userId - User ID
 * @param {string} subscriptionId - Unique subscription ID
 * @returns {Promise<Object>}
 */
export async function createFreeSubscription(db, userId, subscriptionId) {
  const result = await db
    .insert(subscriptions)
    .values({
      id: subscriptionId,
      userId,
      tier: 'free',
      status: 'active',
    })
    .returning()
    .get();

  return result;
}
