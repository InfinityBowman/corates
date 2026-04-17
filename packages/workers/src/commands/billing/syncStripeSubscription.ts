/**
 * Sync canonical subscription state from Stripe to the local DB.
 *
 * Called from the /sync-after-success endpoint to close the race where a user
 * lands on the billing page before Better Auth's webhook has written the
 * subscription row. Re-fetches the latest subscription from Stripe and
 * overwrites the row, so the DB reflects Stripe rather than whatever partial
 * payload arrived (or didn't).
 *
 * Safe to run concurrently with Better Auth's webhook handler: both write
 * canonical state derived from the same Stripe read.
 */
import { eq } from 'drizzle-orm';
import { subscription } from '@corates/db/schema';
import { createStripeClient } from '../../lib/stripe.js';
import type { createDb } from '@corates/db/client';
import type { Env } from '../../types';

type Database = ReturnType<typeof createDb>;

export interface SyncStripeSubscriptionResult {
  status: string;
  stripeSubscriptionId: string | null;
}

export async function syncStripeSubscription(
  env: Env,
  db: Database,
  customerId: string,
): Promise<SyncStripeSubscriptionResult> {
  const stripe = createStripeClient(env);

  const list = await stripe.subscriptions.list({
    customer: customerId,
    limit: 1,
    status: 'all',
    expand: ['data.items.data.price'],
  });

  const existing = await db
    .select()
    .from(subscription)
    .where(eq(subscription.stripeCustomerId, customerId))
    .get();

  if (list.data.length === 0) {
    if (existing && existing.status !== 'canceled') {
      await db
        .update(subscription)
        .set({ status: 'canceled', endedAt: new Date(), updatedAt: new Date() })
        .where(eq(subscription.id, existing.id));
    }
    return { status: 'none', stripeSubscriptionId: null };
  }

  const sub = list.data[0];
  const item = sub.items.data[0];
  const orgId = sub.metadata?.orgId ?? sub.metadata?.referenceId ?? existing?.referenceId;

  if (!orgId) {
    return { status: sub.status, stripeSubscriptionId: sub.id };
  }

  const values = {
    plan: item?.price?.lookup_key ?? existing?.plan ?? 'unknown',
    referenceId: orgId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status: sub.status,
    periodStart: item?.current_period_start ? new Date(item.current_period_start * 1000) : null,
    periodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelAt: sub.cancel_at ? new Date(sub.cancel_at * 1000) : null,
    canceledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    endedAt: sub.ended_at ? new Date(sub.ended_at * 1000) : null,
    trialStart: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
    trialEnd: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
    updatedAt: new Date(),
  };

  if (existing) {
    await db.update(subscription).set(values).where(eq(subscription.id, existing.id));
  } else {
    await db.insert(subscription).values({
      id: crypto.randomUUID(),
      createdAt: new Date(),
      ...values,
    });
  }

  return { status: sub.status, stripeSubscriptionId: sub.id };
}
