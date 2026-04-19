import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs, seedMediaFile } from '@/__tests__/server/helpers';
import {
  buildAdminUser,
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectMember,
  resetCounter,
} from '@/__tests__/server/factories';
import { handleGet as listProjects } from '../projects';
import { handleGet as projectDetails, handleDelete as deleteProject } from '../projects/$projectId';
import { handleGet as docStats } from '../projects/$projectId/doc-stats';
import { handleDelete as removeMember } from '../projects/$projectId/members/$memberId';

let sessionResult: {
  user: { id: string; email: string; name: string; role?: string };
  session: { id: string; userId: string; activeOrganizationId: string | null };
} | null = null;

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => sessionResult,
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['admin-doc-stats-project']);
  vi.clearAllMocks();
  resetCounter();
  sessionResult = null;
});

async function asAdmin() {
  const admin = await buildAdminUser();
  sessionResult = {
    user: { id: admin.id, email: admin.email, name: admin.name, role: 'admin' },
    session: { id: 'admin-sess', userId: admin.id, activeOrganizationId: null },
  };
  return admin;
}

function listReq(path = '/api/admin/projects'): Request {
  return new Request(`http://localhost${path}`);
}

describe('GET /api/admin/projects', () => {
  it('returns paginated projects with org/creator info', async () => {
    await asAdmin();
    await buildProject();
    await buildProject();
    await buildProject();

    const res = await listProjects({
      request: listReq('/api/admin/projects?page=1&limit=2'),
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      projects: { id: string; orgName: string | null; creatorEmail: string | null }[];
      pagination: { total: number; totalPages: number };
    };
    expect(body.projects.length).toBe(2);
    expect(body.pagination.total).toBe(3);
    expect(body.pagination.totalPages).toBe(2);
    expect(body.projects[0].orgName).toBeDefined();
    expect(body.projects[0].creatorEmail).toBeDefined();
  });

  it('searches projects by name (case-insensitive)', async () => {
    await asAdmin();
    const { org, owner } = await buildOrg();
    await buildProject({ org, owner, project: { id: 'p-amphi', name: 'Amphibian Census' } });
    await buildProject({ org, owner, project: { id: 'p-other', name: 'Other Topic' } });

    const res = await listProjects({
      request: listReq('/api/admin/projects?search=amphi'),
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: { name: string }[] };
    expect(body.projects.length).toBe(1);
    expect(body.projects[0].name).toBe('Amphibian Census');
  });

  it('filters by orgId', async () => {
    await asAdmin();
    const { org: org1 } = await buildOrg();
    const { org: org2 } = await buildOrg();
    await buildProject({ org: org1 });
    await buildProject({ org: org2 });

    const res = await listProjects({
      request: listReq(`/api/admin/projects?orgId=${encodeURIComponent(org1.id)}`),
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { projects: { orgId: string }[] };
    expect(body.projects.length).toBe(1);
    expect(body.projects[0].orgId).toBe(org1.id);
  });

  it('includes member and file counts', async () => {
    const admin = await asAdmin();
    const { project, org } = await buildProject();
    const { user: extra } = await buildOrgMember({ orgId: org.id });
    await buildProjectMember({ projectId: project.id, orgId: org.id, user: extra });
    await seedMediaFile({
      id: 'mf-1',
      filename: 'a.pdf',
      bucketKey: `projects/${project.id}/studies/s1/a.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: admin.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const res = await listProjects({ request: listReq(), context: { db: createDb(env.DB) } });
    const body = (await res.json()) as {
      projects: { id: string; memberCount: number; fileCount: number }[];
    };
    const found = body.projects.find(p => p.id === project.id)!;
    expect(found.memberCount).toBeGreaterThanOrEqual(1);
    expect(found.fileCount).toBe(1);
  });
});

describe('GET /api/admin/projects/:projectId', () => {
  // Auth-bypass cases (no session, wrong role, CSRF) are covered by the
  // SELF.fetch tests in projects-self.server.test.ts. Those exercise the
  // adminMiddleware that this route now relies on; calling the handler
  // directly would skip the middleware and silently false-pass.

  it('returns 404 when project not found', async () => {
    await asAdmin();
    const res = await projectDetails({
      request: new Request('http://localhost/api/admin/projects/nope'),
      params: { projectId: 'nope' },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(404);
  });

  it('returns project with members, files, invitations, stats', async () => {
    const admin = await asAdmin();
    const { project, org, owner } = await buildProject();
    const { user: extra } = await buildOrgMember({ orgId: org.id });
    await buildProjectMember({ projectId: project.id, orgId: org.id, user: extra });
    await seedMediaFile({
      id: 'mf-detail',
      filename: 'doc.pdf',
      fileSize: 4096,
      bucketKey: `projects/${project.id}/studies/s1/doc.pdf`,
      orgId: org.id,
      projectId: project.id,
      studyId: 's1',
      uploadedBy: owner.id,
      createdAt: Math.floor(Date.now() / 1000),
    });

    const res = await projectDetails({
      request: new Request(`http://localhost/api/admin/projects/${project.id}`),
      params: { projectId: project.id },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      project: { id: string };
      members: unknown[];
      files: { fileSize: number | null }[];
      invitations: unknown[];
      stats: { memberCount: number; fileCount: number; totalStorageBytes: number };
    };
    expect(body.project.id).toBe(project.id);
    expect(body.stats.memberCount).toBe(body.members.length);
    expect(body.stats.fileCount).toBe(1);
    expect(body.stats.totalStorageBytes).toBe(4096);
    void admin;
  });
});

describe('GET /api/admin/projects/:projectId/doc-stats', () => {
  it('returns 404 without waking the DO when project missing in D1', async () => {
    await asAdmin();
    const res = await docStats({
      request: new Request('http://localhost/api/admin/projects/no-such/doc-stats'),
      params: { projectId: 'no-such' },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(404);
  });

  it('returns stat shape for an existing empty project', async () => {
    await asAdmin();
    const { org, owner } = await buildOrg();
    const { project } = await buildProject({
      org,
      owner,
      project: { id: 'admin-doc-stats-project', name: 'Stats' },
    });

    const res = await docStats({
      request: new Request(`http://localhost/api/admin/projects/${project.id}/doc-stats`),
      params: { projectId: project.id },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      rows: { total: number; totalBytes: number; snapshotBytes: number; updateBytes: number };
      content: { members: number; studies: number; checklists: number; pdfs: number };
      memoryUsagePercent: number;
    };
    expect(typeof body.rows.total).toBe('number');
    expect(body.content.studies).toBe(0);
    expect(body.memoryUsagePercent).toBeLessThan(0.01);
    expect(body.rows.totalBytes).toBe(body.rows.snapshotBytes + body.rows.updateBytes);
  });
});

describe('DELETE /api/admin/projects/:projectId/members/:memberId', () => {
  it('returns 404 when member not found', async () => {
    await asAdmin();
    const res = await removeMember({
      request: new Request('http://localhost/api/admin/projects/p1/members/m1', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { projectId: 'p1', memberId: 'm1' },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(404);
  });

  it('removes a member that belongs to the project', async () => {
    await asAdmin();
    const { project, org } = await buildProject();
    const { user: u, membership } = await buildOrgMember({ orgId: org.id });
    const { membership: pm } = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      user: u,
    });

    const res = await removeMember({
      request: new Request(`http://localhost/api/admin/projects/${project.id}/members/${pm.id}`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { projectId: project.id, memberId: pm.id },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);

    const { projectMembers } = await import('@corates/db/schema');
    const { eq } = await import('drizzle-orm');
    const db = createDb(env.DB);
    const remaining = await db
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(eq(projectMembers.id, pm.id));
    expect(remaining.length).toBe(0);
    void membership;
  });
});

describe('DELETE /api/admin/projects/:projectId', () => {
  it('returns 404 when project missing', async () => {
    await asAdmin();
    const res = await deleteProject({
      request: new Request('http://localhost/api/admin/projects/nope', {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { projectId: 'nope' },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(404);
  });

  it('deletes existing project', async () => {
    await asAdmin();
    const { project } = await buildProject();
    const res = await deleteProject({
      request: new Request(`http://localhost/api/admin/projects/${project.id}`, {
        method: 'DELETE',
        headers: { origin: 'http://localhost:3010' },
      }),
      params: { projectId: project.id },
      context: { db: createDb(env.DB) },
    });
    expect(res.status).toBe(200);

    const { projects } = await import('@corates/db/schema');
    const { eq } = await import('drizzle-orm');
    const db = createDb(env.DB);
    const remaining = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.id, project.id));
    expect(remaining.length).toBe(0);
  });
});
