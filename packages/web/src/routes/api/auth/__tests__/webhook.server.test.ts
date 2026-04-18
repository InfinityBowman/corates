import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { createDb } from '@corates/db/client';
import { stripeEventLedger } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { handlePost } from '../stripe/webhook';

const { mockAuthHandler } = vi.hoisted(() => ({
  mockAuthHandler: vi.fn(async () => new Response(JSON.stringify({ received: true }), { status: 200 })),
}));

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({ handler: mockAuthHandler }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mockAuthHandler.mockImplementation(
    async () => new Response(JSON.stringify({ received: true }), { status: 200 }),
  );
});

function webhookReq(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/auth/stripe/webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

async function readLedger() {
  const db = createDb(env.DB);
  return db.select().from(stripeEventLedger).all();
}

describe('Stripe webhook - phase 1 rejections', () => {
  it('returns 403 and writes ignored_unverified row when stripe-signature header is missing', async () => {
    const res = await handlePost({ request: webhookReq('{"id":"evt_1"}') });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Missing Stripe signature');

    const rows = await readLedger();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('ignored_unverified');
    expect(rows[0].signaturePresent).toBe(false);
    expect(rows[0].error).toBe('missing_signature');
    expect(rows[0].httpStatus).toBe(403);
    expect(mockAuthHandler).not.toHaveBeenCalled();
  });

  it('skips duplicate payloads (same hash) without calling better-auth', async () => {
    const body = JSON.stringify({ id: 'evt_dup', type: 'checkout.session.completed' });
    const headers = { 'stripe-signature': 'sig=1' };

    const first = await handlePost({ request: webhookReq(body, headers) });
    expect(first.status).toBe(200);

    const second = await handlePost({ request: webhookReq(body, headers) });
    expect(second.status).toBe(200);
    const json = (await second.json()) as { skipped?: string };
    expect(json.skipped).toBe('duplicate_payload');

    expect(mockAuthHandler).toHaveBeenCalledTimes(1);
  });

  it('rejects test events in production and writes ignored_test_mode row', async () => {
    const originalEnv = env.ENVIRONMENT;
    (env as { ENVIRONMENT: string }).ENVIRONMENT = 'production';

    try {
      const body = JSON.stringify({
        id: 'evt_test',
        type: 'customer.subscription.created',
        livemode: false,
        api_version: '2024-09-30',
        created: 1700000000,
      });

      const res = await handlePost({
        request: webhookReq(body, { 'stripe-signature': 'sig=1' }),
      });
      expect(res.status).toBe(200);
      const json = (await res.json()) as { skipped?: string };
      expect(json.skipped).toBe('test_event_in_production');
      expect(mockAuthHandler).not.toHaveBeenCalled();

      const rows = await readLedger();
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('ignored_test_mode');
      expect(rows[0].httpStatus).toBe(200);
      expect(rows[0].signaturePresent).toBe(true);
    } finally {
      (env as { ENVIRONMENT: string }).ENVIRONMENT = originalEnv;
    }
  });
});

describe('Stripe webhook - phase 2 verified processing', () => {
  it('writes processed row with verified fields when better-auth returns 2xx', async () => {
    const body = JSON.stringify({
      id: 'evt_processed',
      type: 'customer.subscription.updated',
      livemode: true,
      api_version: '2024-09-30',
      created: 1700000000,
      data: {
        object: {
          id: 'sub_123',
          customer: 'cus_abc',
          metadata: { referenceId: 'org-1' },
        },
      },
    });

    const res = await handlePost({
      request: webhookReq(body, { 'stripe-signature': 'sig=ok' }),
    });
    expect(res.status).toBe(200);
    expect(mockAuthHandler).toHaveBeenCalledTimes(1);

    const rows = await readLedger();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('processed');
    expect(rows[0].stripeEventId).toBe('evt_processed');
    expect(rows[0].type).toBe('customer.subscription.updated');
    expect(rows[0].livemode).toBe(true);
    expect(rows[0].orgId).toBe('org-1');
    expect(rows[0].stripeCustomerId).toBe('cus_abc');
    expect(rows[0].stripeSubscriptionId).toBe('sub_123');
    expect(rows[0].httpStatus).toBe(200);
  });

  it('captures checkout session id and links subscription on checkout.session.completed', async () => {
    const body = JSON.stringify({
      id: 'evt_checkout',
      type: 'checkout.session.completed',
      livemode: true,
      data: {
        object: {
          id: 'cs_xyz',
          customer: 'cus_xyz',
          subscription: 'sub_from_checkout',
          mode: 'subscription',
          metadata: { referenceId: 'org-2' },
        },
      },
    });

    const res = await handlePost({
      request: webhookReq(body, { 'stripe-signature': 'sig=ok' }),
    });
    expect(res.status).toBe(200);

    const rows = await readLedger();
    expect(rows[0].stripeCheckoutSessionId).toBe('cs_xyz');
    expect(rows[0].stripeSubscriptionId).toBe('sub_from_checkout');
    expect(rows[0].orgId).toBe('org-2');
  });

  it('marks ledger ignored_unverified when better-auth returns 401/403', async () => {
    mockAuthHandler.mockResolvedValueOnce(new Response('bad signature', { status: 401 }));

    const res = await handlePost({
      request: webhookReq('{"id":"evt_bad"}', { 'stripe-signature': 'sig=bogus' }),
    });
    expect(res.status).toBe(401);

    const rows = await readLedger();
    expect(rows.length).toBe(1);
    expect(rows[0].status).toBe('ignored_unverified');
    expect(rows[0].error).toBe('invalid_signature');
    expect(rows[0].httpStatus).toBe(401);
  });

  it('marks ledger failed when better-auth returns 5xx', async () => {
    mockAuthHandler.mockResolvedValueOnce(
      new Response('internal stripe handler error', { status: 500 }),
    );

    const res = await handlePost({
      request: webhookReq('{"id":"evt_fail"}', { 'stripe-signature': 'sig=ok' }),
    });
    expect(res.status).toBe(500);

    const rows = await readLedger();
    expect(rows[0].status).toBe('failed');
    expect(rows[0].httpStatus).toBe(500);
    expect(rows[0].error).toContain('internal stripe handler error');
  });
});

describe('Stripe webhook - error path', () => {
  it('catches handler exceptions, marks ledger failed, returns 500', async () => {
    mockAuthHandler.mockRejectedValueOnce(new Error('boom'));

    const res = await handlePost({
      request: webhookReq('{"id":"evt_throw"}', { 'stripe-signature': 'sig=ok' }),
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('Webhook processing error');

    const db = createDb(env.DB);
    const rows = await db.select().from(stripeEventLedger).all();
    const failed = rows.find(r => r.status === 'failed');
    expect(failed).toBeDefined();
    expect(failed!.error).toContain('boom');
    expect(failed!.httpStatus).toBe(500);

    // Sanity: the row was inserted by phase 1 (received) and updated by the catch
    const recv = await db
      .select()
      .from(stripeEventLedger)
      .where(eq(stripeEventLedger.id, failed!.id))
      .get();
    expect(recv?.payloadHash).toBeTruthy();
  });
});
