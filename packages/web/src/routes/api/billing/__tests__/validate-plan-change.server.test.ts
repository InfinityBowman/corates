import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../validate-plan-change';

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

function validateReq(query: string): Request {
  return new Request(`http://localhost/api/billing/validate-plan-change${query}`, {
    method: 'GET',
  });
}

describe('GET /api/billing/validate-plan-change', () => {
  it('returns 400 when targetPlan is missing', async () => {
    const res = await handleGet({ request: validateReq(''), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/VALIDATION_FIELD_REQUIRED/);
  });

  it('returns 401 when no session', async () => {
    sessionResult = null;
    const res = await handleGet({ request: validateReq('?targetPlan=starter_team'), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(401);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('AUTH_REQUIRED');
  });

  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan-user', email: 'orphan@example.com', name: 'Orphan' },
      session: { id: 'sess-1', userId: 'orphan-user', activeOrganizationId: null },
    };
    const res = await handleGet({ request: validateReq('?targetPlan=starter_team'), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('no_org_found');
  });

  it('returns valid=true when usage fits target plan', async () => {
    const { org, owner } = await buildOrg();
    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({ request: validateReq('?targetPlan=starter_team'), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      valid: boolean;
      violations: unknown[];
      targetPlan: { id: string };
    };
    expect(body.valid).toBe(true);
    expect(body.violations).toHaveLength(0);
    expect(body.targetPlan.id).toBe('starter_team');
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

    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess-1', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({ request: validateReq('?targetPlan=starter_team'), context: { db: createDb(env.DB) } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      valid: boolean;
      violations: Array<{ quotaKey: string; used: number; limit: number }>;
    };
    expect(body.valid).toBe(false);
    expect(body.violations.length).toBeGreaterThan(0);
    expect(body.violations[0].quotaKey).toBe('projects.max');
    expect(body.violations[0].used).toBe(5);
    expect(body.violations[0].limit).toBe(3);
  });
});
