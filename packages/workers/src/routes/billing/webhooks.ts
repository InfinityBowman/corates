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
 *
 * NOTE: This file uses regular Hono instead of OpenAPIHono because webhook
 * endpoints receive raw payloads from Stripe that we verify via signature,
 * not through request body validation.
 */
import { Hono } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { createDb } from '@/db/client.js';
import { createDomainError, SYSTEM_ERRORS, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import type Stripe from 'stripe';
import { createStripeClient, isStripeConfigured } from '@/lib/stripe.js';
import { createLogger, sha256, truncateError } from '@/lib/observability/logger.js';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  updateLedgerStatus,
  getLedgerByPayloadHash,
  getLedgerByStripeEventId,
  LedgerStatus,
} from '@/db/stripeEventLedger.js';
import { routeStripeEvent, extractLedgerContext } from './webhookRouter.js';
import type { Env } from '../../types';

interface WebhookResponse {
  received: boolean;
  handled?: boolean;
  result?: string;
  skipped?: string;
  action?: string;
  grantId?: string;
}

const billingWebhookRoutes = new Hono<{ Bindings: Env }>();

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

  let rawBody: string | undefined;
  let ledgerId: string | undefined;
  let payloadHash: string | undefined;

  try {
    if (!isStripeConfigured(c.env) || !c.env.STRIPE_WEBHOOK_SECRET_PURCHASES) {
      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'stripe_not_configured',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    const stripe = createStripeClient(c.env);

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
        error: truncateError(bodyError as Error),
        httpStatus: 400,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'body_unreadable',
        error: bodyError as Error,
      });

      const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
        operation: 'body_unreadable',
      });
      return c.json(error, 400 as ContentfulStatusCode);
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
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Compute payload hash for dedupe
    payloadHash = await sha256(rawBody);

    // Check for duplicate by payload hash
    const existingEntry = await getLedgerByPayloadHash(db, payloadHash);
    if (existingEntry) {
      (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
        'webhook_dedupe',
        {
          outcome: 'skipped_duplicate',
          payloadHash,
          existingLedgerId: existingEntry.id,
          existingStatus: existingEntry.status,
        },
      );

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

    (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
      'webhook_received',
      {
        payloadHash,
        signaturePresent: true,
        ledgerId,
      },
    );

    // Phase 2: Verify signature and process
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature!,
        c.env.STRIPE_WEBHOOK_SECRET_PURCHASES,
      );
    } catch (err) {
      // Signature verification failed
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'invalid_signature',
        httpStatus: 403,
      });

      (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
        'webhook_rejected',
        {
          outcome: 'ignored_unverified',
          errorCode: 'invalid_signature',
          payloadHash,
          error: truncateError(err as Error),
        },
      );

      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'invalid_signature',
      });
      return c.json(error, error.statusCode as ContentfulStatusCode);
    }

    // Signature verified - now we can trust the parsed event
    const stripeEventId = event.id;
    const eventType = event.type;
    const livemode = event.livemode;
    const apiVersion = event.api_version;
    const created = event.created ? new Date(event.created * 1000) : null;

    // Dedupe by Stripe event ID (authoritative - same event can have different payload formatting)
    const existingByEventId = await getLedgerByStripeEventId(db, stripeEventId);
    if (existingByEventId) {
      // Update current ledger entry to mark as duplicate
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.SKIPPED_DUPLICATE,
        httpStatus: 200,
      });

      (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
        'webhook_dedupe_event_id',
        {
          outcome: 'skipped_duplicate',
          stripeEventId,
          stripeEventType: eventType,
          existingLedgerId: existingByEventId.id,
          existingStatus: existingByEventId.status,
          payloadHash,
        },
      );

      return c.json({ received: true, skipped: 'duplicate_event_id' }, 200);
    }

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

      (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
        'webhook_rejected',
        {
          outcome: 'ignored_test_mode',
          stripeEventId,
          stripeEventType: eventType,
          reason: 'test_event_in_production',
          payloadHash,
        },
      );

      return c.json({ received: true, skipped: 'test_event_in_production' }, 200);
    }

    // Route to appropriate handler
    const ctx = { db, logger, env: c.env };
    const handlerResult = await routeStripeEvent(event, ctx);
    const baseLedgerContext = extractLedgerContext(event);

    // Merge handler-specific context with base context
    const ledgerContext = {
      ...baseLedgerContext,
      ...((handlerResult.ledgerContext as Record<string, unknown>) || {}),
    };

    // Determine ledger status based on handler result
    let ledgerStatus: (typeof LedgerStatus)[keyof typeof LedgerStatus] = LedgerStatus.PROCESSED;
    let httpStatus = 200;

    const handlerResultWithError = handlerResult as {
      handled: boolean;
      result: string;
      error?: string;
      ledgerContext?: { grantId?: string };
    };

    if (!handlerResult.handled) {
      ledgerStatus = LedgerStatus.PROCESSED;
    } else if (handlerResultWithError.error) {
      ledgerStatus = LedgerStatus.FAILED;
      httpStatus = 400;
    } else if (handlerResult.result === 'already_processed') {
      ledgerStatus = LedgerStatus.SKIPPED_DUPLICATE;
    }

    // Update ledger with verified fields and result
    await updateLedgerWithVerifiedFields(db, ledgerId, {
      stripeEventId,
      type: eventType,
      livemode,
      apiVersion,
      created,
      status: ledgerStatus,
      httpStatus,
      error: handlerResultWithError.error || null,
      ...ledgerContext,
    });

    (logger.stripe as (_event: string, _data: Record<string, unknown>) => void)(
      'webhook_processed',
      {
        outcome: handlerResult.handled ? 'processed' : 'unhandled',
        stripeEventId,
        stripeEventType: eventType,
        result: handlerResult.result,
        payloadHash,
        ...((handlerResult.ledgerContext as Record<string, unknown>) || {}),
      },
    );

    // Return error response if handler indicated failure
    if (handlerResultWithError.error) {
      // Map handler errors to domain errors for consistent API responses
      const errorDetails = {
        field: handlerResult.result,
        value: handlerResultWithError.error,
      };
      const domainError = createDomainError(VALIDATION_ERRORS.INVALID_INPUT, errorDetails);
      return c.json(domainError, domainError.statusCode as ContentfulStatusCode);
    }

    // Build response with backwards-compatible fields for existing tests
    const response: WebhookResponse = {
      received: true,
      handled: handlerResult.handled,
      result: handlerResult.result,
    };

    // Map result strings to expected action/skipped fields for backwards compatibility
    if (handlerResult.result === 'grant_created') {
      response.action = 'created';
      response.grantId = handlerResultWithError.ledgerContext?.grantId;
    } else if (handlerResult.result === 'grant_extended') {
      response.action = 'extended';
      response.grantId = handlerResultWithError.ledgerContext?.grantId;
    } else if (handlerResult.result === 'already_processed') {
      response.skipped = 'already_processed';
    } else if (handlerResult.result === 'not_payment_mode') {
      response.skipped = 'not_payment_mode';
    } else if (!handlerResult.handled) {
      response.skipped = 'event_type_not_handled';
    }

    return c.json(response);
  } catch (err) {
    const error = err as Error;
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
    return c.json(systemError, systemError.statusCode as ContentfulStatusCode);
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
  return c.json(error, error.statusCode as ContentfulStatusCode);
});

export { billingWebhookRoutes };
