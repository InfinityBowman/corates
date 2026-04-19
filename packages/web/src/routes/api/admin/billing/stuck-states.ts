/**
 * Admin billing stuck-states (global)
 *
 * GET /api/admin/billing/stuck-states — sweep across all orgs and return any
 * with stuck billing states (incomplete subs older than threshold, processed
 * checkouts without a subscription row, repeated webhook failures).
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { stripeEventLedger, subscription } from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { LedgerStatus } from '@corates/db/stripe-event-ledger';
import { adminMiddleware } from '@/server/middleware/admin';

interface StuckOrg {
  type: string;
  orgId?: string;
  subscriptionId?: string;
  stripeSubscriptionId?: string | null;
  status?: string;
  ageMinutes?: number;
  ledgerId?: string;
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  failedCount?: number;
}

export const handleGet = async ({ request }: { request: Request }) => {
  const url = new URL(request.url);
  const incompleteThresholdMinutes = parseInt(
    url.searchParams.get('incompleteThreshold') || '30',
    10,
  );
  const limit = parseInt(url.searchParams.get('limit') || '50', 10);

  const db = createDb(env.DB);

  try {
    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000);
    const thresholdTimestamp = nowTimestamp - incompleteThresholdMinutes * 60;

    const stuckOrgs: StuckOrg[] = [];

    const incompleteSubscriptions = await db
      .select({
        id: subscription.id,
        referenceId: subscription.referenceId,
        status: subscription.status,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        createdAt: subscription.createdAt,
      })
      .from(subscription)
      .where(eq(subscription.status, 'incomplete'))
      .orderBy(desc(subscription.createdAt))
      .limit(limit)
      .all();

    for (const sub of incompleteSubscriptions) {
      if (!sub.createdAt) continue;
      const createdAtTimestamp =
        sub.createdAt instanceof Date ? Math.floor(sub.createdAt.getTime() / 1000) : sub.createdAt;

      if (createdAtTimestamp < thresholdTimestamp) {
        stuckOrgs.push({
          type: 'incomplete_subscription',
          orgId: sub.referenceId,
          subscriptionId: sub.id,
          stripeSubscriptionId: sub.stripeSubscriptionId,
          status: sub.status,
          ageMinutes: Math.round((nowTimestamp - createdAtTimestamp) / 60),
        });
      }
    }

    const recentCheckouts = await db
      .select()
      .from(stripeEventLedger)
      .where(eq(stripeEventLedger.type, 'checkout.session.completed'))
      .orderBy(desc(stripeEventLedger.receivedAt))
      .limit(limit)
      .all();

    for (const event of recentCheckouts) {
      if (event.status !== LedgerStatus.PROCESSED || !event.orgId) continue;

      const processedAtTimestamp =
        event.processedAt instanceof Date ?
          Math.floor(event.processedAt.getTime() / 1000)
        : (event.processedAt as number | null);

      if (!processedAtTimestamp || nowTimestamp - processedAtTimestamp < 15 * 60) continue;

      const orgSub = await db
        .select({ id: subscription.id })
        .from(subscription)
        .where(eq(subscription.referenceId, event.orgId))
        .limit(1)
        .get();

      if (!orgSub) {
        stuckOrgs.push({
          type: 'checkout_no_subscription',
          orgId: event.orgId,
          ledgerId: event.id,
          stripeEventId: event.stripeEventId,
          stripeCheckoutSessionId: event.stripeCheckoutSessionId,
          ageMinutes: Math.round((nowTimestamp - processedAtTimestamp) / 60),
        });
      }
    }

    const failedWebhooks = await db
      .select({ orgId: stripeEventLedger.orgId })
      .from(stripeEventLedger)
      .where(eq(stripeEventLedger.status, LedgerStatus.FAILED))
      .all();

    const failureCounts: Record<string, number> = failedWebhooks.reduce(
      (acc, w) => {
        if (w.orgId) acc[w.orgId] = (acc[w.orgId] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    for (const [orgId, count] of Object.entries(failureCounts)) {
      if (count >= 3) {
        stuckOrgs.push({
          type: 'repeated_failures',
          orgId,
          failedCount: count,
        });
      }
    }

    return Response.json(
      {
        checkedAt: now.toISOString(),
        thresholds: { incompleteMinutes: incompleteThresholdMinutes },
        totalStuckOrgs: stuckOrgs.length,
        stuckOrgs,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error finding stuck states:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'find_stuck_states',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/billing/stuck-states')({
  server: {
    middleware: [adminMiddleware],
    handlers: { GET: handleGet },
  },
});
