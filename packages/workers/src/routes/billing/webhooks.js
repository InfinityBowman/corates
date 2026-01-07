/**
 * Billing webhook routes
 * Handles Stripe webhook events for one-time purchases
 *
 * WARNING: CRITICAL PAYMENT PROCESSING CODE
 *
 * This file handles webhook events from Stripe for one-time purchases.
 * Uses two-phase trust model for ledger: trust-minimal on receipt, verified after signature check
 *
 * BEFORE MODIFYING:
 * 1. Understand the two-phase webhook verification pattern
 * 2. Run billing tests: cd packages/workers && pnpm test billing
 * 3. Test with Stripe CLI: stripe listen --forward-to localhost:8787/api/billing/webhook/purchases
 * 4. Verify idempotency (webhooks can be delivered multiple times)
 * 5. NEVER skip signature verification
 * 6. Test both test mode and live mode scenarios
 *
 * CRITICAL PATTERNS:
 * - Webhook ledger prevents duplicate processing (payloadHash + stripeEventId)
 * - orgAccessGrants has unique constraint on checkoutSessionId
 * - Grant extension rule: expiresAt = max(now, currentExpiresAt) + 6 months
 */
import { Hono } from 'hono';
import { createDb } from '@/db/client.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import Stripe from 'stripe';
import { createLogger, sha256, truncateError } from '@/lib/observability/logger.js';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  updateLedgerStatus,
  getLedgerByPayloadHash,
  LedgerStatus,
} from '@/db/stripeEventLedger.js';

const billingWebhookRoutes = new Hono();

/**
 * POST /purchases/webhook
 * Handle Stripe webhook events for one-time purchases (checkout.session.completed)
 * Separate from Better Auth Stripe plugin webhook which handles subscriptions
 * Uses two-phase trust model for ledger: trust-minimal on receipt, verified after signature check
 */
billingWebhookRoutes.post('/purchases/webhook', async c => {
  const logger = createLogger({ c, service: 'billing-purchases-webhook', env: c.env });
  const db = createDb(c.env.DB);
  const route = '/api/billing/purchases/webhook';

  let rawBody;
  let ledgerId;
  let payloadHash;

  try {
    if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET_PURCHASES) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode);
    }

    const stripe = new Stripe(c.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-11-17.clover',
    });

    // Phase 1: Read request and store trust-minimal fields
    const signature = c.req.header('stripe-signature');
    const signaturePresent = !!signature;

    // Read raw body
    try {
      rawBody = await c.req.text();
    } catch (bodyError) {
      // Body unreadable - insert ledger entry and return 400
      ledgerId = crypto.randomUUID();
      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash: 'unreadable_body',
        signaturePresent: false,
        route,
        requestId: logger.requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: truncateError(bodyError),
        httpStatus: 400,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'body_unreadable',
        error: bodyError,
      });

      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'body_unreadable',
      });
      return c.json(error, 400);
    }

    // If signature header is missing, insert ledger and return 403
    if (!signaturePresent) {
      ledgerId = crypto.randomUUID();
      payloadHash = await sha256(rawBody);

      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash,
        signaturePresent: false,
        route,
        requestId: logger.requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'missing_signature',
        httpStatus: 403,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'missing_signature',
        payloadHash,
        signaturePresent: false,
      });

      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'missing_signature',
      });
      return c.json(error, error.statusCode);
    }

    // Compute payload hash for dedupe
    payloadHash = await sha256(rawBody);

    // Check for duplicate by payload hash
    const existingEntry = await getLedgerByPayloadHash(db, payloadHash);
    if (existingEntry) {
      logger.stripe('webhook_dedupe', {
        outcome: 'skipped_duplicate',
        payloadHash,
        existingLedgerId: existingEntry.id,
        existingStatus: existingEntry.status,
      });

      return c.json({ received: true, skipped: 'duplicate_payload' }, 200);
    }

    // Insert ledger entry with trust-minimal fields
    ledgerId = crypto.randomUUID();
    await insertLedgerEntry(db, {
      id: ledgerId,
      payloadHash,
      signaturePresent: true,
      route,
      requestId: logger.requestId,
      status: LedgerStatus.RECEIVED,
    });

    logger.stripe('webhook_received', {
      payloadHash,
      signaturePresent: true,
      ledgerId,
    });

    // Phase 2: Verify signature and process
    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        c.env.STRIPE_WEBHOOK_SECRET_PURCHASES,
      );
    } catch (err) {
      // Signature verification failed
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'invalid_signature',
        httpStatus: 403,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'invalid_signature',
        payloadHash,
        error: truncateError(err),
      });

      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'invalid_signature',
      });
      return c.json(error, error.statusCode);
    }

    // Signature verified - now we can trust the parsed event
    const stripeEventId = event.id;
    const eventType = event.type;
    const livemode = event.livemode;
    const apiVersion = event.api_version;
    const created = event.created ? new Date(event.created * 1000) : null;

    // M5: Reject test events in production environment
    if (c.env.ENVIRONMENT === 'production' && !livemode) {
      await updateLedgerWithVerifiedFields(db, ledgerId, {
        stripeEventId,
        type: eventType,
        livemode,
        apiVersion,
        created,
        status: LedgerStatus.IGNORED_TEST_MODE,
        httpStatus: 200,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_test_mode',
        stripeEventId,
        stripeEventType: eventType,
        reason: 'test_event_in_production',
        payloadHash,
      });

      return c.json({ received: true, skipped: 'test_event_in_production' }, 200);
    }

    // Handle checkout.session.completed for one-time purchases
    if (eventType === 'checkout.session.completed') {
      const session = event.data?.object;

      // Only process payment mode (one-time purchases), not subscription mode
      if (!session || session.mode !== 'payment') {
        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.PROCESSED,
          httpStatus: 200,
          stripeCheckoutSessionId: session?.id,
        });

        logger.stripe('webhook_skipped', {
          outcome: 'skipped',
          stripeEventId,
          stripeEventType: eventType,
          reason: 'not_payment_mode',
          payloadHash,
        });

        return c.json({ received: true, skipped: 'not_payment_mode' });
      }

      // Verify metadata contains required fields
      const orgId = session.metadata?.orgId;
      const grantType = session.metadata?.grantType;
      if (!orgId || grantType !== 'single_project') {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: 'invalid_metadata',
          httpStatus: 400,
        });

        logger.stripe('webhook_failed', {
          outcome: 'failed',
          stripeEventId,
          stripeEventType: eventType,
          errorCode: 'invalid_metadata',
          payloadHash,
        });

        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'metadata',
          value: session.metadata,
        });
        return c.json(error, error.statusCode);
      }

      const purchaserUserId = session.metadata?.purchaserUserId;

      // Verify payment was successful
      if (session.payment_status !== 'paid') {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: `payment_not_paid:${session.payment_status}`,
          httpStatus: 400,
        });

        logger.stripe('webhook_failed', {
          outcome: 'failed',
          stripeEventId,
          stripeEventType: eventType,
          errorCode: 'payment_not_paid',
          payloadHash,
        });

        const error = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
          field: 'payment_status',
          value: session.payment_status,
        });
        return c.json(error, error.statusCode);
      }

      const {
        getGrantByStripeCheckoutSessionId,
        getGrantByOrgIdAndType,
        createGrant,
        updateGrantExpiresAt,
      } = await import('@/db/orgAccessGrants.js');

      // Check for idempotency - if grant already exists for this checkout session, skip
      const existingGrantBySession = await getGrantByStripeCheckoutSessionId(db, session.id);
      if (existingGrantBySession) {
        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.SKIPPED_DUPLICATE,
          httpStatus: 200,
          orgId,
          stripeCustomerId: session.customer,
          stripeCheckoutSessionId: session.id,
        });

        logger.stripe('webhook_skipped', {
          outcome: 'skipped_duplicate',
          stripeEventId,
          stripeEventType: eventType,
          reason: 'already_processed',
          orgId,
          stripeCheckoutSessionId: session.id,
          payloadHash,
        });

        return c.json({ received: true, skipped: 'already_processed' });
      }

      const now = new Date();
      const nowTimestamp = Math.floor(now.getTime() / 1000);

      // Check if org already has a single_project grant (active or expired, but not revoked)
      const existingGrant = await getGrantByOrgIdAndType(db, orgId, 'single_project');

      if (existingGrant && !existingGrant.revokedAt) {
        // Extension rule: expiresAt = max(now, currentExpiresAt) + 6 months
        const existingExpiresAtTimestamp =
          existingGrant.expiresAt instanceof Date ?
            Math.floor(existingGrant.expiresAt.getTime() / 1000)
          : existingGrant.expiresAt;

        const baseExpiresAt = Math.max(nowTimestamp, existingExpiresAtTimestamp);
        const newExpiresAt = new Date(baseExpiresAt * 1000);
        newExpiresAt.setMonth(newExpiresAt.getMonth() + 6);

        await updateGrantExpiresAt(db, existingGrant.id, newExpiresAt);

        await updateLedgerWithVerifiedFields(db, ledgerId, {
          stripeEventId,
          type: eventType,
          livemode,
          apiVersion,
          created,
          status: LedgerStatus.PROCESSED,
          httpStatus: 200,
          orgId,
          stripeCustomerId: session.customer,
          stripeCheckoutSessionId: session.id,
        });

        logger.stripe('webhook_processed', {
          outcome: 'processed',
          action: 'extended',
          stripeEventId,
          stripeEventType: eventType,
          orgId,
          userId: purchaserUserId,
          stripeCheckoutSessionId: session.id,
          grantId: existingGrant.id,
          payloadHash,
        });

        return c.json({ received: true, action: 'extended', grantId: existingGrant.id });
      }

      // Create new grant (6 months from now)
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 6);

      const grantId = crypto.randomUUID();
      await createGrant(db, {
        id: grantId,
        orgId,
        type: grantType,
        startsAt: now,
        expiresAt,
        stripeCheckoutSessionId: session.id,
        metadata: {
          purchaserUserId,
          stripeCheckoutSessionId: session.id,
          stripePaymentIntentId: session.payment_intent,
        },
      });

      await updateLedgerWithVerifiedFields(db, ledgerId, {
        stripeEventId,
        type: eventType,
        livemode,
        apiVersion,
        created,
        status: LedgerStatus.PROCESSED,
        httpStatus: 200,
        orgId,
        stripeCustomerId: session.customer,
        stripeCheckoutSessionId: session.id,
      });

      logger.stripe('webhook_processed', {
        outcome: 'processed',
        action: 'created',
        stripeEventId,
        stripeEventType: eventType,
        orgId,
        userId: purchaserUserId,
        stripeCheckoutSessionId: session.id,
        grantId,
        payloadHash,
      });

      return c.json({ received: true, action: 'created', grantId });
    }

    // Other event types - record but don't process
    await updateLedgerWithVerifiedFields(db, ledgerId, {
      stripeEventId,
      type: eventType,
      livemode,
      apiVersion,
      created,
      status: LedgerStatus.PROCESSED,
      httpStatus: 200,
    });

    logger.stripe('webhook_skipped', {
      outcome: 'skipped',
      stripeEventId,
      stripeEventType: eventType,
      reason: 'event_type_not_handled',
      payloadHash,
    });

    return c.json({ received: true, skipped: 'event_type_not_handled' });
  } catch (error) {
    logger.error('Purchase webhook handler error', {
      error: truncateError(error),
      ledgerId,
      payloadHash,
    });

    // Update ledger if we have an entry
    if (ledgerId) {
      try {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: truncateError(error),
          httpStatus: 500,
        });
      } catch {
        // Ignore ledger update errors in error handler
      }
    }

    const systemError = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
      operation: 'process_purchase_webhook',
      originalError: error.message,
    });
    return c.json(systemError, systemError.statusCode);
  }
});

/**
 * POST /webhook
 * Handle Stripe webhook events
 * NOTE: Better Auth Stripe plugin handles webhooks at /api/auth/stripe/webhook
 * This endpoint is kept for backwards compatibility but should not be used
 */
billingWebhookRoutes.post('/webhook', async c => {
  // Redirect to Better Auth webhook endpoint
  const error = createDomainError(
    SYSTEM_ERRORS.INTERNAL_ERROR,
    {
      operation: 'webhook_deprecated',
    },
    'Webhooks are handled by Better Auth at /api/auth/stripe/webhook',
  );
  return c.json(error, error.statusCode);
});

export { billingWebhookRoutes };
