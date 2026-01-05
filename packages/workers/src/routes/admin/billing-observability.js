/**
 * Admin billing observability routes
 * Handles Stripe event ledger viewing, stuck-state detection, and reconciliation
 */

import { Hono } from 'hono';
import { createDb } from '../../db/client.js';
import { subscription, organization, stripeEventLedger } from '../../db/schema.js';
import { eq, and, desc } from 'drizzle-orm';
import { createDomainError, VALIDATION_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { getLedgerEntriesByOrgId, LedgerStatus } from '../../db/stripeEventLedger.js';
import Stripe from 'stripe';

const billingObservabilityRoutes = new Hono();

/**
 * GET /api/admin/orgs/:orgId/billing/reconcile
 * Reconciliation endpoint to detect stuck subscription states
 * Compares D1 subscription rows, ledger, and optionally Stripe
 */
billingObservabilityRoutes.get('/orgs/:orgId/billing/reconcile', async c => {
  const orgId = c.req.param('orgId');
  const db = createDb(c.env.DB);
  const checkStripe = c.req.query('checkStripe') === 'true';

  // Configurable thresholds (in minutes)
  const incompleteThresholdMinutes = parseInt(c.req.query('incompleteThreshold') || '30', 10);
  const checkoutNoSubThresholdMinutes = parseInt(c.req.query('checkoutNoSubThreshold') || '15', 10);
  const processingLagThresholdMinutes = parseInt(c.req.query('processingLagThreshold') || '5', 10);

  try {
    // Verify org exists
    const org = await db.select().from(organization).where(eq(organization.id, orgId)).get();
    if (!org) {
      const error = createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
        field: 'orgId',
        value: orgId,
      });
      return c.json(error, error.statusCode);
    }

    const stuckStates = [];
    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000);

    // 1. Check for incomplete subscription status older than threshold
    const allSubscriptions = await db
      .select()
      .from(subscription)
      .where(eq(subscription.referenceId, orgId))
      .orderBy(desc(subscription.createdAt))
      .all();

    for (const sub of allSubscriptions) {
      if (sub.status === 'incomplete' || sub.status === 'incomplete_expired') {
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
          : sub.periodEnd;
        if (periodEnd && nowTimestamp > periodEnd) {
          stuckStates.push({
            type: 'past_due_expired',
            severity: 'high',
            subscriptionId: sub.id,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            status: sub.status,
            periodEnd: periodEnd,
            description: `Subscription is past_due and period has ended`,
          });
        }
      }
    }

    // 2. Check for checkout completed but no subscription created
    const ledgerEntries = await getLedgerEntriesByOrgId(db, orgId, { limit: 100 });

    const checkoutCompletedEvents = ledgerEntries.filter(
      entry =>
        entry.type === 'checkout.session.completed' && entry.status === LedgerStatus.PROCESSED,
    );

    for (const event of checkoutCompletedEvents) {
      const processedAtTimestamp =
        event.processedAt instanceof Date ?
          Math.floor(event.processedAt.getTime() / 1000)
        : event.processedAt;
      const ageMinutes = (nowTimestamp - processedAtTimestamp) / 60;

      if (ageMinutes > checkoutNoSubThresholdMinutes) {
        // Check if there's a corresponding subscription
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

    // 3. Check for repeated webhook failures
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

    // 4. Check for webhook processing lag
    const receivedEvents = ledgerEntries.filter(
      entry => entry.status === LedgerStatus.RECEIVED && entry.processedAt === null,
    );

    for (const event of receivedEvents) {
      const receivedAtTimestamp =
        event.receivedAt instanceof Date ?
          Math.floor(event.receivedAt.getTime() / 1000)
        : event.receivedAt;
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

    // 5. Check for ignored/unverified traffic (informational)
    const ignoredEvents = ledgerEntries.filter(
      entry => entry.status === LedgerStatus.IGNORED_UNVERIFIED,
    );
    const ignoredCount = ignoredEvents.length;

    // 6. Optional: Compare with Stripe API
    let stripeComparison = null;
    if (checkStripe && c.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
          apiVersion: '2025-11-17.clover',
        });

        // Get all active subscriptions for this org's customers
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
          stripeComparison = {
            checked: true,
            noActiveSubscription: true,
          };
        }
      } catch (stripeError) {
        stripeComparison = {
          checked: true,
          error: stripeError.message,
        };
      }
    }

    // Build response
    const response = {
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
    };

    return c.json(response);
  } catch (error) {
    console.error('Error in billing reconcile:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'billing_reconcile',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/billing/stuck-states
 * Global endpoint to find all orgs with stuck billing states
 * Useful for monitoring/alerting
 */
billingObservabilityRoutes.get('/billing/stuck-states', async c => {
  const db = createDb(c.env.DB);
  const incompleteThresholdMinutes = parseInt(c.req.query('incompleteThreshold') || '30', 10);
  const limit = parseInt(c.req.query('limit') || '50', 10);

  try {
    const now = new Date();
    const nowTimestamp = Math.floor(now.getTime() / 1000);
    const thresholdTimestamp = nowTimestamp - incompleteThresholdMinutes * 60;

    const stuckOrgs = [];

    // Find incomplete subscriptions older than threshold
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

    // Find checkout.session.completed events without subscriptions
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
        : event.processedAt;

      if (!processedAtTimestamp || nowTimestamp - processedAtTimestamp < 15 * 60) continue;

      // Check if subscription exists for this org
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

    // Find orgs with multiple failed webhooks
    const failedWebhooks = await db
      .select({
        orgId: stripeEventLedger.orgId,
      })
      .from(stripeEventLedger)
      .where(eq(stripeEventLedger.status, LedgerStatus.FAILED))
      .all();

    const failureCounts = failedWebhooks.reduce((acc, w) => {
      if (w.orgId) {
        acc[w.orgId] = (acc[w.orgId] || 0) + 1;
      }
      return acc;
    }, /** @type {Record<string, number>} */ ({}));

    for (const [orgId, count] of Object.entries(failureCounts)) {
      if (count >= 3) {
        stuckOrgs.push({
          type: 'repeated_failures',
          orgId,
          failedCount: count,
        });
      }
    }

    return c.json({
      checkedAt: now.toISOString(),
      thresholds: {
        incompleteMinutes: incompleteThresholdMinutes,
      },
      totalStuckOrgs: stuckOrgs.length,
      stuckOrgs,
    });
  } catch (error) {
    console.error('Error finding stuck states:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'find_stuck_states',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

/**
 * GET /api/admin/billing/ledger
 * View recent Stripe event ledger entries (global)
 */
billingObservabilityRoutes.get('/billing/ledger', async c => {
  const db = createDb(c.env.DB);
  const limit = parseInt(c.req.query('limit') || '50', 10);
  const status = c.req.query('status');
  const eventType = c.req.query('type');

  try {
    let query = db.select().from(stripeEventLedger).orderBy(desc(stripeEventLedger.receivedAt));

    // Apply filters if provided
    const conditions = [];
    if (status) {
      conditions.push(eq(stripeEventLedger.status, status));
    }
    if (eventType) {
      conditions.push(eq(stripeEventLedger.type, eventType));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const entries = await query.limit(limit).all();

    // Calculate summary stats
    const stats = {
      total: entries.length,
      byStatus: entries.reduce((acc, e) => {
        acc[e.status] = (acc[e.status] || 0) + 1;
        return acc;
      }, /** @type {Record<string, number>} */ ({})),
      byType: entries
        .filter(e => e.type)
        .reduce((acc, e) => {
          if (e.type) {
            acc[e.type] = (acc[e.type] || 0) + 1;
          }
          return acc;
        }, /** @type {Record<string, number>} */ ({})),
    };

    return c.json({
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
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_ledger',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { billingObservabilityRoutes };
