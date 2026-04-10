/**
 * Stripe client factory
 * Provides a centralized way to create Stripe client instances
 * Ensures consistent API version and configuration across the codebase
 */

import Stripe from 'stripe';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import type { Env } from '@/types';

/**
 * Stripe API version used across the application
 * Update this single constant when upgrading Stripe API version
 */
export const STRIPE_API_VERSION = '2026-02-25.clover' as const;

/**
 * Create a configured Stripe client instance
 * @param env - Environment bindings containing STRIPE_SECRET_KEY
 * @returns Configured Stripe client
 * @throws DomainError if STRIPE_SECRET_KEY is not configured
 */
export function createStripeClient(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw createDomainError(
      SYSTEM_ERRORS.SERVICE_UNAVAILABLE,
      { service: 'stripe' },
      'Stripe is not configured. Missing STRIPE_SECRET_KEY.',
    );
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: STRIPE_API_VERSION,
  });
}

/**
 * Check if Stripe is configured in the environment
 * Useful for conditional logic without throwing errors
 * @param env - Environment bindings
 * @returns true if STRIPE_SECRET_KEY is set
 */
export function isStripeConfigured(env: Env): boolean {
  return !!env.STRIPE_SECRET_KEY;
}
