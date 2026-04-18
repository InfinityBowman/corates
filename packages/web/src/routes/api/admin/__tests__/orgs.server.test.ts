import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildOrg,
  buildOrgMember,
  buildAdminUser,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import { handleGet as handleListOrgs } from '../orgs';
import { handleGet as handleOrgDetails } from '../orgs/$orgId';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
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

function listReq(path = '/api/admin/orgs'): Request {
  return new Request(`http://localhost${path}`);
}

function detailsReq(orgId: string): Request {
  return new Request(`http://localhost/api/admin/orgs/${orgId}`);
}

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

describe('GET /api/admin/orgs', () => {
  it('returns 401 when no session', async () => {
    const res = await handleListOrgs({ request: listReq() });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const user = await buildUser();
    sessionResult = {
      user: { id: user.id, email: user.email, name: user.name, role: 'user' },
      session: { id: 'sess', userId: user.id, activeOrganizationId: null },
    };
    const res = await handleListOrgs({ request: listReq() });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { details?: { reason?: string } };
    expect(body.details?.reason).toBe('admin_required');
  });

  it('returns paginated orgs', async () => {
    await asAdmin();
    await buildOrg({ org: { id: 'org-a', name: 'Org A', slug: 'org-a' } });
    await buildOrg({ org: { id: 'org-b', name: 'Org B', slug: 'org-b' } });
    await buildOrg({ org: { id: 'org-c', name: 'Org C', slug: 'org-c' } });

    const res = await handleListOrgs({ request: listReq('/api/admin/orgs?page=1&limit=2') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orgs: unknown[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
    };
    expect(body.orgs.length).toBe(2);
    expect(body.pagination.page).toBe(1);
    expect(body.pagination.limit).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
  });

  it('searches orgs by name (case-insensitive)', async () => {
    await asAdmin();
    await buildOrg({ org: { id: 'org-a', name: 'Acme Corporation', slug: 'acme' } });
    await buildOrg({ org: { id: 'org-b', name: 'Beta Industries', slug: 'beta' } });

    const res = await handleListOrgs({ request: listReq('/api/admin/orgs?search=acme') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orgs: { name: string }[];
      pagination: { total: number };
    };
    expect(body.orgs.length).toBe(1);
    expect(body.orgs[0].name).toBe('Acme Corporation');
    expect(body.pagination.total).toBe(1);
  });

  it('searches orgs by slug (case-insensitive)', async () => {
    await asAdmin();
    await buildOrg({ org: { id: 'org-a', name: 'Acme', slug: 'acme-corp' } });
    await buildOrg({ org: { id: 'org-b', name: 'Beta', slug: 'beta-industries' } });

    const res = await handleListOrgs({ request: listReq('/api/admin/orgs?search=BETA') });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { orgs: { slug: string }[] };
    expect(body.orgs.length).toBe(1);
    expect(body.orgs[0].slug).toBe('beta-industries');
  });

  it('includes member and project counts in stats', async () => {
    await asAdmin();
    const { org, owner } = await buildOrg({ org: { id: 'org-1', name: 'Counted Org' } });
    await buildOrgMember({ orgId: org.id, role: 'member' });

    const { projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
    const { env } = await import('cloudflare:test');
    const db = createDb(env.DB);
    await db.insert(projects).values({
      id: 'p-1',
      name: 'Project 1',
      orgId: org.id,
      createdBy: owner.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await handleListOrgs({ request: listReq() });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      orgs: { id: string; stats: { memberCount: number; projectCount: number } }[];
    };
    const found = body.orgs.find(o => o.id === org.id)!;
    expect(found.stats.memberCount).toBe(2);
    expect(found.stats.projectCount).toBe(1);
  });
});

describe('GET /api/admin/orgs/:orgId', () => {
  it('returns 401 when no session', async () => {
    const res = await handleOrgDetails({
      request: detailsReq('org-1'),
      params: { orgId: 'org-1' },
    });
    expect(res.status).toBe(401);
  });

  it('returns 403 when caller is not admin', async () => {
    const user = await buildUser();
    sessionResult = {
      user: { id: user.id, email: user.email, name: user.name, role: 'user' },
      session: { id: 'sess', userId: user.id, activeOrganizationId: null },
    };
    const res = await handleOrgDetails({
      request: detailsReq('org-1'),
      params: { orgId: 'org-1' },
    });
    expect(res.status).toBe(403);
  });

  it('returns 403 for non-existent orgId', async () => {
    await asAdmin();
    const res = await handleOrgDetails({
      request: detailsReq('does-not-exist'),
      params: { orgId: 'does-not-exist' },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { details?: { reason?: string } };
    expect(body.details?.reason).toBe('org_not_found');
  });

  it('returns org details with stats and billing summary', async () => {
    await asAdmin();
    const { org, owner } = await buildOrg({ org: { id: 'org-detail', name: 'Detail Org' } });

    const { projects } = await import('@corates/db/schema');
    const { createDb } = await import('@corates/db/client');
    const { env } = await import('cloudflare:test');
    const db = createDb(env.DB);
    await db.insert(projects).values({
      id: 'p-detail',
      name: 'Project',
      orgId: org.id,
      createdBy: owner.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const res = await handleOrgDetails({
      request: detailsReq(org.id),
      params: { orgId: org.id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      org: { id: string };
      stats: { memberCount: number; projectCount: number };
      billing: {
        effectivePlanId: string;
        source: string;
        accessMode: string;
        plan: { name: string };
      };
    };
    expect(body.org.id).toBe(org.id);
    expect(body.stats.memberCount).toBe(1);
    expect(body.stats.projectCount).toBe(1);
    expect(body.billing.effectivePlanId).toBeDefined();
    expect(body.billing.source).toBeDefined();
    expect(body.billing.plan.name).toBeDefined();
  });
});
