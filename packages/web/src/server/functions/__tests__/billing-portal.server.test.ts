import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { createPortalSession } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import type { OrgId } from '@corates/shared/ids';

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
      await createPortalSession(createDb(env.DB), session, dummyRequest, 'org-none' as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(403);
      const body = res.toDomainError() as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('not_org_member');
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
      await createPortalSession(createDb(env.DB), session, dummyRequest, org.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(403);
      const body = res.toDomainError() as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('insufficient_org_role');
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

    const result = await createPortalSession(createDb(env.DB), session, dummyRequest, org.id);
    expect((result as { url: string }).url).toBe('https://stripe.example/portal/abc');

    expect(createBillingPortalMock).toHaveBeenCalledTimes(1);
    const callArg = createBillingPortalMock.mock.calls[0][0] as {
      body: { referenceId: string; returnUrl: string };
    };
    expect(callArg.body.referenceId).toBe(org.id);
    expect(callArg.body.returnUrl).toContain('/settings/billing');
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

    await expect(
      createPortalSession(createDb(env.DB), session, dummyRequest, org.id),
    ).rejects.toThrow('stripe down');
  });
});
