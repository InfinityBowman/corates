/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { API_BASE } from '@config/api.js';
import { handleFetchError } from '@/lib/error-utils.js';

/**
 * Fetch options with credentials
 */
const fetchOptions = {
  credentials: 'include',
  headers: {
    'Content-Type': 'application/json',
  },
};

/**
 * Get the current user's subscription
 * @returns {Promise<Object>}
 */
export async function getSubscription() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/subscription`, {
      ...fetchOptions,
      method: 'GET',
    }),
  );

  return response.json();
}

/**
 * Create a Stripe Checkout session
 * @param {string} tier - The subscription tier to checkout
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createCheckoutSession(tier, interval = 'monthly') {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/checkout`, {
      ...fetchOptions,
      method: 'POST',
      body: JSON.stringify({ tier, interval }),
    }),
  );

  return response.json();
}

/**
 * Create a Stripe Customer Portal session
 * @returns {Promise<{ url: string }>}
 */
export async function createPortalSession() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/portal`, {
      ...fetchOptions,
      method: 'POST',
    }),
  );

  return response.json();
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
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/single-project/checkout`, {
      ...fetchOptions,
      method: 'POST',
    }),
  );

  return response.json();
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
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/members`, {
      ...fetchOptions,
      method: 'GET',
    }),
    { showToast: false },
  );

  return response.json();
}

/**
 * Start a 14-day trial grant for the current org (owner-only)
 * @returns {Promise<{ success: boolean, grantId: string, expiresAt: number }>}
 */
export async function startTrial() {
  const response = await handleFetchError(
    fetch(`${API_BASE}/api/billing/trial/start`, {
      ...fetchOptions,
      method: 'POST',
    }),
  );

  return response.json();
}
