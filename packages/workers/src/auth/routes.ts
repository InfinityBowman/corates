/**
 * Auth routes for Hono
 * Handles better-auth integration and custom auth endpoints
 */

import { Hono } from 'hono';
import { createAuth } from './config';
import {
  getEmailVerificationSuccessPage,
  getEmailVerificationFailurePage,
  getEmailVerificationErrorPage,
} from './templates';
import { authRateLimit, sessionRateLimit } from '@/middleware/rateLimit';
import { createLogger, sha256, truncateError } from '@/lib/observability/logger';
import { createDb } from '@/db/client';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  updateLedgerStatus,
  getLedgerByPayloadHash,
  LedgerStatus,
} from '@/db/stripeEventLedger';
import type { Env } from '../types';

interface StripeEvent {
  id?: string;
  type?: string;
  livemode?: boolean;
  api_version?: string;
  created?: number;
  data?: {
    object?: {
      metadata?: {
        referenceId?: string;
        orgId?: string;
      };
      customer?: string;
      subscription?: string;
      id?: string;
      mode?: string;
    };
  };
}

const auth = new Hono<{ Bindings: Env }>();

// Apply lenient rate limiting to session endpoints (called frequently)
auth.use('/get-session', sessionRateLimit);
auth.use('/session', sessionRateLimit);

// Apply strict rate limiting to sensitive auth endpoints (login, register, etc.)
// These are matched after the session routes above
auth.use('/sign-in/*', authRateLimit);
auth.use('/sign-up/*', authRateLimit);
auth.use('/forget-password/*', authRateLimit);
auth.use('/reset-password/*', authRateLimit);

/**
 * GET /api/auth/session
 * Custom session endpoint for WebSocket authentication
 */
auth.get('/session', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const session = await betterAuth.api.getSession({
      headers: c.req.raw.headers,
    });

    return c.json({
      user: session?.user || null,
      session: session?.session || null,
      sessionToken: session?.session?.id || null,
    });
  } catch (error) {
    console.error('Session fetch error:', error);
    return c.json({ user: null, session: null });
  }
});

/**
 * Email verification handler
 * Provides custom HTML responses for email verification
 */
auth.get('/verify-email', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Create request for better-auth
    const authUrl = new URL('/api/auth/verify-email', url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: 'GET',
      headers: c.req.raw.headers,
    });

    // Let Better Auth handle the verification
    const response = await betterAuth.handler(authRequest);

    console.log('Email verification response status:', response.status);

    // Check if verification was successful
    if (response.status >= 200 && response.status < 400) {
      // Collect all Set-Cookie headers from the response
      const setCookieHeaders = response.headers.getSetCookie?.() || [];
      console.log('Set-Cookie headers from verification:', setCookieHeaders);

      // Build response with cookies preserved
      const headers = new Headers();
      headers.set('Content-Type', 'text/html; charset=utf-8');

      // Append all Set-Cookie headers
      setCookieHeaders.forEach(cookie => {
        headers.append('Set-Cookie', cookie);
      });

      return new Response(getEmailVerificationSuccessPage(), {
        status: 200,
        headers,
      });
    } else {
      return new Response(getEmailVerificationFailurePage(), {
        status: response.status,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }
  } catch (error) {
    console.error('Email verification error:', error);
    return new Response(getEmailVerificationErrorPage(), {
      status: 500,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
});

/**
 * Stripe webhook wrapper - records webhook receipt/outcome in ledger
 * Uses two-phase trust model:
 * - Phase 1: Store trust-minimal fields on receipt (before verification)
 * - Phase 2: Populate verified fields only after Better Auth verification succeeds
 */
auth.post('/stripe/webhook', async c => {
  const logger = createLogger({ c, service: 'stripe-webhook', env: c.env });
  const db = createDb(c.env.DB);
  const route = '/api/auth/stripe/webhook';

  let rawBody: string | undefined;
  let ledgerId: string | undefined;

  try {
    // Phase 1: Read request and store trust-minimal fields

    // Check signature header presence (do not verify here)
    const signatureHeader = c.req.header('stripe-signature');
    const signaturePresent = !!signatureHeader;

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
        signaturePresent: false,
      });

      return c.json({ error: 'Body unreadable' }, 400);
    }

    // If signature header is missing, insert ledger and return 403
    if (!signaturePresent) {
      ledgerId = crypto.randomUUID();
      const payloadHash = await sha256(rawBody);

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

      return c.json({ error: 'Missing Stripe signature' }, 403);
    }

    // Compute payload hash for dedupe
    const payloadHash = await sha256(rawBody);

    // Check for duplicate by payload hash
    const existingEntry = await getLedgerByPayloadHash(db, payloadHash);
    if (existingEntry) {
      logger.stripe('webhook_dedupe', {
        outcome: 'skipped_duplicate',
        payloadHash,
        stripeEventId: existingEntry.id,
        status: existingEntry.status,
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
    });

    // M5: Reject test events in production environment (pre-verification check)
    // Parse body minimally to check livemode before forwarding to Better Auth
    if (c.env.ENVIRONMENT === 'production') {
      try {
        const preCheckEvent = JSON.parse(rawBody) as StripeEvent;
        if (preCheckEvent.livemode === false) {
          await updateLedgerWithVerifiedFields(db, ledgerId, {
            stripeEventId: preCheckEvent.id || null,
            type: preCheckEvent.type || null,
            livemode: false,
            apiVersion: preCheckEvent.api_version || null,
            created: preCheckEvent.created ? new Date(preCheckEvent.created * 1000) : null,
            status: LedgerStatus.IGNORED_TEST_MODE,
            httpStatus: 200,
          });

          logger.stripe('webhook_rejected', {
            outcome: 'ignored_test_mode',
            stripeEventId: preCheckEvent.id,
            stripeEventType: preCheckEvent.type,
          });

          return c.json({ received: true, skipped: 'test_event_in_production' }, 200);
        }
      } catch {
        // Parse failed - let Better Auth handle the error
      }
    }

    // Phase 2: Forward to Better Auth and update ledger based on response

    const betterAuth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);

    // Reconstruct request with same headers and raw body
    const authUrl = new URL('/api/auth/stripe/webhook', url.origin);
    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers: c.req.raw.headers,
      body: rawBody,
    });

    // Forward to Better Auth handler
    const response = await betterAuth.handler(authRequest);
    const httpStatus = response.status;

    // Handle response based on status
    if (httpStatus >= 200 && httpStatus < 300) {
      // Signature verified and processed - parse verified fields from raw body
      let stripeEventId: string | null = null;
      let eventType: string | null = null;
      let livemode: boolean | null = null;
      let apiVersion: string | null = null;
      let created: Date | null = null;
      let orgId: string | null = null;
      let stripeCustomerId: string | null = null;
      let stripeSubscriptionId: string | null = null;
      let stripeCheckoutSessionId: string | null = null;

      try {
        const event = JSON.parse(rawBody) as StripeEvent;
        stripeEventId = event.id || null;
        eventType = event.type || null;
        livemode = event.livemode ?? null;
        apiVersion = event.api_version || null;
        created = event.created ? new Date(event.created * 1000) : null;

        // Extract linking fields from event data if available
        const eventData = event.data?.object;
        if (eventData) {
          // Try to extract orgId from metadata (referenceId)
          orgId = eventData.metadata?.referenceId || eventData.metadata?.orgId || null;
          stripeCustomerId = eventData.customer || null;
          stripeSubscriptionId = eventData.subscription || eventData.id || null;
          if (eventType === 'checkout.session.completed') {
            stripeCheckoutSessionId = eventData.id || null;
            // For subscriptions, the subscription ID is in the subscription field
            if (eventData.mode === 'subscription') {
              stripeSubscriptionId = eventData.subscription || null;
            }
          }
        }
      } catch {
        // Parse failed after verification - unusual but log it
        logger.warn('Failed to parse verified webhook body', { ledgerId });
      }

      await updateLedgerWithVerifiedFields(db, ledgerId, {
        stripeEventId,
        type: eventType,
        livemode,
        apiVersion,
        created,
        status: LedgerStatus.PROCESSED,
        httpStatus,
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        stripeCheckoutSessionId,
      });

      logger.stripe('webhook_processed', {
        outcome: 'processed',
        stripeEventId: stripeEventId ?? undefined,
        stripeEventType: eventType ?? undefined,
        stripeMode: livemode ? 'live' : 'test',
        orgId: orgId ?? undefined,
        stripeCustomerId: stripeCustomerId ?? undefined,
        stripeSubscriptionId: stripeSubscriptionId ?? undefined,
        status: String(httpStatus),
      });
    } else if (httpStatus === 401 || httpStatus === 403) {
      // Signature verification failed
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'invalid_signature',
        httpStatus,
      });

      logger.stripe('webhook_rejected', {
        outcome: 'ignored_unverified',
        errorCode: 'invalid_signature',
        payloadHash,
        status: String(httpStatus),
      });
    } else {
      // Other error (4xx/5xx) - processing failed after verification
      let errorMessage = `HTTP ${httpStatus}`;
      try {
        const responseBody = await response.clone().text();
        errorMessage = truncateError(responseBody) || errorMessage;
      } catch {
        // Ignore response read errors
      }

      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.FAILED,
        error: errorMessage,
        httpStatus,
      });

      logger.stripe('webhook_failed', {
        outcome: 'failed',
        error: errorMessage,
        payloadHash,
        status: String(httpStatus),
      });
    }

    return response;
  } catch (error) {
    // Unexpected error
    logger.error('Stripe webhook handler error', {
      error: truncateError(error as Error),
      ledgerId,
    });

    // Update ledger if we have an entry
    if (ledgerId) {
      try {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: truncateError(error as Error),
          httpStatus: 500,
        });
      } catch {
        // Ignore ledger update errors in error handler
      }
    }

    return c.json({ error: 'Webhook processing error' }, 500);
  }
});

/**
 * Catch-all handler for all other auth routes
 * Forwards to better-auth handler
 */
auth.all('/*', async c => {
  try {
    const betterAuth = createAuth(c.env, c.executionCtx);
    const url = new URL(c.req.url);
    const path = url.pathname;

    // Create a new request with the auth path, preserving query parameters
    const authUrl = new URL(path, url.origin);
    authUrl.search = url.search;
    const authRequest = new Request(authUrl.toString(), {
      method: c.req.method,
      headers: c.req.raw.headers,
      body: c.req.raw.body,
    });

    // Let Better Auth handle the request
    const response = await betterAuth.handler(authRequest);

    // Return the response (CORS is handled by global middleware)
    return response;
  } catch (error) {
    const err = error as Error;
    console.error('Auth route error:', error);
    return c.json({ error: 'Authentication error', details: err.message }, 500);
  }
});

export { auth };
