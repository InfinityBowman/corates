import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../sync-after-success';
import type { Session } from '@/server/middleware/auth';

function mockSession(overrides?: {
  userId?: string;
  email?: string;
  name?: string;
  stripeCustomerId?: string | null;
}): Session {
  return {
    user: {
      id: overrides?.userId ?? 'user-1',
      email: overrides?.email ?? 'user1@example.com',
      name: overrides?.name ?? 'Test User',
      stripeCustomerId: overrides?.stripeCustomerId ?? 'cus_test_user-1',
    },
    session: {
      id: 'test-session',
      userId: overrides?.userId ?? 'user-1',
    },
  } as Session;
}

const syncMock = vi.fn();

vi.mock('@corates/workers/commands/billing', () => ({
  syncStripeSubscription: (...args: unknown[]) => syncMock(...args),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

function syncReq(): Request {
  return new Request('http://localhost/api/billing/sync-after-success', { method: 'POST' });
}

describe('POST /api/billing/sync-after-success', () => {
  it('returns no-op when user has no stripeCustomerId', async () => {
    const session = mockSession({ stripeCustomerId: null });
    const res = await handlePost({
      request: syncReq(),
      context: { db: createDb(env.DB), session },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; stripeSubscriptionId: string | null };
    expect(body).toEqual({ status: 'none', stripeSubscriptionId: null });
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('calls syncStripeSubscription and returns its result', async () => {
    const session = mockSession();
    syncMock.mockResolvedValueOnce({ status: 'active', stripeSubscriptionId: 'sub_123' });
    const res = await handlePost({
      request: syncReq(),
      context: { db: createDb(env.DB), session },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; stripeSubscriptionId: string | null };
    expect(body).toEqual({ status: 'active', stripeSubscriptionId: 'sub_123' });
    expect(syncMock).toHaveBeenCalledTimes(1);
    const args = syncMock.mock.calls[0];
    expect(args[2]).toBe('cus_test_user-1');
  });

  it('returns 500 when syncStripeSubscription throws', async () => {
    const session = mockSession();
    syncMock.mockRejectedValueOnce(new Error('stripe down'));
    const res = await handlePost({
      request: syncReq(),
      context: { db: createDb(env.DB), session },
    });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string; details?: { operation: string } };
    expect(body.code).toBeDefined();
    expect(body.details?.operation).toBe('sync_stripe_subscription');
  });
});
