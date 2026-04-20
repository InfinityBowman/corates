import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { fetchUsage } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  resetCounter();
});

function mockSession(overrides?: {
  userId?: string;
  email?: string;
  name?: string;
  activeOrganizationId?: string | null;
}): Session {
  return {
    user: {
      id: overrides?.userId ?? 'user-1',
      email: overrides?.email ?? 'user@example.com',
      name: overrides?.name ?? 'Test User',
    },
    session: {
      id: 'sess-1',
      userId: overrides?.userId ?? 'user-1',
      activeOrganizationId: overrides?.activeOrganizationId ?? null,
    },
  } as Session;
}

describe('fetchUsage', () => {
  it('throws 403 when caller has no org', async () => {
    const session = mockSession({ userId: 'orphan', email: 'o@example.com', name: 'O' });
    try {
      await fetchUsage(createDb(env.DB), session);
      expect.fail('should have thrown');
    } catch (res) {
      expect((res as Response).status).toBe(403);
      const body = (await (res as Response).json()) as { details?: { reason?: string } };
      expect(body.details?.reason).toBe('no_org_found');
    }
  });

  it('returns project + collaborator counts', async () => {
    const { org, owner } = await buildOrg();
    await buildOrgMember({ orgId: org.id, role: 'member' });
    await buildOrgMember({ orgId: org.id, role: 'admin' });

    const { projects } = await import('@corates/db/schema');
    const db = createDb(env.DB);
    for (let i = 1; i <= 3; i++) {
      await db.insert(projects).values({
        id: `project-${i}`,
        name: `Project ${i}`,
        orgId: org.id,
        createdBy: owner.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }

    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await fetchUsage(createDb(env.DB), session);
    expect(result.projects).toBe(3);
    expect(result.collaborators).toBe(2);
  });
});
