/**
 * BillingResolver - Single source of truth for org billing resolution
 * Centralizes subscription status evaluation and grant precedence logic
 */

import { eq, and, desc, isNull } from 'drizzle-orm';
import { subscription, orgAccessGrants } from '../db/schema.js';
import { getActiveGrantsByOrgId } from '../db/orgAccessGrants.js';
import { getPlan, DEFAULT_PLAN, getGrantPlan } from '@corates/shared/plans';

/**
 * Check if a subscription is active based on status and period end
 * This is the ONLY place subscription status evaluation should happen
 * @param {Object} subscription - Subscription record from database
 * @param {Date|number} now - Current timestamp
 * @returns {boolean} True if subscription provides full access
 */
export function isSubscriptionActive(subscription, now) {
  if (!subscription) return false;

  const nowTimestamp = now instanceof Date ? Math.floor(now.getTime() / 1000) : now;
  const status = subscription.status;
  const periodEnd = subscription.periodEnd ?
    (subscription.periodEnd instanceof Date ?
      Math.floor(subscription.periodEnd.getTime() / 1000)
    : subscription.periodEnd)
    : null;

  // trialing: Always active (subscription takes precedence over grants)
  if (status === 'trialing') {
    return true;
  }

  // active: Full access, but check cancelAtPeriodEnd
  if (status === 'active') {
    if (subscription.cancelAtPeriodEnd && periodEnd) {
      // Scheduled cancel: Full access until periodEnd
      return nowTimestamp < periodEnd;
    }
    // Normal active: Full access
    return true;
  }

  // past_due: Full access until periodEnd (grace period)
  if (status === 'past_due') {
    if (!periodEnd) return false;
    return nowTimestamp < periodEnd;
  }

  // Inactive statuses (subscription does not provide access)
  // paused, canceled, unpaid, incomplete, incomplete_expired
  return false;
}

/**
 * Get the active subscription for an org (if any)
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @param {Date|number} now - Current timestamp
 * @returns {Promise<Object | null>}
 */
async function getActiveSubscription(db, orgId, now) {
  // Get all subscriptions for this org (referenceId = orgId)
  const subscriptions = await db
    .select()
    .from(subscription)
    .where(eq(subscription.referenceId, orgId))
    .orderBy(desc(subscription.periodEnd))
    .all();

  if (subscriptions.length === 0) {
    return null;
  }

  // Find all active subscriptions
  const activeSubscriptions = subscriptions.filter(sub => isSubscriptionActive(sub, now));

  if (activeSubscriptions.length === 0) {
    // No active subscriptions - if multiple exist, log warning and return latest periodEnd
    if (subscriptions.length > 1) {
      console.warn(
        `[BillingResolver] Multiple subscriptions found for org ${orgId}, none active. Using latest periodEnd.`,
      );
    }
    return subscriptions[0] || null;
  }

  // If multiple active subscriptions exist (invariant violation), pick the one with latest periodEnd
  if (activeSubscriptions.length > 1) {
    console.warn(
      `[BillingResolver] Multiple active subscriptions found for org ${orgId}. Using latest periodEnd.`,
    );
    // Already sorted by periodEnd desc, so first one is latest
    return activeSubscriptions[0];
  }

  return activeSubscriptions[0];
}

/**
 * Resolve effective access for an organization
 * @param {DrizzleD1Database} db - Drizzle database instance
 * @param {string} orgId - Organization ID
 * @param {Date|number} [now] - Current timestamp (defaults to now)
 * @returns {Promise<Object>} Resolved billing state
 */
export async function resolveOrgAccess(db, orgId, now = new Date()) {
  const nowDate = now instanceof Date ? now : new Date(now * 1000);
  const nowTimestamp = Math.floor(nowDate.getTime() / 1000);

  // 1. Check for active Stripe subscription
  const activeSubscription = await getActiveSubscription(db, orgId, nowTimestamp);

  if (activeSubscription && isSubscriptionActive(activeSubscription, nowTimestamp)) {
    // Subscription takes precedence over grants
    const plan = getPlan(activeSubscription.plan);
    return {
      effectivePlanId: activeSubscription.plan,
      source: 'subscription',
      accessMode: 'full',
      entitlements: plan.entitlements,
      quotas: plan.quotas,
      subscription: {
        id: activeSubscription.id,
        status: activeSubscription.status,
        periodEnd: activeSubscription.periodEnd,
        cancelAtPeriodEnd: activeSubscription.cancelAtPeriodEnd,
      },
      grant: null,
    };
  }

  // 2. Check for active grants (when no active subscription)
  const activeGrants = await getActiveGrantsByOrgId(db, orgId, nowDate);

  if (activeGrants.length > 0) {
    // Precedence: trial > single_project
    // Tie-breaker: latest expiresAt for same type
    let selectedGrant = null;
    let selectedType = null;

    for (const grant of activeGrants) {
      if (grant.type === 'trial') {
        if (!selectedGrant || selectedType !== 'trial') {
          selectedGrant = grant;
          selectedType = 'trial';
        } else {
          // Both are trial, pick latest expiresAt
          const currentExpires = selectedGrant.expiresAt instanceof Date ?
              Math.floor(selectedGrant.expiresAt.getTime() / 1000)
            : selectedGrant.expiresAt;
          const grantExpires = grant.expiresAt instanceof Date ?
              Math.floor(grant.expiresAt.getTime() / 1000)
            : grant.expiresAt;
          if (grantExpires > currentExpires) {
            selectedGrant = grant;
          }
        }
      } else if (grant.type === 'single_project') {
        if (!selectedGrant || selectedType === 'single_project') {
          // Only select if no trial selected, or if this is a better single_project
          if (!selectedGrant || selectedType !== 'trial') {
            if (!selectedGrant) {
              selectedGrant = grant;
              selectedType = 'single_project';
            } else {
              // Both are single_project, pick latest expiresAt
              const currentExpires = selectedGrant.expiresAt instanceof Date ?
                  Math.floor(selectedGrant.expiresAt.getTime() / 1000)
                : selectedGrant.expiresAt;
              const grantExpires = grant.expiresAt instanceof Date ?
                  Math.floor(grant.expiresAt.getTime() / 1000)
                : grant.expiresAt;
              if (grantExpires > currentExpires) {
                selectedGrant = grant;
              }
            }
          }
        }
      }
    }

    if (selectedGrant) {
      const grantPlan = getGrantPlan(selectedGrant.type);
      return {
        effectivePlanId: selectedGrant.type, // Grant type, not a plan ID, but works for resolution
        source: 'grant',
        accessMode: 'full',
        entitlements: grantPlan.entitlements,
        quotas: grantPlan.quotas,
        subscription: null,
        grant: {
          id: selectedGrant.id,
          type: selectedGrant.type,
          expiresAt: selectedGrant.expiresAt,
        },
      };
    }
  }

  // 3. Check for expired grants (read-only access)
  const allGrants = await db
    .select()
    .from(orgAccessGrants)
    .where(and(eq(orgAccessGrants.orgId, orgId), isNull(orgAccessGrants.revokedAt)))
    .orderBy(desc(orgAccessGrants.expiresAt))
    .all();

  const expiredGrants = allGrants.filter(grant => {
    const expiresAt = grant.expiresAt instanceof Date ?
        Math.floor(grant.expiresAt.getTime() / 1000)
      : grant.expiresAt;
    return expiresAt <= nowTimestamp;
  });

  if (expiredGrants.length > 0) {
    // Expired grant provides read-only access
    const expiredGrant = expiredGrants[0]; // Latest expired grant
    const grantPlan = getGrantPlan(expiredGrant.type);
    return {
      effectivePlanId: expiredGrant.type,
      source: 'grant',
      accessMode: 'readOnly',
      entitlements: grantPlan.entitlements,
      quotas: grantPlan.quotas,
      subscription: null,
      grant: {
        id: expiredGrant.id,
        type: expiredGrant.type,
        expiresAt: expiredGrant.expiresAt,
      },
    };
  }

  // 4. Default fallback: free tier (can write to projects they're members of, but cannot create projects)
  const freePlan = getPlan(DEFAULT_PLAN);
  return {
    effectivePlanId: DEFAULT_PLAN,
    source: 'free',
    accessMode: 'free',
    entitlements: freePlan.entitlements,
    quotas: freePlan.quotas,
    subscription: null,
    grant: null,
  };
}
