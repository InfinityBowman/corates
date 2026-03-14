/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { apiFetch } from '@/lib/apiFetch.js';

/**
 * Get the current user's subscription
 * @returns {Promise<Object>}
 */
export async function getSubscription() {
  return apiFetch.get('/api/billing/subscription');
}

/**
 * Create a Stripe Checkout session
 * @param {string} tier - The subscription tier to checkout
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showToast=true] - Whether to show toast on error
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createCheckoutSession(tier, interval = 'monthly', options = {}) {
  return apiFetch.post('/api/billing/checkout', { tier, interval }, options);
}

/**
 * Create a Stripe Customer Portal session
 * @returns {Promise<{ url: string }>}
 */
export async function createPortalSession() {
  return apiFetch.post('/api/billing/portal');
}

/**
 * Redirect to Stripe Checkout
 * @param {string} tier - The subscription tier
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showToast=false] - Whether to show toast on error (default false for redirect flows)
 */
export async function redirectToCheckout(tier, interval = 'monthly', options = {}) {
  // Default showToast to false for redirect flows - caller handles errors
  const { url } = await createCheckoutSession(tier, interval, { showToast: false, ...options });
  window.location.href = url;
}

/**
 * Redirect to Stripe Customer Portal
 */
export async function redirectToPortal() {
  const { url } = await createPortalSession();
  window.location.href = url;
}

/**
 * Create a Stripe Checkout session for one-time Single Project purchase
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showToast=true] - Whether to show toast on error
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createSingleProjectCheckout(options = {}) {
  return apiFetch.post('/api/billing/single-project/checkout', {}, options);
}

/**
 * Redirect to Stripe Checkout for Single Project purchase
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showToast=false] - Whether to show toast on error (default false for redirect flows)
 */
export async function redirectToSingleProjectCheckout(options = {}) {
  // Default showToast to false for redirect flows - caller handles errors
  const { url } = await createSingleProjectCheckout({ showToast: false, ...options });
  window.location.href = url;
}

/**
 * Get the current org's members
 * @returns {Promise<{ members: Array, count: number }>}
 */
export async function getMembers() {
  return apiFetch.get('/api/billing/members', { toastMessage: false });
}

/**
 * Start a 14-day trial grant for the current org (owner-only)
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.showToast=false] - Whether to show toast on error (default false - caller handles)
 * @returns {Promise<{ success: boolean, grantId: string, expiresAt: number }>}
 */
export async function startTrial(options = {}) {
  // Default showToast to false - caller handles errors with specific messages
  return apiFetch.post('/api/billing/trial/start', {}, { showToast: false, ...options });
}

/**
 * Validate if a plan change is allowed
 * Checks if current usage would exceed the target plan's quotas
 * @param {string} targetPlan - The target plan ID to validate
 * @returns {Promise<{
 *   valid: boolean,
 *   violations: Array<{ quotaKey: string, current: number, limit: number, message: string }>,
 *   targetPlan: { id: string, name: string, quotas: object },
 *   currentUsage: { projects: number, collaborators: number }
 * }>}
 */
export async function validatePlanChange(targetPlan) {
  return apiFetch.get(
    `/api/billing/validate-plan-change?targetPlan=${encodeURIComponent(targetPlan)}`,
    { toastMessage: false },
  );
}
