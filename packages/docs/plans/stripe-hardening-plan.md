# Stripe Hardening Plan

**Date:** January 8, 2026  
**Branch:** `252-stripe-hardening`  
**Goal:** Bulletproof Stripe integration for subscriptions, one-time payments, and webhooks  
**Approach:** No backwards compatibility - design for correctness and reliability

---

## Executive Summary

CoRATES has a **solid foundation** with the two-phase webhook trust model and ledger system. However, there are critical gaps that could cause payment failures, subscription desync, and lost revenue.

**Current State:**

- Handles only `checkout.session.completed` for one-time purchases
- Better Auth Stripe plugin handles subscriptions (black box)
- No visibility into subscription lifecycle events
- No payment failure recovery

**Target State:**

- Comprehensive webhook coverage (15+ event types)
- Full subscription lifecycle management
- Payment failure recovery with dunning
- Dual idempotency (hash + event ID)
- Background job processing for heavy operations

---

## Phase 1: Foundation (Days 1-3)

### 1.1 Add Event ID Deduplication

**File:** `packages/workers/src/routes/billing/webhooks.js`

**Current:** Only payload hash deduplication (before verification)  
**Target:** Dual deduplication (hash + event ID)

```javascript
// After signature verification, before processing:
const existingEvent = await getLedgerByStripeEventId(db, event.id);
if (existingEvent) {
  logger.stripe('webhook_dedupe_event_id', {
    outcome: 'skipped_duplicate',
    stripeEventId: event.id,
    existingLedgerId: existingEvent.id,
  });
  return c.json({ received: true, skipped: 'duplicate_event_id' }, 200);
}
```

**Why:** Stripe can resend the same event with different payload formatting. Event ID is the authoritative deduplication key.

### 1.2 Create Webhook Event Router

**New File:** `packages/workers/src/routes/billing/webhookRouter.js`

Extract event routing from webhook handler to enable clean event handling:

```javascript
/**
 * Route Stripe events to appropriate handlers
 * Returns { handled: boolean, result: any }
 */
export async function routeStripeEvent(event, ctx) {
  const { type, data } = event;
  const db = ctx.db;
  const logger = ctx.logger;

  switch (type) {
    // One-time purchases (existing)
    case 'checkout.session.completed':
      return handleCheckoutSessionCompleted(data.object, ctx);

    // Subscription lifecycle (new)
    case 'customer.subscription.created':
      return handleSubscriptionCreated(data.object, ctx);
    case 'customer.subscription.updated':
      return handleSubscriptionUpdated(data.object, ctx);
    case 'customer.subscription.deleted':
      return handleSubscriptionDeleted(data.object, ctx);
    case 'customer.subscription.paused':
      return handleSubscriptionPaused(data.object, ctx);
    case 'customer.subscription.resumed':
      return handleSubscriptionResumed(data.object, ctx);

    // Invoice events (new)
    case 'invoice.payment_succeeded':
      return handleInvoicePaymentSucceeded(data.object, ctx);
    case 'invoice.payment_failed':
      return handleInvoicePaymentFailed(data.object, ctx);
    case 'invoice.finalized':
      return handleInvoiceFinalized(data.object, ctx);

    // Payment intent lifecycle (new)
    case 'payment_intent.processing':
      return handlePaymentIntentProcessing(data.object, ctx);
    case 'payment_intent.succeeded':
      return handlePaymentIntentSucceeded(data.object, ctx);
    case 'payment_intent.payment_failed':
      return handlePaymentIntentFailed(data.object, ctx);

    // Customer events (new)
    case 'customer.updated':
      return handleCustomerUpdated(data.object, ctx);
    case 'customer.deleted':
      return handleCustomerDeleted(data.object, ctx);

    default:
      logger.stripe('unhandled_event', { eventType: type });
      return { handled: false, result: null };
  }
}
```

### 1.3 Update Ledger Schema

**File:** `packages/workers/src/db/schema.js`

Add fields for better tracking:

```javascript
// Add to stripeEventLedger table
stripeInvoiceId: text('stripe_invoice_id'),
stripePaymentIntentId: text('stripe_payment_intent_id'),
amount: integer('amount'), // In cents
currency: text('currency'),
failureReason: text('failure_reason'),
retryCount: integer('retry_count').default(0),
```

**Migration:** Generate with DrizzleKit

```bash
cd packages/workers
pnpm drizzle-kit generate
```

---

## Phase 2: Subscription Events (Days 4-7)

### 2.1 Subscription Event Handlers

**New File:** `packages/workers/src/routes/billing/handlers/subscriptionHandlers.js`

```javascript
import { eq } from 'drizzle-orm';
import { subscriptions } from '@/db/schema.js';

/**
 * Handle subscription.updated
 * Syncs subscription status, period dates, and cancellation state
 */
export async function handleSubscriptionUpdated(subscription, ctx) {
  const { db, logger } = ctx;

  // Find subscription by Stripe ID
  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscription.id),
  });

  if (!existing) {
    logger.stripe('subscription_not_found', {
      stripeSubscriptionId: subscription.id,
      action: 'skip_update',
    });
    return { handled: true, result: 'subscription_not_found' };
  }

  // Update subscription state
  await db
    .update(subscriptions)
    .set({
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      canceledAt: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      // Track plan changes
      stripePriceId: subscription.items.data[0]?.price?.id,
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));

  logger.stripe('subscription_updated', {
    subscriptionId: existing.id,
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });

  return { handled: true, result: 'updated' };
}

/**
 * Handle subscription.deleted
 * Mark subscription as canceled in database
 */
export async function handleSubscriptionDeleted(subscription, ctx) {
  const { db, logger } = ctx;

  const existing = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, subscription.id),
  });

  if (!existing) {
    return { handled: true, result: 'subscription_not_found' };
  }

  await db
    .update(subscriptions)
    .set({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, existing.id));

  logger.stripe('subscription_deleted', {
    subscriptionId: existing.id,
    stripeSubscriptionId: subscription.id,
  });

  // Trigger access revocation if needed
  await revokeSubscriptionAccess(existing.orgId, ctx);

  return { handled: true, result: 'deleted' };
}

/**
 * Handle subscription.paused
 */
export async function handleSubscriptionPaused(subscription, ctx) {
  const { db, logger } = ctx;

  await db
    .update(subscriptions)
    .set({
      status: 'paused',
      pausedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, subscription.id));

  logger.stripe('subscription_paused', {
    stripeSubscriptionId: subscription.id,
  });

  return { handled: true, result: 'paused' };
}
```

### 2.2 Subscription Status Mapping

**File:** `packages/workers/src/routes/billing/handlers/subscriptionStatus.js`

```javascript
/**
 * Map Stripe subscription status to CoRATES access level
 */
export const SUBSCRIPTION_STATUS_MAP = {
  // Full access
  active: { hasAccess: true, accessLevel: 'full' },
  trialing: { hasAccess: true, accessLevel: 'full' },

  // Limited access (grace period)
  past_due: { hasAccess: true, accessLevel: 'limited', gracePeriodDays: 7 },
  unpaid: { hasAccess: true, accessLevel: 'limited', gracePeriodDays: 3 },

  // No access
  canceled: { hasAccess: false, accessLevel: 'none' },
  incomplete: { hasAccess: false, accessLevel: 'none' },
  incomplete_expired: { hasAccess: false, accessLevel: 'none' },
  paused: { hasAccess: false, accessLevel: 'none' },
};

/**
 * Determine if org should have access based on subscription status
 */
export function resolveSubscriptionAccess(status, currentPeriodEnd) {
  const mapping = SUBSCRIPTION_STATUS_MAP[status];
  if (!mapping) {
    return { hasAccess: false, accessLevel: 'none', reason: 'unknown_status' };
  }

  // Check grace period for past_due/unpaid
  if (mapping.gracePeriodDays) {
    const gracePeriodEnd = new Date(currentPeriodEnd);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + mapping.gracePeriodDays);

    if (new Date() > gracePeriodEnd) {
      return { hasAccess: false, accessLevel: 'none', reason: 'grace_period_expired' };
    }
  }

  return mapping;
}
```

---

## Phase 3: Payment Failure Recovery (Days 8-10)

### 3.1 Invoice Payment Failed Handler

**File:** `packages/workers/src/routes/billing/handlers/invoiceHandlers.js`

```javascript
/**
 * Handle invoice.payment_failed
 * Update subscription status and trigger dunning flow
 */
export async function handleInvoicePaymentFailed(invoice, ctx) {
  const { db, logger, env } = ctx;

  if (!invoice.subscription) {
    // One-time payment failure - different handling
    return handleOneTimePaymentFailed(invoice, ctx);
  }

  // Find subscription
  const subscription = await db.query.subscriptions.findFirst({
    where: eq(subscriptions.stripeSubscriptionId, invoice.subscription),
  });

  if (!subscription) {
    logger.stripe('subscription_not_found_for_invoice', {
      stripeInvoiceId: invoice.id,
      stripeSubscriptionId: invoice.subscription,
    });
    return { handled: true, result: 'subscription_not_found' };
  }

  // Update subscription to past_due
  await db
    .update(subscriptions)
    .set({
      status: 'past_due',
      lastPaymentFailedAt: new Date(),
      failedPaymentAttempts: sql`failed_payment_attempts + 1`,
      lastFailureReason: invoice.last_payment_error?.message || 'unknown',
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.id, subscription.id));

  // Get org and owner for notification
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, subscription.orgId),
  });

  // Queue dunning email
  await queueDunningEmail(
    {
      subscriptionId: subscription.id,
      orgId: subscription.orgId,
      invoiceUrl: invoice.hosted_invoice_url,
      amountDue: invoice.amount_due,
      currency: invoice.currency,
      attemptCount: invoice.attempt_count,
    },
    ctx,
  );

  logger.stripe('invoice_payment_failed', {
    subscriptionId: subscription.id,
    stripeInvoiceId: invoice.id,
    attemptCount: invoice.attempt_count,
    amountDue: invoice.amount_due,
  });

  return { handled: true, result: 'payment_failed_processed' };
}

/**
 * Handle invoice.payment_succeeded
 * Update subscription status back to active
 */
export async function handleInvoicePaymentSucceeded(invoice, ctx) {
  const { db, logger } = ctx;

  if (!invoice.subscription) {
    return { handled: true, result: 'not_subscription_invoice' };
  }

  // Update subscription to active
  await db
    .update(subscriptions)
    .set({
      status: 'active',
      lastPaymentAt: new Date(),
      failedPaymentAttempts: 0,
      lastFailureReason: null,
      currentPeriodEnd: new Date(invoice.period_end * 1000),
      updatedAt: new Date(),
    })
    .where(eq(subscriptions.stripeSubscriptionId, invoice.subscription));

  logger.stripe('invoice_payment_succeeded', {
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: invoice.subscription,
    amount: invoice.amount_paid,
  });

  return { handled: true, result: 'payment_succeeded' };
}
```

### 3.2 Dunning Email Queue

**File:** `packages/workers/src/routes/billing/handlers/dunning.js`

```javascript
/**
 * Queue dunning email based on attempt count
 */
export async function queueDunningEmail(params, ctx) {
  const { subscriptionId, orgId, invoiceUrl, amountDue, currency, attemptCount } = params;
  const { env, logger } = ctx;

  // Different messaging based on attempt count
  const templates = {
    1: {
      subject: 'Payment failed - please update your payment method',
      urgency: 'low',
    },
    2: {
      subject: 'Second payment attempt failed - action required',
      urgency: 'medium',
    },
    3: {
      subject: 'Final notice - your subscription will be canceled',
      urgency: 'high',
    },
  };

  const template = templates[attemptCount] || templates[3];

  // Queue email via Cloudflare Queue (or direct send for now)
  // TODO: Implement Cloudflare Queue for async email sending
  logger.stripe('dunning_email_queued', {
    subscriptionId,
    orgId,
    attemptCount,
    urgency: template.urgency,
  });

  // For now, log the dunning event
  // In production, integrate with email service (Resend, SendGrid, etc.)
}
```

---

## Phase 4: Customer Sync (Days 11-12)

### 4.1 Customer Event Handlers

**File:** `packages/workers/src/routes/billing/handlers/customerHandlers.js`

```javascript
/**
 * Handle customer.updated
 * Sync customer email and metadata changes
 */
export async function handleCustomerUpdated(customer, ctx) {
  const { db, logger } = ctx;

  // Find user by Stripe customer ID
  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customer.id),
  });

  if (!user) {
    logger.stripe('customer_not_found', {
      stripeCustomerId: customer.id,
    });
    return { handled: true, result: 'customer_not_found' };
  }

  // Check if email changed (important for billing notifications)
  if (customer.email && customer.email !== user.email) {
    logger.stripe('customer_email_mismatch', {
      stripeCustomerId: customer.id,
      stripeEmail: customer.email,
      userEmail: user.email,
      action: 'log_only', // Don't auto-update - could be intentional
    });
  }

  // Update metadata if needed
  await db
    .update(users)
    .set({
      stripeCustomerMetadata: customer.metadata,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { handled: true, result: 'updated' };
}

/**
 * Handle customer.deleted
 * Mark customer as deleted (don't hard delete for audit trail)
 */
export async function handleCustomerDeleted(customer, ctx) {
  const { db, logger } = ctx;

  const user = await db.query.users.findFirst({
    where: eq(users.stripeCustomerId, customer.id),
  });

  if (!user) {
    return { handled: true, result: 'customer_not_found' };
  }

  // Don't delete user - just clear Stripe ID and log
  await db
    .update(users)
    .set({
      stripeCustomerId: null,
      stripeCustomerDeletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  logger.stripe('customer_deleted', {
    stripeCustomerId: customer.id,
    userId: user.id,
  });

  return { handled: true, result: 'deleted' };
}
```

---

## Phase 5: Payment Intent Tracking (Days 13-14)

### 5.1 Payment Intent Handlers

**File:** `packages/workers/src/routes/billing/handlers/paymentIntentHandlers.js`

```javascript
/**
 * Handle payment_intent.processing
 * ACH payments take 3-5 business days
 */
export async function handlePaymentIntentProcessing(paymentIntent, ctx) {
  const { db, logger } = ctx;

  // Log for visibility
  logger.stripe('payment_intent_processing', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    paymentMethod: paymentIntent.payment_method_types?.[0],
  });

  // If this is for a checkout session, we might want to show "processing" status
  // Most relevant for ACH payments

  return { handled: true, result: 'processing_logged' };
}

/**
 * Handle payment_intent.succeeded
 * Final confirmation that payment is complete
 */
export async function handlePaymentIntentSucceeded(paymentIntent, ctx) {
  const { db, logger } = ctx;

  logger.stripe('payment_intent_succeeded', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // Most processing happens in invoice.payment_succeeded
  // This is mainly for logging and edge cases

  return { handled: true, result: 'succeeded_logged' };
}

/**
 * Handle payment_intent.payment_failed
 * Log failure details for debugging
 */
export async function handlePaymentIntentFailed(paymentIntent, ctx) {
  const { db, logger } = ctx;

  const error = paymentIntent.last_payment_error;

  logger.stripe('payment_intent_failed', {
    stripePaymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    errorCode: error?.code,
    errorMessage: error?.message,
    errorType: error?.type,
    declineCode: error?.decline_code,
  });

  return { handled: true, result: 'failure_logged' };
}
```

---

## Phase 6: Integration & Testing (Days 15-17)

### 6.1 Unified Webhook Handler

**Update:** `packages/workers/src/routes/billing/webhooks.js`

Replace the current monolithic handler with the router:

```javascript
import { routeStripeEvent } from './webhookRouter.js';

// In the webhook handler, after signature verification:
const result = await routeStripeEvent(event, {
  db,
  logger,
  env: c.env,
  requestId: logger.requestId,
});

// Update ledger based on result
await updateLedgerWithVerifiedFields(db, ledgerId, {
  stripeEventId: event.id,
  type: event.type,
  livemode: event.livemode,
  apiVersion: event.api_version,
  created: new Date(event.created * 1000),
  status: result.handled ? LedgerStatus.PROCESSED : LedgerStatus.SKIPPED_UNHANDLED,
  httpStatus: 200,
  // Add context from handler
  ...extractLedgerContext(event),
});
```

### 6.2 Test Suite

**File:** `packages/workers/src/routes/billing/__tests__/webhookHandlers.test.js`

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSubscriptionUpdated } from '../handlers/subscriptionHandlers.js';
import { handleInvoicePaymentFailed } from '../handlers/invoiceHandlers.js';

describe('Webhook Handlers', () => {
  describe('handleSubscriptionUpdated', () => {
    it('updates subscription status to past_due', async () => {
      const subscription = {
        id: 'sub_123',
        status: 'past_due',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: 'price_123' } }] },
      };

      const ctx = createMockContext();
      const result = await handleSubscriptionUpdated(subscription, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.db.update).toHaveBeenCalled();
    });

    it('handles subscription not found gracefully', async () => {
      const subscription = { id: 'sub_nonexistent', status: 'active' };
      const ctx = createMockContext({ subscriptionExists: false });

      const result = await handleSubscriptionUpdated(subscription, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('updates subscription and queues dunning email', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        amount_due: 2999,
        currency: 'usd',
        attempt_count: 1,
        hosted_invoice_url: 'https://invoice.stripe.com/...',
      };

      const ctx = createMockContext();
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.db.update).toHaveBeenCalled();
    });
  });
});
```

### 6.3 Stripe CLI Testing

```bash
# Forward all webhooks to local
stripe listen --forward-to localhost:8787/api/billing/purchases/webhook

# Test individual events
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger invoice.payment_succeeded
stripe trigger invoice.payment_failed
stripe trigger payment_intent.succeeded
stripe trigger payment_intent.payment_failed
stripe trigger customer.updated
```

---

## Implementation Checklist

### Week 1: Foundation

- [ ] Add event ID deduplication to webhook handler
- [ ] Create webhook event router
- [ ] Update ledger schema with new fields
- [ ] Generate and apply migration

### Week 2: Subscription Events

- [ ] Implement `handleSubscriptionCreated`
- [ ] Implement `handleSubscriptionUpdated`
- [ ] Implement `handleSubscriptionDeleted`
- [ ] Implement `handleSubscriptionPaused`
- [ ] Implement `handleSubscriptionResumed`
- [ ] Add subscription status mapping

### Week 3: Payment Events

- [ ] Implement `handleInvoicePaymentSucceeded`
- [ ] Implement `handleInvoicePaymentFailed`
- [ ] Implement dunning email queue
- [ ] Implement `handlePaymentIntentProcessing`
- [ ] Implement `handlePaymentIntentSucceeded`
- [ ] Implement `handlePaymentIntentFailed`

### Week 4: Customer & Testing

- [ ] Implement `handleCustomerUpdated`
- [ ] Implement `handleCustomerDeleted`
- [ ] Write comprehensive test suite
- [ ] Test with Stripe CLI
- [ ] Deploy to staging and verify

---

## File Structure

```
packages/workers/src/routes/billing/
├── webhooks.js                    # Main webhook endpoint (updated)
├── webhookRouter.js               # Event routing (new)
├── handlers/
│   ├── index.js                   # Re-exports all handlers
│   ├── checkoutHandlers.js        # checkout.session.completed (move from webhooks.js)
│   ├── subscriptionHandlers.js    # customer.subscription.* (new)
│   ├── invoiceHandlers.js         # invoice.* (new)
│   ├── paymentIntentHandlers.js   # payment_intent.* (new)
│   ├── customerHandlers.js        # customer.* (new)
│   ├── subscriptionStatus.js      # Status mapping utilities (new)
│   └── dunning.js                 # Dunning email logic (new)
└── __tests__/
    ├── webhookHandlers.test.js    # Handler unit tests
    └── webhookRouter.test.js      # Router integration tests
```

---

## Monitoring & Alerting

### Metrics to Track

1. **Webhook delivery rate** - Should be ~100%
2. **Event processing time** - Target < 500ms
3. **Failed events by type** - Alert on spikes
4. **Subscription status distribution** - Track past_due %
5. **Payment failure rate** - Alert if > 5%

### Alerting Rules

```javascript
// Alert if too many failed webhooks
if (failedWebhooksLast5Minutes > 10) {
  alert('High webhook failure rate');
}

// Alert if subscription cancellation spike
if (canceledSubscriptionsLastHour > normalRate * 2) {
  alert('Subscription cancellation spike');
}

// Alert if payment failure spike
if (failedPaymentsLastHour > normalRate * 3) {
  alert('Payment failure spike - check Stripe status');
}
```

---

## Rollout Strategy

1. **Deploy to staging** with all new handlers
2. **Enable Stripe webhook events** in Stripe Dashboard (staging)
3. **Test each event type** with Stripe CLI
4. **Monitor ledger** for any failures
5. **Deploy to production** with same webhook configuration
6. **Gradual traffic increase** if using webhook endpoint versioning

---

## Success Criteria

- [ ] All 15 event types have handlers
- [ ] Zero webhook delivery failures in Stripe Dashboard
- [ ] Subscriptions stay in sync with Stripe
- [ ] Payment failures trigger dunning within 1 hour
- [ ] Test coverage > 90% for handlers
- [ ] No duplicate event processing (verified via ledger)

---

**Document Version:** 1.0  
**Author:** GitHub Copilot  
**Status:** Ready for Implementation
