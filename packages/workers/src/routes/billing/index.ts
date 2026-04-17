/**
 * Billing routes for Hono
 *
 * Handles org-scoped billing status, checkout session creation, and invoices.
 *
 * Webhook processing does NOT live here:
 * - Subscription webhooks → Better Auth stripe plugin at /api/auth/stripe/webhook
 * - One-time purchase webhooks → @corates/stripe-purchases worker at /api/billing/purchases/webhook
 *
 * The subscription table has a single writer (Better Auth). Grants table is
 * written only by the stripe-purchases worker (idempotent via unique
 * checkoutSessionId + stripeEventLedger).
 *
 * See: packages/docs/guides/billing.md
 */

import { $, OpenAPIHono } from '@hono/zod-openapi';
import { billingSubscriptionRoutes } from './subscription.js';
import { billingValidationRoutes } from './validation.js';
import { billingPortalRoutes } from './portal.js';
import { billingGrantRoutes } from './grants.js';
import { billingCheckoutRoutes } from './checkout';
import { billingInvoicesRoutes } from './invoices.js';
import { billingSyncRoutes } from './sync.js';
import type { Env } from '../../types';

const base = new OpenAPIHono<{ Bindings: Env }>();

const billingRoutes = $(base)
  .route('/', billingSubscriptionRoutes)
  .route('/', billingValidationRoutes)
  .route('/', billingPortalRoutes)
  .route('/', billingCheckoutRoutes)
  .route('/', billingGrantRoutes)
  .route('/', billingInvoicesRoutes)
  .route('/', billingSyncRoutes);

export { billingRoutes };
