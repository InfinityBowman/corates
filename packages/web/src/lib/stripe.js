/**
 * Stripe initialization
 * Loads and initializes Stripe.js for client-side usage
 */

import { loadStripe } from '@stripe/stripe-js';

const STRIPE_PUBLISHABLE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

let stripePromise = null;

/**
 * Get or initialize Stripe instance
 * @returns {Promise<import('@stripe/stripe-js').Stripe | null>}
 */
export async function getStripe() {
  if (!STRIPE_PUBLISHABLE_KEY) {
    console.warn('VITE_STRIPE_PUBLISHABLE_KEY is not set');
    return null;
  }

  if (!stripePromise) {
    stripePromise = loadStripe(STRIPE_PUBLISHABLE_KEY);
  }

  return stripePromise;
}
