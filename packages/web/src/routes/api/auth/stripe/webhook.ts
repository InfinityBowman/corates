/**
 * POST /api/auth/stripe/webhook — Stripe webhook receiver with a two-phase
 * trust model.
 *
 * Phase 1 (pre-verify): record signature presence, payload hash, and dedupe
 * before forwarding. Reject early on missing signature / unreadable body /
 * test events in production.
 *
 * Phase 2 (post-verify): forward the raw body to better-auth's stripe handler
 * and update the ledger row with verified fields and the final outcome.
 */
import { createFileRoute } from '@tanstack/react-router';
import { env } from 'cloudflare:workers';
import { createAuth } from '@corates/workers/auth-config';
import { createDb } from '@corates/db/client';
import {
  insertLedgerEntry,
  updateLedgerWithVerifiedFields,
  updateLedgerStatus,
  getLedgerByPayloadHash,
  LedgerStatus,
} from '@corates/db/stripe-event-ledger';

interface StripeEvent {
  id?: string;
  type?: string;
  livemode?: boolean;
  api_version?: string;
  created?: number;
  data?: {
    object?: {
      metadata?: { referenceId?: string; orgId?: string };
      customer?: string;
      subscription?: string;
      id?: string;
      mode?: string;
    };
  };
}

type HandlerArgs = { request: Request; context?: { cloudflareCtx?: ExecutionContext } };

const ROUTE = '/api/auth/stripe/webhook';

async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function truncate(value: unknown, max = 500): string | null {
  if (value === null || value === undefined) return null;
  let s: string;
  if (value instanceof Error) s = value.message;
  else if (typeof value === 'string') s = value;
  else {
    try {
      s = JSON.stringify(value);
    } catch {
      s = String(value);
    }
  }
  return s.length > max ? s.slice(0, max) + '...[truncated]' : s;
}

export const handlePost = async ({ request, context }: HandlerArgs) => {
  const db = createDb(env.DB);
  const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID();

  let rawBody: string | undefined;
  let ledgerId: string | undefined;

  try {
    const signaturePresent = !!request.headers.get('stripe-signature');

    try {
      rawBody = await request.text();
    } catch (bodyError) {
      ledgerId = crypto.randomUUID();
      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash: 'unreadable_body',
        signaturePresent: false,
        route: ROUTE,
        requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: truncate(bodyError as Error),
        httpStatus: 400,
      });
      console.error('[stripe-webhook] body unreadable', {
        requestId,
        error: truncate(bodyError as Error),
      });
      return Response.json({ error: 'Body unreadable' }, { status: 400 });
    }

    if (!signaturePresent) {
      ledgerId = crypto.randomUUID();
      const payloadHash = await sha256(rawBody);
      await insertLedgerEntry(db, {
        id: ledgerId,
        payloadHash,
        signaturePresent: false,
        route: ROUTE,
        requestId,
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'missing_signature',
        httpStatus: 403,
      });
      console.error('[stripe-webhook] missing signature', { requestId, payloadHash });
      return Response.json({ error: 'Missing Stripe signature' }, { status: 403 });
    }

    const payloadHash = await sha256(rawBody);

    const existingEntry = await getLedgerByPayloadHash(db, payloadHash);
    if (existingEntry) {
      console.info('[stripe-webhook] duplicate payload', {
        requestId,
        payloadHash,
        ledgerId: existingEntry.id,
        status: existingEntry.status,
      });
      return Response.json({ received: true, skipped: 'duplicate_payload' }, { status: 200 });
    }

    ledgerId = crypto.randomUUID();
    await insertLedgerEntry(db, {
      id: ledgerId,
      payloadHash,
      signaturePresent: true,
      route: ROUTE,
      requestId,
      status: LedgerStatus.RECEIVED,
    });
    console.info('[stripe-webhook] received', { requestId, payloadHash });

    if (env.ENVIRONMENT === 'production') {
      try {
        const preCheckEvent = JSON.parse(rawBody) as StripeEvent;
        if (preCheckEvent.livemode === false) {
          await updateLedgerWithVerifiedFields(db, ledgerId, {
            stripeEventId: preCheckEvent.id ?? null,
            type: preCheckEvent.type ?? null,
            livemode: false,
            apiVersion: preCheckEvent.api_version ?? null,
            created: preCheckEvent.created ? new Date(preCheckEvent.created * 1000) : null,
            status: LedgerStatus.IGNORED_TEST_MODE,
            httpStatus: 200,
          });
          console.info('[stripe-webhook] ignored test mode in production', {
            requestId,
            stripeEventId: preCheckEvent.id,
            stripeEventType: preCheckEvent.type,
          });
          return Response.json(
            { received: true, skipped: 'test_event_in_production' },
            { status: 200 },
          );
        }
      } catch {
        // Parse failed - let better-auth surface the error
      }
    }

    const auth = createAuth(env, context?.cloudflareCtx);
    const url = new URL(request.url);
    const authUrl = new URL(ROUTE, url.origin);
    const authRequest = new Request(authUrl.toString(), {
      method: 'POST',
      headers: request.headers,
      body: rawBody,
    });

    const response = await auth.handler(authRequest);
    const httpStatus = response.status;

    if (httpStatus >= 200 && httpStatus < 300) {
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
        stripeEventId = event.id ?? null;
        eventType = event.type ?? null;
        livemode = event.livemode ?? null;
        apiVersion = event.api_version ?? null;
        created = event.created ? new Date(event.created * 1000) : null;

        const eventData = event.data?.object;
        if (eventData) {
          orgId = eventData.metadata?.referenceId ?? eventData.metadata?.orgId ?? null;
          stripeCustomerId = eventData.customer ?? null;
          stripeSubscriptionId = eventData.subscription ?? eventData.id ?? null;
          if (eventType === 'checkout.session.completed') {
            stripeCheckoutSessionId = eventData.id ?? null;
            if (eventData.mode === 'subscription') {
              stripeSubscriptionId = eventData.subscription ?? null;
            }
          }
        }
      } catch {
        console.warn('[stripe-webhook] failed to parse verified body', { requestId, ledgerId });
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
      console.info('[stripe-webhook] processed', {
        requestId,
        stripeEventId,
        stripeEventType: eventType,
        livemode,
        orgId,
        stripeCustomerId,
        stripeSubscriptionId,
        httpStatus,
      });
    } else if (httpStatus === 401 || httpStatus === 403) {
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.IGNORED_UNVERIFIED,
        error: 'invalid_signature',
        httpStatus,
      });
      console.error('[stripe-webhook] invalid signature', {
        requestId,
        payloadHash,
        httpStatus,
      });
    } else {
      let errorMessage = `HTTP ${httpStatus}`;
      try {
        const responseBody = await response.clone().text();
        errorMessage = truncate(responseBody) ?? errorMessage;
      } catch {
        // ignore clone/read errors
      }
      await updateLedgerStatus(db, ledgerId, {
        status: LedgerStatus.FAILED,
        error: errorMessage,
        httpStatus,
      });
      console.error('[stripe-webhook] failed', {
        requestId,
        payloadHash,
        httpStatus,
        error: errorMessage,
      });
    }

    return response;
  } catch (error) {
    const truncated = truncate(error as Error);
    console.error('[stripe-webhook] handler error', { requestId, ledgerId, error: truncated });

    if (ledgerId) {
      try {
        await updateLedgerStatus(db, ledgerId, {
          status: LedgerStatus.FAILED,
          error: truncated,
          httpStatus: 500,
        });
      } catch {
        // ignore ledger update errors in error handler
      }
    }

    return Response.json({ error: 'Webhook processing error' }, { status: 500 });
  }
};

export const Route = createFileRoute('/api/auth/stripe/webhook')({
  server: { handlers: { POST: handlePost } },
});
