/**
 * Billing routes for Hono
 * Handles org-scoped billing status (adapter for frontend compatibility)
 * Stripe subscription management is handled by Better Auth Stripe plugin
 *
 * WARNING: HIGH BLAST RADIUS FILE
 *
 * This file controls ALL payment and access features.
 * Changes here impact:
 * - Stripe payment processing (subscriptions + one-time purchases)
 * - User access to paid features (entitlements, quotas)
 * - Webhook idempotency and event processing
 * - Organization billing status and plan resolution
 * - Trial and grant-based access
 *
 * BEFORE MODIFYING:
 * 1. Read: packages/docs/guides/billing.md
 * 2. Understand the two-phase webhook verification pattern (see webhooks.js)
 * 3. Run billing tests: cd packages/workers && pnpm test billing
 * 4. Test with Stripe CLI: stripe listen --forward-to localhost:8787/api/billing/webhook/purchases
 * 5. Verify idempotency (webhooks can be delivered multiple times)
 * 6. NEVER skip signature verification
 * 7. Test both test mode and live mode scenarios
 *
 * CRITICAL PATTERNS:
 * - Webhook ledger prevents duplicate processing (payloadHash + stripeEventId)
 * - orgAccessGrants has unique constraint on checkoutSessionId
 * - Plan resolution respects subscription > grant precedence (see billingResolver.js)
 * - Price IDs must match environment variables exactly
 *
 * See: packages/docs/guides/billing.md for detailed architecture
 */

import { OpenAPIHono } from '@hono/zod-openapi';
import { billingSubscriptionRoutes } from './subscription.js';
import { billingValidationRoutes } from './validation.js';
import { billingPortalRoutes } from './portal.js';
import { billingGrantRoutes } from './grants.js';
import { billingCheckoutRoutes } from './checkout.js';
import { billingWebhookRoutes } from './webhooks.js';
import { billingInvoicesRoutes } from './invoices.js';

const billingRoutes = new OpenAPIHono();

// Mount all routes at root level
// Each sub-router handles its full path (e.g., /subscription, /members, /checkout, etc.)
// Webhook routes mounted FIRST since they don't require auth middleware
billingRoutes.route('/', billingWebhookRoutes);
billingRoutes.route('/', billingSubscriptionRoutes);
billingRoutes.route('/', billingValidationRoutes);
billingRoutes.route('/', billingPortalRoutes);
billingRoutes.route('/', billingCheckoutRoutes);
billingRoutes.route('/', billingGrantRoutes);
billingRoutes.route('/', billingInvoicesRoutes);

export { billingRoutes };
