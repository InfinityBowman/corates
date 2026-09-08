/**
 * Daily sweep that makes the subscription table agree with Stripe.
 *
 * Webhooks and the post-checkout sync keep the table current in the normal
 * case, but a delivery Stripe gives up on, or one lost to an endpoint race,
 * leaves a row wrong until someone notices. This walks every subscription in
 * Stripe and rewrites its row, then cancels rows whose subscription Stripe no
 * longer has. Every row it changed is logged as drift so it shows up in Loki
 * instead of self-healing silently.
 */
import { eq, isNotNull, ne, and } from 'drizzle-orm';
import { subscription } from '@corates/db/schema';
import { createStripeClient } from '@corates/shared/stripe';
import { captureError, info, warn } from '../../lib/logger';
import { applyStripeSubscription } from './syncStripeSubscription';
import type { createDb } from '@corates/db/client';
import type { Env } from '../../types';

type Database = ReturnType<typeof createDb>;

export interface ReconcileResult {
  scanned: number;
  changed: number;
  orphaned: number;
  failed: number;
}

type RowSnapshot = { referenceId: string; status: string; plan: string };

async function snapshotRows(db: Database): Promise<Map<string, RowSnapshot>> {
  const rows = await db
    .select({
      id: subscription.id,
      referenceId: subscription.referenceId,
      status: subscription.status,
      plan: subscription.plan,
    })
    .from(subscription)
    .all();
  return new Map(
    rows.map(r => [r.id, { referenceId: r.referenceId, status: r.status, plan: r.plan }]),
  );
}

export async function reconcileStripeSubscriptions(
  env: Env,
  db: Database,
): Promise<ReconcileResult> {
  const stripe = createStripeClient(env.STRIPE_SECRET_KEY);
  const before = await snapshotRows(db);
  const seen = new Set<string>();
  const result: ReconcileResult = { scanned: 0, changed: 0, orphaned: 0, failed: 0 };

  for await (const sub of stripe.subscriptions.list({
    status: 'all',
    limit: 100,
    expand: ['data.items.data.price'],
  })) {
    result.scanned += 1;
    seen.add(sub.id);
    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
    try {
      await applyStripeSubscription(db, customerId, sub);
    } catch (err) {
      result.failed += 1;
      captureError(err, {
        tags: { component: 'billing', action: 'reconcile' },
        extra: { stripeSubscriptionId: sub.id, stripeCustomerId: customerId },
      });
    }
  }

  // A row pointing at a subscription the list did not return is either from
  // deleted test data or a different Stripe mode. Confirm with a direct read
  // before cancelling so a paginated list hiccup cannot cancel a live plan.
  const unseen = await db
    .select()
    .from(subscription)
    .where(and(isNotNull(subscription.stripeSubscriptionId), ne(subscription.status, 'canceled')))
    .all();
  for (const row of unseen) {
    const stripeSubscriptionId = row.stripeSubscriptionId as string;
    if (seen.has(stripeSubscriptionId)) continue;
    try {
      const sub = await stripe.subscriptions.retrieve(stripeSubscriptionId, {
        expand: ['items.data.price'],
      });
      await applyStripeSubscription(db, row.stripeCustomerId ?? '', sub);
    } catch (err) {
      if ((err as { code?: string }).code !== 'resource_missing') {
        result.failed += 1;
        captureError(err, {
          tags: { component: 'billing', action: 'reconcile' },
          extra: { stripeSubscriptionId, orgId: row.referenceId },
        });
        continue;
      }
      await db
        .update(subscription)
        .set({ status: 'canceled', endedAt: new Date(), updatedAt: new Date() })
        .where(eq(subscription.id, row.id));
      result.orphaned += 1;
      warn('billing.reconcile_orphan_canceled', {
        orgId: row.referenceId,
        stripeSubscriptionId,
        previousStatus: row.status,
      });
    }
  }

  const after = await snapshotRows(db);
  for (const [id, row] of after) {
    const prev = before.get(id);
    if (
      prev &&
      prev.status === row.status &&
      prev.plan === row.plan &&
      prev.referenceId === row.referenceId
    ) {
      continue;
    }
    result.changed += 1;
    warn('billing.reconcile_drift', {
      subscriptionId: id,
      orgId: row.referenceId,
      previousStatus: prev?.status ?? null,
      previousPlan: prev?.plan ?? null,
      status: row.status,
      plan: row.plan,
    });
  }

  info('billing.reconcile_completed', { ...result });
  return result;
}
