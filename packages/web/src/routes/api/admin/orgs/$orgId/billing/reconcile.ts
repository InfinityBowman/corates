/**
 * Admin billing reconcile
 *
 * GET /api/admin/orgs/:orgId/billing/reconcile — detect stuck subscription
 * states by comparing D1 (subscription rows), the Stripe event ledger, and
 * optionally the live Stripe API. Returns categorized stuck states with
 * severity, plus summary counts.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { organization, subscription } from '@corates/db/schema';
import { desc, eq } from 'drizzle-orm';
import {
  createDomainError,
  createValidationError,
  SYSTEM_ERRORS,
  VALIDATION_ERRORS,
} from '@corates/shared';
import { getLedgerEntriesByOrgId, LedgerStatus } from '@corates/db/stripe-event-ledger';
import { createStripeClient } from '@corates/workers/stripe';
import { requireAdmin } from '@/server/guards/requireAdmin';

interface StuckState {
  type: string;
  severity?: 'critical' | 'high' | 'medium' | 'low';
  subscriptionId?: string;
  stripeSubscriptionId?: string | null;
  status?: string;
  ageMinutes?: number;
  threshold?: number;
  description?: string;
  ledgerId?: string;
  stripeEventId?: string | null;
  stripeCheckoutSessionId?: string | null;
  stripeCustomerId?: string | null;
  failedCount?: number;
  recentFailures?: Record<string, unknown>[];
  lagMinutes?: number;
  payloadHash?: string;
  periodEnd?: number;
  localStatus?: string;
  stripeStatus?: string;
}

type HandlerArgs = { request: Request; params: { orgId: string } };

export const handleGet = async ({ request, params }: HandlerArgs) => {
  const guard = await requireAdmin(request, env);
  if (!guard.ok) return guard.response;

  const { orgId } = params;
  const url = new URL(request.url);
  const checkStripe = url.searchParams.get('checkStripe') === 'true';
  const incompleteThresholdMinutes = parseInt(
    url.searchParams.get('incompleteThreshold') || '30',
    10,
  );
  const checkoutNoSubThresholdMinutes = parseInt(
    url.searchParams.get('checkoutNoSubThreshold') || '15',
    10,
  );
  const processingLagThresholdMinutes = parseInt(
    url.searchParams.get('processingLagThreshold') || '5',
    10,
  );

  const db = createDb(env.DB);

  try {
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      return Response.json(
        createValidationError('orgId', VALIDATION_ERRORS.FIELD_INVALID_FORMAT.code, orgId),
        { status: 400 },
      );
    }

    const stuckStates: StuckState[] = [];
    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000);

    const allSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, orgId))
      .orderBy(desc(subscription.createdAt))
      .all();

    for (const sub of allSubscriptions) {
      if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
        if (!sub.createdAt) continue;
        const createdAtTimestamp =
          sub.createdAt instanceof Date ?
            Math.floor(sub.createdAt.getTime() / 1000)
          : sub.createdAt;
        const ageMinutes = (nowTimestamp - createdAtTimestamp) / 60;

        if (ageMinutes > incompleteThresholdMinutes) {
          stuckStates.push({
            type: 'incomplete_subscription',
            severity: 'high',
            subscriptionId: sub.id,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            status: sub.status,
            ageMinutes: Math.round(ageMinutes),
            threshold: incompleteThresholdMinutes,
            description: `Subscription has been in ${sub.status} status for ${Math.round(ageMinutes)} minutes (threshold: ${incompleteThresholdMinutes})`,
          });
        }
      }

      if (sub.status === 'past_due') {
        const periodEnd =
          sub.periodEnd instanceof Date ?
            Math.floor(sub.periodEnd.getTime() / 1000)
          : (sub.periodEnd as number | null);
        if (periodEnd && nowTimestamp > periodEnd) {
          stuckStates.push({
            type: 'past_due_expired',
            severity: 'high',
            subscriptionId: sub.id,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            status: sub.status,
            periodEnd,
            description: `Subscription is past_due and period has ended`,
          });
        }
      }
    }

    const ledgerEntries = await getLedgerEntriesByOrgId(db, orgId, { limit: 100 });

    const checkoutCompletedEvents = ledgerEntries.filter(
      entry =>
        entry.type === 'checkout.session.completed' && entry.status === LedgerStatus.PROCESSED,
    );

    for (const event of checkoutCompletedEvents) {
      const processedAtTimestamp =
        event.processedAt instanceof Date ?
          Math.floor(event.processedAt.getTime() / 1000)
        : (event.processedAt as number | null);
      if (!processedAtTimestamp) continue;
      const ageMinutes = (nowTimestamp - processedAtTimestamp) / 60;

      if (ageMinutes > checkoutNoSubThresholdMinutes) {
        const matchingSub = allSubscriptions.find(
          sub =>
            sub.stripeCustomerId === event.stripeCustomerId ||
            sub.stripeSubscriptionId === event.stripeSubscriptionId,
        );

        if (!matchingSub) {
          stuckStates.push({
            type: 'checkout_no_subscription',
            severity: 'critical',
            ledgerId: event.id,
            stripeEventId: event.stripeEventId,
            stripeCheckoutSessionId: event.stripeCheckoutSessionId,
            stripeCustomerId: event.stripeCustomerId,
            ageMinutes: Math.round(ageMinutes),
            threshold: checkoutNoSubThresholdMinutes,
            description: `checkout.session.completed event processed ${Math.round(ageMinutes)} minutes ago but no subscription row exists. Common causes: plugin misconfig, referenceId mismatch, authorization failure.`,
          });
        }
      }
    }

    const failedEvents = ledgerEntries.filter(entry => entry.status === LedgerStatus.FAILED);
    if (failedEvents.length >= 3) {
      stuckStates.push({
        type: 'repeated_webhook_failures',
        severity: 'medium',
        failedCount: failedEvents.length,
        recentFailures: failedEvents.slice(0, 5).map(e => ({
          ledgerId: e.id,
          stripeEventId: e.stripeEventId,
          type: e.type,
          error: e.error,
          receivedAt: e.receivedAt,
        })),
        description: `${failedEvents.length} webhook failures recorded for this org`,
      });
    }

    const receivedEvents = ledgerEntries.filter(
      entry => entry.status === LedgerStatus.RECEIVED && entry.processedAt === null,
    );

    for (const event of receivedEvents) {
      const receivedAtTimestamp =
        event.receivedAt instanceof Date ?
          Math.floor(event.receivedAt.getTime() / 1000)
        : (event.receivedAt as number);
      const lagMinutes = (nowTimestamp - receivedAtTimestamp) / 60;

      if (lagMinutes > processingLagThresholdMinutes) {
        stuckStates.push({
          type: 'processing_lag',
          severity: 'medium',
          ledgerId: event.id,
          payloadHash: event.payloadHash,
          lagMinutes: Math.round(lagMinutes),
          threshold: processingLagThresholdMinutes,
          description: `Webhook received ${Math.round(lagMinutes)} minutes ago but not yet processed`,
        });
      }
    }

    const ignoredEvents = ledgerEntries.filter(
      entry => entry.status === LedgerStatus.IGNORED_UNVERIFIED,
    );
    const ignoredCount = ignoredEvents.length;

    let stripeComparison: Record<string, unknown> | null = null;
    if (checkStripe && env.STRIPE_SECRET_KEY) {
      try {
        const stripe = createStripeClient(env);
        const activeSubscription = allSubscriptions.find(
          sub => sub.status === 'active' || sub.status === 'trialing',
        );

        if (activeSubscription?.stripeSubscriptionId) {
          const stripeSub = await stripe.subscriptions.retrieve(
            activeSubscription.stripeSubscriptionId,
          );
          const localStatus = activeSubscription.status;
          const stripeStatus = stripeSub.status;

          if (localStatus !== stripeStatus) {
            stuckStates.push({
              type: 'stripe_status_mismatch',
              severity: 'high',
              subscriptionId: activeSubscription.id,
              stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
              localStatus,
              stripeStatus,
              description: `Local subscription status (${localStatus}) does not match Stripe status (${stripeStatus})`,
            });
          }

          stripeComparison = {
            checked: true,
            stripeSubscriptionId: activeSubscription.stripeSubscriptionId,
            localStatus,
            stripeStatus,
            match: localStatus === stripeStatus,
          };
        } else {
          stripeComparison = { checked: true, noActiveSubscription: true };
        }
      } catch (stripeErr) {
        const stripeError = stripeErr as Error;
        stripeComparison = { checked: true, error: stripeError.message };
      }
    }

    return Response.json(
      {
        orgId,
        orgName: org.name,
        reconcileAt: now.toISOString(),
        thresholds: {
          incompleteMinutes: incompleteThresholdMinutes,
          checkoutNoSubMinutes: checkoutNoSubThresholdMinutes,
          processingLagMinutes: processingLagThresholdMinutes,
        },
        summary: {
          totalSubscriptions: allSubscriptions.length,
          totalLedgerEntries: ledgerEntries.length,
          failedWebhooks: failedEvents.length,
          ignoredWebhooks: ignoredCount,
          stuckStateCount: stuckStates.length,
          hasCriticalIssues: stuckStates.some(s => s.severity === 'critical'),
          hasHighIssues: stuckStates.some(s => s.severity === 'high'),
        },
        stuckStates,
        stripeComparison,
      },
      { status: 200 },
    );
  } catch (err) {
    const error = err as Error;
    console.error('Error in billing reconcile:', error);
    return Response.json(
      createDomainError(SYSTEM_ERRORS.DB_ERROR, {
        operation: 'billing_reconcile',
        originalError: error.message,
      }),
      { status: 500 },
    );
  }
};

export const Route = createFileRoute('/api/admin/orgs/$orgId/billing/reconcile')({
  server: { handlers: { GET: handleGet } },
});
