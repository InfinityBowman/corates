import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildOrg, buildOrgMember, resetCounter } from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { env } from 'cloudflare:test';
import { projects } from '@corates/db/schema';
import type { OrgId } from '@corates/shared/ids';
import type { Session } from '@/server/middleware/auth';
import { listAdminOrgs, getAdminOrgDetails } from '@/server/functions/admin-orgs.server';

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs([]);
  vi.clearAllMocks();
  resetCounter();
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('GET /api/admin/orgs', () => {
  it('returns paginated orgs', async () => {
    await buildOrg({ org: { id: 'org-a', name: 'Org A', slug: 'org-a' } });
    await buildOrg({ org: { id: 'org-b', name: 'Org B', slug: 'org-b' } });
    await buildOrg({ org: { id: 'org-c', name: 'Org C', slug: 'org-c' } });

    const result = await listAdminOrgs(mockAdminSession(), createDb(env.DB), {
      page: 1,
      limit: 2,
    });
    expect(result.orgs.length).toBe(2);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.limit).toBe(2);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
  });

  it('searches orgs by name (case-insensitive)', async () => {
    await buildOrg({ org: { id: 'org-a', name: 'Acme Corporation', slug: 'acme' } });
    await buildOrg({ org: { id: 'org-b', name: 'Beta Industries', slug: 'beta' } });

    const result = await listAdminOrgs(mockAdminSession(), createDb(env.DB), { search: 'acme' });
    expect(result.orgs.length).toBe(1);
    expect(result.orgs[0].name).toBe('Acme Corporation');
    expect(result.pagination.total).toBe(1);
  });

  it('searches orgs by slug (case-insensitive)', async () => {
    await buildOrg({ org: { id: 'org-a', name: 'Acme', slug: 'acme-corp' } });
    await buildOrg({ org: { id: 'org-b', name: 'Beta', slug: 'beta-industries' } });

    const result = await listAdminOrgs(mockAdminSession(), createDb(env.DB), { search: 'BETA' });
    expect(result.orgs.length).toBe(1);
    expect(result.orgs[0].slug).toBe('beta-industries');
  });

  it('includes member and project counts in stats', async () => {
    const { org, owner } = await buildOrg({ org: { id: 'org-1', name: 'Counted Org' } });
    await buildOrgMember({ orgId: org.id, role: 'member' });

    const db = createDb(env.DB);
    await db.insert(projects).values({
      id: 'p-1',
      name: 'Project 1',
      orgId: org.id,
      createdBy: owner.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await listAdminOrgs(mockAdminSession(), createDb(env.DB), {});
    const found = result.orgs.find(o => o.id === org.id)!;
    expect(found.stats.memberCount).toBe(2);
    expect(found.stats.projectCount).toBe(1);
  });
});

describe('GET /api/admin/orgs/:orgId', () => {
  it('throws 403 for non-existent orgId', async () => {
    try {
      await getAdminOrgDetails(mockAdminSession(), createDb(env.DB), 'does-not-exist' as OrgId);
      expect.unreachable('should have thrown');
    } catch (err) {
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { details?: { reason?: string } };
      expect(body.details?.reason).toBe('org_not_found');
    }
  });

  it('returns org details with stats and billing summary', async () => {
    const { org, owner } = await buildOrg({ org: { id: 'org-detail', name: 'Detail Org' } });

    const db = createDb(env.DB);
    await db.insert(projects).values({
      id: 'p-detail',
      name: 'Project',
      orgId: org.id,
      createdBy: owner.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await getAdminOrgDetails(mockAdminSession(), createDb(env.DB), org.id as OrgId);
    expect(result.org.id).toBe(org.id);
    expect(result.stats.memberCount).toBe(1);
    expect(result.stats.projectCount).toBe(1);
    expect(result.billing.effectivePlanId).toBeDefined();
    expect(result.billing.source).toBeDefined();
    expect(result.billing.plan.name).toBeDefined();
  });
});
