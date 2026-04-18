import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../sync-after-success';

let currentUser: {
  id: string;
  email: string;
  stripeCustomerId: string | null;
} = { id: 'user-1', email: 'user1@example.com', stripeCustomerId: 'cus_test_user-1' };

let sessionResult: { user: { id: string; email: string; name: string; stripeCustomerId: string | null }; session: { id: string; userId: string } } | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const syncMock = vi.fn();

vi.mock('@corates/workers/commands/billing', () => ({
  syncStripeSubscription: (...args: unknown[]) => syncMock(...args),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com', stripeCustomerId: 'cus_test_user-1' };
  sessionResult = {
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User', stripeCustomerId: currentUser.stripeCustomerId },
    session: { id: 'test-session', userId: currentUser.id },
  };
});

function syncReq(): Request {
  return new Request('http://localhost/api/billing/sync-after-success', { method: 'POST' });
}

describe('POST /api/billing/sync-after-success', () => {
  it('returns 401 when no session', async () => {
    sessionResult = null;
    const res = await handlePost({ request: syncReq() });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBeDefined();
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('returns no-op when user has no stripeCustomerId', async () => {
    sessionResult!.user.stripeCustomerId = null;
    const res = await handlePost({ request: syncReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; stripeSubscriptionId: string | null };
    expect(body).toEqual({ status: 'none', stripeSubscriptionId: null });
    expect(syncMock).not.toHaveBeenCalled();
  });

  it('calls syncStripeSubscription and returns its result', async () => {
    syncMock.mockResolvedValueOnce({ status: 'active', stripeSubscriptionId: 'sub_123' });
    const res = await handlePost({ request: syncReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; stripeSubscriptionId: string | null };
    expect(body).toEqual({ status: 'active', stripeSubscriptionId: 'sub_123' });
    expect(syncMock).toHaveBeenCalledTimes(1);
    const args = syncMock.mock.calls[0];
    expect(args[2]).toBe('cus_test_user-1');
  });

  it('returns 500 when syncStripeSubscription throws', async () => {
    syncMock.mockRejectedValueOnce(new Error('stripe down'));
    const res = await handlePost({ request: syncReq() });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string; details?: { operation: string } };
    expect(body.code).toBeDefined();
    expect(body.details?.operation).toBe('sync_stripe_subscription');
  });
});
