import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../single-project/checkout';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

const createSingleProjectCheckoutMock = vi.fn();

vi.mock('@corates/workers/commands/billing', () => ({
  createSingleProjectCheckout: (...args: unknown[]) => createSingleProjectCheckoutMock(...args),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

function spReq(): Request {
  return new Request('http://localhost/api/billing/single-project/checkout', { method: 'POST' });
}

describe('POST /api/billing/single-project/checkout', () => {
  it('returns 401 when no session', async () => {
    const res = await handlePost({ request: spReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(401);
    expect(createSingleProjectCheckoutMock).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is not org owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    sessionResult = {
      user: { id: memberUser.id, email: memberUser.email, name: memberUser.name },
      session: { id: 'sess', userId: memberUser.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({ request: spReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(403);
    expect(createSingleProjectCheckoutMock).not.toHaveBeenCalled();
  });

  it('creates checkout session for org owner', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    createSingleProjectCheckoutMock.mockResolvedValueOnce({
      url: 'https://checkout.stripe/sp',
      sessionId: 'cs_sp_1',
    });

    const res = await handlePost({ request: spReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string; sessionId: string };
    expect(body.url).toBe('https://checkout.stripe/sp');
    expect(body.sessionId).toBe('cs_sp_1');

    expect(createSingleProjectCheckoutMock).toHaveBeenCalledTimes(1);
    const args = createSingleProjectCheckoutMock.mock.calls[0];
    expect(args[1]).toMatchObject({ id: owner.id });
    expect(args[2]).toEqual({ orgId: org.id });
  });

  it('returns 500 when command throws non-domain error', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    createSingleProjectCheckoutMock.mockRejectedValueOnce(new Error('stripe down'));

    const res = await handlePost({ request: spReq(), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('SYSTEM_INTERNAL_ERROR');
  });
});
