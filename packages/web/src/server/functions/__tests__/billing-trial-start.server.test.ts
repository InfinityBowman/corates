import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { beginTrial } from '@/server/functions/billing.server';
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

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  resetCounter();
});

describe('beginTrial', () => {
  it('throws 403 when caller has no org', async () => {
    const session = mockSession({
      userId: 'orphan-user',
      email: 'orphan@example.com',
      name: 'Orphan',
    });
    try {
      await beginTrial(createDb(env.DB), session);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('no_org_found');
    }
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
      await beginTrial(createDb(env.DB), session);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('org_owner_required');
    }
  });

  it('creates trial grant when caller is org owner', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await beginTrial(createDb(env.DB), session);
    expect(result.success).toBe(true);
    expect(result.grantId).toBeDefined();
    expect(result.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));

    const row = await env.DB.prepare('SELECT * FROM org_access_grants WHERE id = ?1')
      .bind(result.grantId)
      .first<{ orgId: string; type: string }>();
    expect(row).not.toBeNull();
    expect(row!.orgId).toBe(org.id);
    expect(row!.type).toBe('trial');
  });

  it('throws 400 when trial grant already exists', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    await beginTrial(createDb(env.DB), session);

    try {
      await beginTrial(createDb(env.DB), session);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('VALIDATION_INVALID_INPUT');
    }
  });
});
