import type { Database } from '@corates/db/client';
import { stripeEventLedger, subscription } from '@corates/db/schema';
import { and, desc, eq } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isAdminUser } from '@corates/workers/auth-admin';
import { LedgerStatus } from '@corates/db/stripe-event-ledger';
import type { Session } from '@/server/middleware/auth';

function assertAdmin(session: Session) {
  if (!isAdminUser(session.user as { role?: string | null })) {
    throw Response.json(
      createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'admin_required' }),
      { status: 403 },
    );
  }
}

export async function getAdminBillingLedger(
  session: Session,
  db: Database,
  params: { limit?: number; status?: string; type?: string },
) {
  assertAdmin(session);

  const limit = params.limit ?? 50;
  const status = params.status;
  const eventType = params.type;

  const conditions = [];
  if (status) conditions.push(eq(stripeEventLedger.status, status));
  if (eventType) conditions.push(eq(stripeEventLedger.type, eventType));

  const entries =
    conditions.length > 0 ?
      await db
        .select()
        .from(stripeEventLedger)
        .where(and(...conditions))
        .orderBy(desc(stripeEventLedger.receivedAt))
        .limit(limit)
        .all()
    : await db
        .select()
        .from(stripeEventLedger)
        .orderBy(desc(stripeEventLedger.receivedAt))
        .limit(limit)
        .all();

  const stats = {
    total: entries.length,
    byStatus: entries.reduce(
      (acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
    byType: entries
      .filter(e => e.type)
      .reduce(
        (acc, e) => {
          if (e.type) acc[e.type] = (acc[e.type] || 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
  };

  return {
    stats,
    entries: entries.map(e => ({
      id: e.id,
      stripeEventId: e.stripeEventId,
      type: e.type,
      status: e.status,
      httpStatus: e.httpStatus,
      error: e.error,
      orgId: e.orgId,
      stripeCustomerId: e.stripeCustomerId,
      stripeSubscriptionId: e.stripeSubscriptionId,
      stripeCheckoutSessionId: e.stripeCheckoutSessionId,
      payloadHash: e.payloadHash,
      signaturePresent: e.signaturePresent,
      livemode: e.livemode,
      receivedAt: e.receivedAt,
      processedAt: e.processedAt,
      requestId: e.requestId,
      route: e.route,
    })),
  };
}

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

export async function getAdminBillingStuckStates(
  session: Session,
  db: Database,
  params: { incompleteThreshold?: number; limit?: number },
) {
  assertAdmin(session);

  const incompleteThresholdMinutes = params.incompleteThreshold ?? 30;
  const limit = params.limit ?? 50;

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

  for (const [orgId, failedCount] of Object.entries(failureCounts)) {
    if (failedCount >= 3) {
      stuckOrgs.push({
        type: 'repeated_failures',
        orgId,
        failedCount,
      });
    }
  }

  return {
    checkedAt: now.toISOString(),
    thresholds: { incompleteMinutes: incompleteThresholdMinutes },
    totalStuckOrgs: stuckOrgs.length,
    stuckOrgs,
  };
}
