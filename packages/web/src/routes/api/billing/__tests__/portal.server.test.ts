import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../portal';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

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
  sessionResult = null;
});

function portalReq(): Request {
  return new Request('http://localhost/api/billing/portal', { method: 'POST' });
}

describe('POST /api/billing/portal', () => {
  it('returns 401 when no session', async () => {
    sessionResult = null;
    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_REQUIRED');
    expect(createBillingPortalMock).not.toHaveBeenCalled();
  });

  it('returns 403 when user has no org membership', async () => {
    sessionResult = {
      user: { id: 'orphan-user', email: 'orphan@example.com', name: 'Orphan' },
      session: { id: 'sess-1', userId: 'orphan-user', activeOrganizationId: null },
    };
    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('no_org_found');
    expect(createBillingPortalMock).not.toHaveBeenCalled();
  });

  it('returns 403 when caller is org member but not owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    sessionResult = {
      user: { id: memberUser.id, email: memberUser.email, name: memberUser.name },
      session: { id: 'sess-1', userId: memberUser.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('org_owner_required');
    expect(createBillingPortalMock).not.toHaveBeenCalled();
  });

  it('returns portal URL when caller is org owner', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    createBillingPortalMock.mockResolvedValueOnce({ url: 'https://stripe.example/portal/abc' });

    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { url: string };
    expect(body.url).toBe('https://stripe.example/portal/abc');

    expect(createBillingPortalMock).toHaveBeenCalledTimes(1);
    const callArg = createBillingPortalMock.mock.calls[0][0] as {
      body: { referenceId: string; returnUrl: string };
    };
    expect(callArg.body.referenceId).toBe(org.id);
    expect(callArg.body.returnUrl).toContain('/settings/billing');
  });

  it('falls back to first org membership when session has no activeOrganizationId', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: null },
    };
    createBillingPortalMock.mockResolvedValueOnce({ url: 'https://stripe.example/portal/xyz' });

    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(200);
    const callArg = createBillingPortalMock.mock.calls[0][0] as { body: { referenceId: string } };
    expect(callArg.body.referenceId).toBe(org.id);
  });

  it('returns 500 when createBillingPortal throws non-domain error', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    createBillingPortalMock.mockRejectedValueOnce(new Error('stripe down'));

    const res = await handlePost({ request: portalReq() });
    expect(res.status).toBe(500);
    const body = (await res.json()) as { code: string; details?: { operation?: string } };
    expect(body.code).toBe('SYSTEM_INTERNAL_ERROR');
    expect(body.details?.operation).toBe('create_portal_session');
  });
});
