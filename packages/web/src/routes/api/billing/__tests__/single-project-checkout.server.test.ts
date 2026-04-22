import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { createSPCheckout } from '@/server/functions/billing.server';
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
      id: 'sess',
      userId: overrides.userId,
      activeOrganizationId: overrides.activeOrganizationId ?? null,
    },
  } as Session;
}

const createSingleProjectCheckoutMock = vi.fn();

vi.mock('@corates/workers/commands/billing', () => ({
  createSingleProjectCheckout: (...args: unknown[]) => createSingleProjectCheckoutMock(...args),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

const dummyRequest = new Request('http://localhost/api/billing/single-project/checkout', {
  method: 'POST',
});

describe('createSPCheckout', () => {
  it('throws 403 when caller is not org owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    const session = mockSession({
      userId: memberUser.id,
      email: memberUser.email,
      name: memberUser.name,
      activeOrganizationId: org.id,
    });
    try {
      await createSPCheckout(createDb(env.DB), session, dummyRequest);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
    }
    expect(createSingleProjectCheckoutMock).not.toHaveBeenCalled();
  });

  it('creates checkout session for org owner', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    createSingleProjectCheckoutMock.mockResolvedValueOnce({
      url: 'https://checkout.stripe/sp',
      sessionId: 'cs_sp_1',
    });

    const result = await createSPCheckout(createDb(env.DB), session, dummyRequest);
    expect((result as { url: string }).url).toBe('https://checkout.stripe/sp');
    expect((result as { sessionId: string }).sessionId).toBe('cs_sp_1');

    expect(createSingleProjectCheckoutMock).toHaveBeenCalledTimes(1);
    const args = createSingleProjectCheckoutMock.mock.calls[0];
    expect(args[1]).toMatchObject({ id: owner.id });
    expect(args[2]).toEqual({ orgId: org.id });
  });

  it('propagates error when command throws', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    createSingleProjectCheckoutMock.mockRejectedValueOnce(new Error('stripe down'));

    await expect(
      createSPCheckout(createDb(env.DB), session, dummyRequest),
    ).rejects.toThrow('stripe down');
  });
});
