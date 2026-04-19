import { beforeEach, describe, expect, it } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { handleGet } from '../usage';

let sessionResult: {
  user: { id: string; email: string; name: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  resetCounter();
  sessionResult = null;
});

function usageReq(): Request {
  return new Request('http://localhost/api/billing/usage', { method: 'GET' });
}

describe('GET /api/billing/usage', () => {
  it('returns 403 when caller has no org', async () => {
    sessionResult = {
      user: { id: 'orphan', email: 'o@example.com', name: 'O' },
      session: { id: 'sess', userId: 'orphan', activeOrganizationId: null },
    };
    const res = await handleGet({
      request: usageReq(),
      context: { db: createDb(env.DB), session: sessionResult },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { details?: { reason?: string } };
    expect(body.details?.reason).toBe('no_org_found');
  });

  it('returns project + collaborator counts', async () => {
    const { org, owner } = await buildOrg();
    await buildOrgMember({ orgId: org.id, role: 'member' });
    await buildOrgMember({ orgId: org.id, role: 'admin' });

    const { projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
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

    sessionResult = {
      user: { id: owner.id, email: owner.email, name: owner.name },
      session: { id: 'sess', userId: owner.id, activeOrganizationId: org.id },
    };
    const res = await handleGet({
      request: usageReq(),
      context: { db: createDb(env.DB), session: sessionResult! },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: number; collaborators: number };
    expect(body.projects).toBe(3);
    // 1 owner is excluded; 1 member + 1 admin = 2 collaborators
    expect(body.collaborators).toBe(2);
  });
});
