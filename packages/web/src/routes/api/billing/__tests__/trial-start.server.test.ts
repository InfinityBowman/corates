import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handlePost } from '../trial/start';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

function trialReq(): Request {
  return new Request('http://localhost/api/billing/trial/start', { method: 'POST' });
}

describe('POST /api/billing/trial/start', () => {
  it('returns 401 when no session', async () => {
    const res = await handlePost({ request: trialReq() });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan-user', email: 'orphan@example.com', name: 'Orphan' },
      session: { id: 'sess-1', userId: 'orphan-user', activeOrganizationId: null },
    };
    const res = await handlePost({ request: trialReq() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('no_org_found');
  });

  it('returns 403 when caller is org member but not owner', async () => {
    const { org } = await buildOrg();
    const { user: memberUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    sessionResult = {
      user: { id: memberUser.id, email: memberUser.email, name: memberUser.name },
      session: { id: 'sess-1', userId: memberUser.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({ request: trialReq() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('org_owner_required');
  });

  it('creates trial grant when caller is org owner', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handlePost({ request: trialReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      grantId: string;
      expiresAt: number;
    };
    expect(body.success).toBe(true);
    expect(body.grantId).toBeDefined();
    expect(body.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const row = await env.DB.prepare(
      'SELECT * FROM org_access_grants WHERE id = ?1',
    )
      .bind(body.grantId)
      .first<{ orgId: string; type: string }>();
    expect(row).not.toBeNull();
    expect(row!.orgId).toBe(org.id);
    expect(row!.type).toBe('trial');
  });

  it('returns 400 when trial grant already exists', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    const first = await handlePost({ request: trialReq() });
    expect(first.status).toBe(200);

    const second = await handlePost({ request: trialReq() });
    expect(second.status).toBe(400);
    const body = (await second.json()) as { code: string };
    expect(body.code).toBe('VALIDATION_INVALID_INPUT');
  });
});
