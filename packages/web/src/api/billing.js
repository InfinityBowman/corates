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
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createCheckoutSession(tier, interval = 'monthly') {
  return apiFetch.post('/api/billing/checkout', { tier, interval });
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
 */
export async function redirectToCheckout(tier, interval = 'monthly') {
  const { url } = await createCheckoutSession(tier, interval);
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
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createSingleProjectCheckout() {
  return apiFetch.post('/api/billing/single-project/checkout');
}

/**
 * Redirect to Stripe Checkout for Single Project purchase
 */
export async function redirectToSingleProjectCheckout() {
  const { url } = await createSingleProjectCheckout();
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
 * @returns {Promise<{ success: boolean, grantId: string, expiresAt: number }>}
 */
export async function startTrial() {
  return apiFetch.post('/api/billing/trial/start');
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
