import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs, seedSubscription } from '@/__tests__/server/helpers';
import {
  buildProject,
  buildProjectWithMembers,
  buildProjectMember,
  buildOrg,
  buildOrgMember,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import { createDb } from '@corates/db/client';
import { projects as projectsTable } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { createGrant } from '@corates/db/org-access-grants';
import { session } from '@corates/db/schema';
import { handleGet as listHandler, handlePost as createHandler } from '../../projects';
import {
  handleGet as getHandler,
  handlePut as updateHandler,
  handleDelete as deleteHandler,
} from '../$projectId';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1', 'project-2']);
  vi.clearAllMocks();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/orgs/:orgId/projects/:id', () => {
  it('returns project when user is a member of org and project', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
    });
    expect(res.status).toBe(200);

    const body = (await res.json()) as { id: string; name: string; role: string; createdBy: string };
    expect(body.id).toBe(project.id);
    expect(body.name).toBe(project.name);
    expect(body.role).toBe('owner');
    expect(body.createdBy).toBe(owner.id);
  });

  it('returns 404 when project not found', async () => {
    const { org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/nonexistent`, 'GET'),
      params: { orgId: org.id, projectId: 'nonexistent' },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/NOT_FOUND/);
  });

  it('returns 403 when user is not a project member (but is in org)', async () => {
    const { project, org } = await buildProject();
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: orgOnlyMember.id, email: orgOnlyMember.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('returns 401 when user is not authenticated (not in org/project)', async () => {
    // Note: with the guard pattern, missing org membership falls through to project-access-check
    // which does a project lookup then org-match check. A user not in org gets 403 PROJECT_NOT_IN_ORG
    // or ACCESS_DENIED depending on path.
    const { project, org } = await buildProject();
    const nonOrgUser = await buildUser();
    currentUser = { id: nonOrgUser.id, email: nonOrgUser.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
    });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/orgs/:orgId/projects', () => {
  it('creates a new project with owner membership', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'POST', {
        name: 'New Project',
        description: 'Project description',
      }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      id: string;
      name: string;
      description: string;
      role: string;
    };
    expect(body.id).toBeDefined();
    expect(body.name).toBe('New Project');
    expect(body.description).toBe('Project description');
    expect(body.role).toBe('owner');

    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(body.id)
      .first<{ name: string; orgId: string }>();
    expect(project).toBeDefined();
    expect(project!.name).toBe('New Project');
    expect(project!.orgId).toBe(org.id);

    const membership = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind(body.id, owner.id)
      .first<{ role: string }>();
    expect(membership).toBeDefined();
    expect(membership!.role).toBe('owner');
  });

  it('trims name and description', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'POST', {
        name: '  Trimmed Project  ',
        description: '  Trimmed description  ',
      }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { id: string; name: string; description: string };
    expect(body.name).toBe('Trimmed Project');
    expect(body.description).toBe('Trimmed description');

    const db = createDb(env.DB);
    const [dbProject] = await db.select().from(projectsTable).where(eq(projectsTable.id, body.id));
    expect(dbProject.name).toBe('Trimmed Project');
    expect(dbProject.description).toBe('Trimmed description');
  });

  it('handles null description', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'POST', {
        name: 'Project Without Description',
      }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { name: string; description: string | null };
    expect(body.name).toBe('Project Without Description');
    expect(body.description).toBeNull();
  });

  it('rejects empty name', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'POST', { name: '' }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/VALIDATION/);
  });
});

describe('PUT /api/orgs/:orgId/projects/:id', () => {
  it('allows owner to update project', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await updateHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'PUT', {
        name: 'Updated Name',
        description: 'Updated description',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean };
    expect(body.success).toBe(true);

    const updatedProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(project.id)
      .first<{ name: string; description: string }>();
    expect(updatedProject!.name).toBe('Updated Name');
    expect(updatedProject!.description).toBe('Updated description');
  });

  it('allows member to update project', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;
    currentUser = { id: regularMember.id, email: regularMember.email };

    const res = await updateHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'PUT', {
        name: 'Updated by Member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(200);

    const db = createDb(env.DB);
    const [dbProject] = await db
      .select()
      .from(projectsTable)
      .where(eq(projectsTable.id, project.id));
    expect(dbProject.name).toBe('Updated by Member');
  });

  it('returns 403 for non-project-members in same org', async () => {
    const { project, org } = await buildProject();
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: orgOnlyMember.id, email: orgOnlyMember.email };

    const res = await updateHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'PUT', {
        name: 'Updated by Non-Member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('DELETE /api/orgs/:orgId/projects/:id', () => {
  it('allows owner to delete project', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await deleteHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'DELETE'),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; deleted: string };
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(project.id);

    const deletedProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(project.id)
      .first();
    expect(deletedProject).toBeNull();

    const members = await env.DB.prepare('SELECT * FROM project_members WHERE projectId = ?1')
      .bind(project.id)
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('denies member from deleting project', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;
    currentUser = { id: regularMember.id, email: regularMember.email };

    const res = await deleteHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'DELETE'),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/FORBIDDEN/);
  });
});

describe('Org authorization edge cases', () => {
  it('denies access when user has project membership but no org membership', async () => {
    const { org, owner } = await buildOrg();
    const formerMember = await buildUser();
    const { project } = await buildProject({ org, owner });
    await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      user: formerMember,
      role: 'owner',
      skipOrgMembership: true,
    });
    currentUser = { id: formerMember.id, email: formerMember.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('not_org_member');
  });

  it('returns PROJECT_NOT_IN_ORG when projectId belongs to different org', async () => {
    const user = await buildUser();
    const { org: orgA } = await buildOrg({ owner: user });
    const { project: projectInOrgA } = await buildProject({ org: orgA, owner: user });
    const { org: orgB } = await buildOrg({ owner: user });
    currentUser = { id: user.id, email: user.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${orgB.id}/projects/${projectInOrgA.id}`, 'GET'),
      params: { orgId: orgB.id, projectId: projectInOrgA.id },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      code: string;
      details?: { projectId?: string; requestedOrgId?: string; actualOrgId?: string };
    };
    expect(body.code).toBe('PROJECT_NOT_IN_ORG');
    expect(body.details?.projectId).toBe(projectInOrgA.id);
    expect(body.details?.requestedOrgId).toBe(orgB.id);
    expect(body.details?.actualOrgId).toBe(orgA.id);
  });

  it('returns PROJECT_NOT_FOUND when project does not exist', async () => {
    const { org, owner } = await buildOrg();
    currentUser = { id: owner.id, email: owner.email };

    const res = await getHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/nonexistent-project`, 'GET'),
      params: { orgId: org.id, projectId: 'nonexistent-project' },
    });
    expect(res.status).toBe(404);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('Read-only access enforcement', () => {
  async function createReadOnlyOrg() {
    const { org, owner } = await buildOrg();

    const db = createDb(env.DB);
    const expiredDate = new Date();
    expiredDate.setMonth(expiredDate.getMonth() - 1);

    await createGrant(db, {
      id: 'grant-expired',
      orgId: org.id,
      type: 'single_project',
      startsAt: new Date(expiredDate.getTime() - 6 * 30 * 24 * 60 * 60 * 1000),
      expiresAt: expiredDate,
    });

    await db.insert(session).values({
      id: 'test-session',
      userId: owner.id,
      token: 'test-token',
      expiresAt: new Date(Date.now() + 86400 * 1000),
      activeOrganizationId: org.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return { org, owner };
  }

  it('blocks project creation for read-only org', async () => {
    const { org, owner } = await createReadOnlyOrg();
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'POST', {
        name: 'Test Project',
        description: 'Test Description',
      }),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string; details?: { reason?: string } };
    expect(body.code).toMatch(/AUTH_FORBIDDEN/);
    expect(body.details?.reason).toBe('read_only_access');
  });

  it('allows GET requests for read-only org', async () => {
    const { org, owner } = await createReadOnlyOrg();
    currentUser = { id: owner.id, email: owner.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'GET'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
  });
});

describe('GET /api/orgs/:orgId/projects (list)', () => {
  it('lists projects for user in org', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'GET'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ id: string; role: string }>;
    expect(body.find(p => p.id === project.id)?.role).toBe('owner');
  });

  it('returns 403 when not org member', async () => {
    const { org } = await buildOrg();
    const outsider = await buildUser();
    currentUser = { id: outsider.id, email: outsider.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects`, 'GET'),
      params: { orgId: org.id },
    });

    expect(res.status).toBe(403);
  });
});
