import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { fetchPlanValidation } from '@/server/functions/billing.server';
import type { Session } from '@/server/middleware/auth';

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

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  resetCounter();
});

describe('fetchPlanValidation', () => {
  it('throws 403 when caller has no org', async () => {
    const session = mockSession({ userId: 'orphan', email: 'o@example.com', name: 'O' });
    try {
      await fetchPlanValidation(createDb(env.DB), session, 'starter_team');
      expect.fail('should have thrown');
    } catch (res) {
      expect((res as Response).status).toBe(403);
      const body = (await (res as Response).json()) as { code: string; details?: { reason?: string } };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('no_org_found');
    }
  });

  it('returns valid=true when usage fits target plan', async () => {
    const { org, owner } = await buildOrg();
    const session = mockSession({
      userId: owner.id,
      email: owner.email,
      name: owner.name,
      activeOrganizationId: org.id,
    });
    const result = await fetchPlanValidation(createDb(env.DB), session, 'starter_team');
    expect(result.valid).toBe(true);
    expect(result.violations).toHaveLength(0);
    expect(result.targetPlan.id).toBe('starter_team');
  });

  it('returns valid=false with violations when usage exceeds limits', async () => {
    const { org, owner } = await buildOrg();
    const { projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
    const db = createDb(env.DB);

    for (let i = 1; i <= 5; i++) {
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
    const result = await fetchPlanValidation(createDb(env.DB), session, 'starter_team');
    expect(result.valid).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].quotaKey).toBe('projects.max');
    expect(result.violations[0].used).toBe(5);
    expect(result.violations[0].limit).toBe(3);
  });
});
