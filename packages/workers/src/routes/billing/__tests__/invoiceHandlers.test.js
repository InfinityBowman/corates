/**
 * Tests for invoice webhook event handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, seedUser } from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import {
  handleInvoicePaymentSucceeded,
  handleInvoicePaymentFailed,
  handleInvoiceFinalized,
} from '../handlers/invoiceHandlers.js';
import { subscription } from '@/db/schema.js';
import { eq } from 'drizzle-orm';

function createTestContext(db, options = {}) {
  return {
    db,
    logger: {
      stripe: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    env: options.env || {},
  };
}

// Helper to seed a subscription
async function seedSubscription(db, data) {
  await db.insert(subscription).values({
    id: data.id,
    plan: data.plan || 'team',
    referenceId: data.referenceId || 'org-1',
    stripeCustomerId: data.stripeCustomerId || 'cus_123',
    stripeSubscriptionId: data.stripeSubscriptionId,
    status: data.status || 'active',
    periodStart: data.periodStart || new Date(),
    periodEnd: data.periodEnd || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    cancelAtPeriodEnd: data.cancelAtPeriodEnd || false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

describe('Invoice Handlers', () => {
  let db;

  beforeEach(async () => {
    await resetTestDatabase();
    db = createDb(env.DB);
  });

  describe('handleInvoicePaymentSucceeded', () => {
    it('returns not_subscription_invoice when no subscription attached', async () => {
      const invoice = {
        id: 'in_123',
        subscription: null,
        billing_reason: 'manual',
        customer: 'cus_123',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentSucceeded(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('not_subscription_invoice');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('invoice_not_subscription', {
        stripeInvoiceId: 'in_123',
        billingReason: 'manual',
      });
    });

    it('returns subscription_not_found when subscription does not exist', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_nonexistent',
        customer: 'cus_123',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentSucceeded(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('updates subscription to active on payment success', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'past_due',
      });

      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer: 'cus_123',
        amount_paid: 2999,
        currency: 'usd',
        period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentSucceeded(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('payment_succeeded');

      // Verify subscription was updated
      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('active');
    });

    it('handles subscription object instead of string ID', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'past_due',
      });

      const invoice = {
        id: 'in_123',
        subscription: { id: 'sub_123' },
        customer: { id: 'cus_123' },
        amount_paid: 2999,
        currency: 'usd',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentSucceeded(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('payment_succeeded');
    });
  });

  describe('handleInvoicePaymentFailed', () => {
    it('returns not_subscription_invoice when no subscription attached', async () => {
      const invoice = {
        id: 'in_123',
        subscription: null,
        customer: 'cus_123',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('not_subscription_invoice');
    });

    it('returns subscription_not_found when subscription does not exist', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_nonexistent',
        customer: 'cus_123',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('updates subscription to past_due on payment failure', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      });

      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer: 'cus_123',
        amount_due: 2999,
        currency: 'usd',
        attempt_count: 1,
        hosted_invoice_url: 'https://invoice.stripe.com/test',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('payment_failed_processed');

      // Verify subscription was updated
      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('past_due');
    });

    it('queues dunning email when user found and EMAIL_QUEUE available', async () => {
      const nowSec = Math.floor(Date.now() / 1000);

      await seedUser({
        id: 'user-1',
        email: 'billing@example.com',
        name: 'Billing User',
        stripeCustomerId: 'cus_123',
        createdAt: nowSec,
        updatedAt: nowSec,
      });

      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        referenceId: 'org-1',
        status: 'active',
      });

      const mockEmailQueue = {
        get: vi.fn().mockReturnValue({
          queueEmail: vi.fn().mockResolvedValue({ success: true }),
        }),
      };

      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer: 'cus_123',
        amount_due: 2999,
        currency: 'usd',
        attempt_count: 1,
        hosted_invoice_url: 'https://invoice.stripe.com/test',
      };

      const ctx = createTestContext(db, { env: { EMAIL_QUEUE: mockEmailQueue } });
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('payment_failed_processed');
    });

    it('logs when dunning email skipped due to no user', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_orphan',
        status: 'active',
      });

      const mockEmailQueue = {
        get: vi.fn().mockReturnValue({
          queueEmail: vi.fn(),
        }),
      };

      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer: 'cus_orphan',
        amount_due: 2999,
        currency: 'usd',
        attempt_count: 1,
      };

      const ctx = createTestContext(db, { env: { EMAIL_QUEUE: mockEmailQueue } });
      const result = await handleInvoicePaymentFailed(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(ctx.logger.stripe).toHaveBeenCalledWith('dunning_email_skipped_no_user', {
        subscriptionId: 'sub-local-1',
        stripeCustomerId: 'cus_orphan',
      });
    });
  });

  describe('handleInvoiceFinalized', () => {
    it('logs invoice finalization details', async () => {
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        customer: 'cus_123',
        amount_due: 2999,
        currency: 'usd',
        billing_reason: 'subscription_cycle',
        hosted_invoice_url: 'https://invoice.stripe.com/test',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoiceFinalized(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('finalized_logged');
      expect(ctx.logger.stripe).toHaveBeenCalledWith('invoice_finalized', {
        stripeInvoiceId: 'in_123',
        stripeSubscriptionId: 'sub_123',
        stripeCustomerId: 'cus_123',
        amount: 2999,
        currency: 'usd',
        billingReason: 'subscription_cycle',
        hostedInvoiceUrl: 'https://invoice.stripe.com/test',
      });
    });

    it('handles object IDs instead of strings', async () => {
      const invoice = {
        id: 'in_123',
        subscription: { id: 'sub_123' },
        customer: { id: 'cus_123' },
        amount_due: 2999,
        currency: 'usd',
        billing_reason: 'manual',
      };

      const ctx = createTestContext(db);
      const result = await handleInvoiceFinalized(invoice, ctx);

      expect(result.handled).toBe(true);
      expect(result.ledgerContext.stripeSubscriptionId).toBe('sub_123');
      expect(result.ledgerContext.stripeCustomerId).toBe('cus_123');
    });
  });
});
