/**
 * Access control helper functions
 * Provides utilities for checking time-limited access status
 */

/**
 * Check if a subscription has active access
 * @param {Object|null} subscription - Subscription object from API
 * @returns {boolean} True if user has active access
 */
export function hasActiveAccess(subscription) {
  if (!subscription) return false;
  if (subscription.status !== 'active') return false;

  // If no expiration date, access is permanent
  if (!subscription.currentPeriodEnd) return true;

  // Check if expiration is in the future
  // currentPeriodEnd is a timestamp in seconds
  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd > now;
}

/**
 * Check if access has expired
 * @param {Object|null} subscription - Subscription object from API
 * @returns {boolean} True if access has expired
 */
export function isAccessExpired(subscription) {
  if (!subscription) return true; // No subscription = expired/no access
  if (subscription.status !== 'active') return true;

  // If no expiration date, access never expires
  if (!subscription.currentPeriodEnd) return false;

  // Check if expiration is in the past
  const now = Math.floor(Date.now() / 1000);
  return subscription.currentPeriodEnd <= now;
}
