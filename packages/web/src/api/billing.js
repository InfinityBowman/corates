/**
 * Billing API functions
 * Handles all billing-related API calls
 */

import { API_BASE } from '@config/api.js';

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
  const response = await fetch(`${API_BASE}/api/billing/subscription`, {
    ...fetchOptions,
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch subscription' }));
    throw new Error(error.error || 'Failed to fetch subscription');
  }

  return response.json();
}

/**
 * Get available subscription plans
 * @returns {Promise<{ plans: Array }>}
 */
export async function getPlans() {
  const response = await fetch(`${API_BASE}/api/billing/plans`, {
    ...fetchOptions,
    method: 'GET',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to fetch plans' }));
    throw new Error(error.error || 'Failed to fetch plans');
  }

  return response.json();
}

/**
 * Create a Stripe Checkout session
 * @param {string} tier - The subscription tier to checkout
 * @param {'monthly' | 'yearly'} interval - Billing interval
 * @returns {Promise<{ url: string, sessionId: string }>}
 */
export async function createCheckoutSession(tier, interval = 'monthly') {
  const response = await fetch(`${API_BASE}/api/billing/checkout`, {
    ...fetchOptions,
    method: 'POST',
    body: JSON.stringify({ tier, interval }),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: 'Failed to create checkout session' }));
    throw new Error(error.error || 'Failed to create checkout session');
  }

  return response.json();
}

/**
 * Create a Stripe Customer Portal session
 * @returns {Promise<{ url: string }>}
 */
export async function createPortalSession() {
  const response = await fetch(`${API_BASE}/api/billing/portal`, {
    ...fetchOptions,
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Failed to create portal session' }));
    throw new Error(error.error || 'Failed to create portal session');
  }

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
