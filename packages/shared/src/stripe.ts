import Stripe from 'stripe';
import { createDomainError, SYSTEM_ERRORS } from './errors/index.js';

export const STRIPE_API_VERSION = '2026-04-22.dahlia' as const;

export function createStripeClient(secretKey: string): Stripe {
  if (!secretKey) {
    throw createDomainError(
      SYSTEM_ERRORS.SERVICE_UNAVAILABLE,
      { service: 'stripe' },
      'Stripe is not configured. Missing STRIPE_SECRET_KEY.',
    );
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION,
  });
}

export function isStripeConfigured(env: { STRIPE_SECRET_KEY?: string }): boolean {
  return !!env.STRIPE_SECRET_KEY;
}
