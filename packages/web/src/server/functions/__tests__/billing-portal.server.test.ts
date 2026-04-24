import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { createPortalSession } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';

function mockSession(overrides: {
  userId: string;
  email: string;
  name: string;
  activeOrganizationId?: string | null;
}): Session {
  return {
    user: { id: overrides.userId, email: overrides.email, name: overrides.name },
    session: {
      id: 'sess-1',
      userId: overrides.userId,
      activeOrganizationId: overrides.activeOrganizationId ?? null,
    },
  } as Session;
}

const createBillingPortalMock = vi.fn();

vi.mock('@corates/workers/auth-config', () => ({
  createAuth: () => ({
    api: { createBillingPortal: (...args: unknown[]) => createBillingPortalMock(...args) },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

const dummyRequest = new Request('http://localhost/api/billing/portal', { method: 'POST' });

describe('createPortalSession', () => {
  it('throws 403 when user has no org membership', async () => {
    const session = mockSession({
      userId: 'orphan-user',
      email: 'orphan@example.com',
      name: 'Orphan',
    });
    try {
      await createPortalSession(createDb(env.DB), session, dummyRequest);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('no_org_found');
    }
    expect(createBillingPortalMock).not.toHaveBeenCalled();
  });

  it('throws 403 when caller is org member but not owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    const session = mockSession({
      userId: memberUser.id,
      email: memberUser.email,
      name: memberUser.name,
      activeOrganizationId: org.id,
    });
    try {
      await createPortalSession(createDb(env.DB), session, dummyRequest);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('org_owner_required');
    }
    expect(createBillingPortalMock).not.toHaveBeenCalled();
  });

  it('returns portal URL when caller is org owner', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    createBillingPortalMock.mockResolvedValueOnce({ url: 'https://stripe.example/portal/abc' });

    const result = await createPortalSession(createDb(env.DB), session, dummyRequest);
    expect((result as { url: string }).url).toBe('https://stripe.example/portal/abc');

    expect(createBillingPortalMock).toHaveBeenCalledTimes(1);
    const callArg = createBillingPortalMock.mock.calls[0][0] as {
      body: { referenceId: string; returnUrl: string };
    };
    expect(callArg.body.referenceId).toBe(org.id);
    expect(callArg.body.returnUrl).toContain('/settings/billing');
  });

  it('falls back to first org membership when session has no activeOrganizationId', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: null,
    });
    createBillingPortalMock.mockResolvedValueOnce({ url: 'https://stripe.example/portal/xyz' });

    await createPortalSession(createDb(env.DB), session, dummyRequest);
    const callArg = createBillingPortalMock.mock.calls[0][0] as { body: { referenceId: string } };
    expect(callArg.body.referenceId).toBe(org.id);
  });

  it('propagates error when createBillingPortal throws', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    createBillingPortalMock.mockRejectedValueOnce(new Error('stripe down'));

    await expect(createPortalSession(createDb(env.DB), session, dummyRequest)).rejects.toThrow(
      'stripe down',
    );
  });
});
