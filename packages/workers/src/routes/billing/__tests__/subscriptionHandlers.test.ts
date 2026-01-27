/**
 * Tests for subscription webhook event handlers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import type Stripe from 'stripe';
import { resetTestDatabase } from '@/__tests__/helpers.js';
import { createDb } from '@/db/client.js';
import type { Database } from '@/db/client.js';
import {
  handleSubscriptionCreated,
  handleSubscriptionUpdated,
  handleSubscriptionDeleted,
  handleSubscriptionPaused,
  handleSubscriptionResumed,
} from '../handlers/subscriptionHandlers.js';
import { subscription } from '@/db/schema.js';
import { eq } from 'drizzle-orm';
import type { WebhookContext } from '../handlers/types.js';

function createTestContext(db: Database): WebhookContext {
  return {
    db,
    logger: {
      stripe: vi.fn(),
      error: vi.fn(),
    },
    env: undefined,
  };
}

interface SeedSubscriptionData {
  id: string;
  plan?: string;
  referenceId?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId: string;
  status?: string;
  periodStart?: Date;
  periodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

async function seedSubscription(db: Database, data: SeedSubscriptionData): Promise<void> {
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

describe('Subscription Handlers', () => {
  let db: Database;

  beforeEach(async () => {
    await resetTestDatabase();
    db = createDb(env.DB);
  });

  describe('handleSubscriptionCreated', () => {
    it('returns already_exists when subscription already exists', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_existing',
      });

      const stripeSub = {
        id: 'sub_existing',
        status: 'active',
        customer: 'cus_123',
        metadata: { orgId: 'org-1' },
        items: { data: [{ price: { lookup_key: 'team' } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionCreated(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('already_exists');
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'subscription_already_exists',
        expect.objectContaining({
          stripeSubscriptionId: 'sub_existing',
          existingId: 'sub-local-1',
        }),
      );
    });

    it('returns missing_org_id when metadata lacks orgId', async () => {
      const stripeSub = {
        id: 'sub_new',
        status: 'active',
        customer: 'cus_123',
        metadata: {},
        items: { data: [{ price: { lookup_key: 'team' } }] },
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionCreated(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('missing_org_id');
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'subscription_missing_org_id',
        expect.objectContaining({
          stripeSubscriptionId: 'sub_new',
        }),
      );
    });

    it('creates subscription when valid and not existing', async () => {
      const stripeSub = {
        id: 'sub_new',
        status: 'trialing',
        customer: 'cus_456',
        metadata: { orgId: 'org-new' },
        items: { data: [{ price: { lookup_key: 'enterprise' } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: false,
        trial_start: Math.floor(Date.now() / 1000),
        trial_end: Math.floor(Date.now() / 1000) + 86400 * 14,
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionCreated(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('created');
      expect(result.ledgerContext!.orgId).toBe('org-new');
      expect(ctx.logger.stripe).toHaveBeenCalledWith(
        'subscription_created',
        expect.objectContaining({
          stripeSubscriptionId: 'sub_new',
          orgId: 'org-new',
          status: 'trialing',
        }),
      );

      // Verify subscription was created in DB
      const [created] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.stripeSubscriptionId, 'sub_new'));

      expect(created).toBeDefined();
      expect(created.status).toBe('trialing');
      expect(created.plan).toBe('enterprise');
      expect(created.referenceId).toBe('org-new');
    });
  });

  describe('handleSubscriptionUpdated', () => {
    it('returns subscription_not_found when subscription does not exist', async () => {
      const stripeSub = {
        id: 'sub_nonexistent',
        status: 'active',
        customer: 'cus_123',
        items: { data: [{ price: { lookup_key: 'team' } }] },
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionUpdated(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('updates subscription status from active to past_due', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      });

      const stripeSub = {
        id: 'sub_123',
        status: 'past_due',
        customer: 'cus_123',
        items: { data: [{ price: { lookup_key: 'team' } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: false,
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionUpdated(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('updated');

      // Verify status was updated
      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('past_due');
    });

    it('updates cancelAtPeriodEnd when changed', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        cancelAtPeriodEnd: false,
      });

      const stripeSub = {
        id: 'sub_123',
        status: 'active',
        customer: 'cus_123',
        items: { data: [{ price: { lookup_key: 'team' } }] },
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
        cancel_at_period_end: true,
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionUpdated(stripeSub, ctx);

      expect(result.handled).toBe(true);

      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.cancelAtPeriodEnd).toBeTruthy();
    });
  });

  describe('handleSubscriptionDeleted', () => {
    it('returns subscription_not_found when subscription does not exist', async () => {
      const stripeSub = { id: 'sub_nonexistent' } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionDeleted(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('marks subscription as canceled', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      });

      const stripeSub = {
        id: 'sub_123',
        customer: 'cus_123',
        canceled_at: Math.floor(Date.now() / 1000),
        ended_at: Math.floor(Date.now() / 1000),
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionDeleted(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('deleted');

      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('canceled');
      expect(updated.canceledAt).toBeDefined();
      expect(updated.endedAt).toBeDefined();
    });
  });

  describe('handleSubscriptionPaused', () => {
    it('returns subscription_not_found when subscription does not exist', async () => {
      const stripeSub = { id: 'sub_nonexistent' } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionPaused(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('marks subscription as paused', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'active',
      });

      const stripeSub = { id: 'sub_123' } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionPaused(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('paused');

      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('paused');
    });
  });

  describe('handleSubscriptionResumed', () => {
    it('returns subscription_not_found when subscription does not exist', async () => {
      const stripeSub = { id: 'sub_nonexistent' } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionResumed(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('subscription_not_found');
    });

    it('marks subscription as active when resumed', async () => {
      await seedSubscription(db, {
        id: 'sub-local-1',
        stripeSubscriptionId: 'sub_123',
        status: 'paused',
      });

      const stripeSub = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400 * 30,
      } as unknown as Stripe.Subscription;

      const ctx = createTestContext(db);
      const result = await handleSubscriptionResumed(stripeSub, ctx);

      expect(result.handled).toBe(true);
      expect(result.result).toBe('resumed');

      const [updated] = await db
        .select()
        .from(subscription)
        .where(eq(subscription.id, 'sub-local-1'));

      expect(updated.status).toBe('active');
    });
  });
});
