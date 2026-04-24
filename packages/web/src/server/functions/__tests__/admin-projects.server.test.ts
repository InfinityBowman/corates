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
import type { Session } from '@/server/middleware/auth';
import {
  listAdminProjects,
  getAdminProjectDetails,
  getAdminProjectDocStats,
  removeAdminProjectMember,
  deleteAdminProject,
} from '@/server/functions/admin-projects.server';

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['admin-doc-stats-project']);
  vi.clearAllMocks();
  resetCounter();
});

function mockAdminSession(): Session {
  return {
    user: { id: 'admin-id', email: 'admin@example.com', name: 'Admin', role: 'admin' },
    session: { id: 'admin-sess', userId: 'admin-id' },
  } as Session;
}

describe('assertAdmin', () => {
  it('throws 403 for non-admin session', async () => {
    const nonAdmin = {
      user: { id: 'u', email: 'u@example.com', name: 'User', role: 'user' },
      session: { id: 's', userId: 'u' },
    } as Session;
    try {
      await listAdminProjects(nonAdmin, createDb(env.DB), {});
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(403);
    }
  });
});

describe('listAdminProjects', () => {
  it('returns paginated projects with org/creator info', async () => {
    await buildAdminUser();
    await buildProject();
    await buildProject();
    await buildProject();

    const result = await listAdminProjects(mockAdminSession(), createDb(env.DB), {
      page: 1,
      limit: 2,
    });
    expect(result.projects.length).toBe(2);
    expect(result.pagination.total).toBe(3);
    expect(result.pagination.totalPages).toBe(2);
    expect(result.projects[0].orgName).toBeDefined();
    expect(result.projects[0].creatorEmail).toBeDefined();
  });

  it('searches projects by name (case-insensitive)', async () => {
    await buildAdminUser();
    const { org, owner } = await buildOrg();
    await buildProject({ org, owner, project: { id: 'p-amphi', name: 'Amphibian Census' } });
    await buildProject({ org, owner, project: { id: 'p-other', name: 'Other Topic' } });

    const result = await listAdminProjects(mockAdminSession(), createDb(env.DB), {
      search: 'amphi',
    });
    expect(result.projects.length).toBe(1);
    expect(result.projects[0].name).toBe('Amphibian Census');
  });

  it('filters by orgId', async () => {
    await buildAdminUser();
    const { org: org1 } = await buildOrg();
    const { org: org2 } = await buildOrg();
    await buildProject({ org: org1 });
    await buildProject({ org: org2 });

    const result = await listAdminProjects(mockAdminSession(), createDb(env.DB), {
      orgId: org1.id,
    });
    expect(result.projects.length).toBe(1);
    expect(result.projects[0].orgId).toBe(org1.id);
  });

  it('includes member and file counts', async () => {
    const admin = await buildAdminUser();
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

    const result = await listAdminProjects(mockAdminSession(), createDb(env.DB), {});
    const found = result.projects.find(p => p.id === project.id)!;
    expect(found.memberCount).toBeGreaterThanOrEqual(1);
    expect(found.fileCount).toBe(1);
  });
});

describe('getAdminProjectDetails', () => {
  it('throws 404 when project not found', async () => {
    try {
      await getAdminProjectDetails(mockAdminSession(), createDb(env.DB), 'nope');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('returns project with members, files, invitations, stats', async () => {
    await buildAdminUser();
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

    const result = await getAdminProjectDetails(mockAdminSession(), createDb(env.DB), project.id);
    expect(result.project.id).toBe(project.id);
    expect(result.stats.memberCount).toBe(result.members.length);
    expect(result.stats.fileCount).toBe(1);
    expect(result.stats.totalStorageBytes).toBe(4096);
  });
});

describe('getAdminProjectDocStats', () => {
  it('throws 404 without waking the DO when project missing in D1', async () => {
    try {
      await getAdminProjectDocStats(mockAdminSession(), createDb(env.DB), 'no-such');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('returns stat shape for an existing empty project', async () => {
    await buildAdminUser();
    const { org, owner } = await buildOrg();
    const { project } = await buildProject({
      org,
      owner,
      project: { id: 'admin-doc-stats-project', name: 'Stats' },
    });

    const result = (await getAdminProjectDocStats(
      mockAdminSession(),
      createDb(env.DB),
      project.id,
    )) as {
      rows: { total: number; totalBytes: number; snapshotBytes: number; updateBytes: number };
      content: { members: number; studies: number; checklists: number; pdfs: number };
      memoryUsagePercent: number;
    };
    expect(typeof result.rows.total).toBe('number');
    expect(result.content.studies).toBe(0);
    expect(result.memoryUsagePercent).toBeLessThan(0.01);
    expect(result.rows.totalBytes).toBe(result.rows.snapshotBytes + result.rows.updateBytes);
  });
});

describe('removeAdminProjectMember', () => {
  it('throws 404 when member not found', async () => {
    try {
      await removeAdminProjectMember(mockAdminSession(), createDb(env.DB), 'p1', 'm1');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('removes a member that belongs to the project', async () => {
    await buildAdminUser();
    const { project, org } = await buildProject();
    const { user: u, membership } = await buildOrgMember({ orgId: org.id });
    const { membership: pm } = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      user: u,
    });

    const result = await removeAdminProjectMember(
      mockAdminSession(),
      createDb(env.DB),
      project.id,
      pm.id,
    );
    expect(result.success).toBe(true);

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

describe('deleteAdminProject', () => {
  it('throws 404 when project missing', async () => {
    try {
      await deleteAdminProject(mockAdminSession(), createDb(env.DB), 'nope');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as Response).status).toBe(404);
    }
  });

  it('deletes existing project', async () => {
    await buildAdminUser();
    const { project } = await buildProject();
    const result = await deleteAdminProject(mockAdminSession(), createDb(env.DB), project.id);
    expect(result.success).toBe(true);

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
