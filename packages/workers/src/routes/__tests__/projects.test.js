/**
 * Integration tests for org-scoped project routes
 * Tests project CRUD operations with real D1 database
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs, seedSubscription, json } from '@/__tests__/helpers.js';
import {
  buildProject,
  buildProjectWithMembers,
  buildOrg,
  buildOrgMember,
  buildUser,
  resetCounter,
} from '@/__tests__/factories';

// Mock postmark
vi.mock('postmark', () => {
  return {
    Client: class {
      constructor() {}
      sendEmail() {
        return Promise.resolve({ Message: 'mock' });
      }
    },
  };
});

// Mock auth middleware
vi.mock('@/middleware/auth.js', () => {
  return {
    requireAuth: async (c, next) => {
      const userId = c.req.raw.headers.get('x-test-user-id') || 'user-1';
      const email = c.req.raw.headers.get('x-test-user-email') || 'user1@example.com';
      c.set('user', {
        id: userId,
        email,
        name: 'Test User',
        displayName: 'Test User',
        image: null,
      });
      c.set('session', { id: 'test-session' });
      await next();
    },
    getAuth: c => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

let app;

beforeAll(async () => {
  const { orgProjectRoutes } = await import('../orgs/projects.js');
  app = new Hono();
  app.route('/api/orgs/:orgId/projects', orgProjectRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  // Clear ProjectDoc DOs to prevent invalidation errors between tests
  await clearProjectDOs(['project-1', 'project-2']);
});

async function fetchProjects(orgId, path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost/api/orgs/${orgId}/projects${path}`, {
    ...init,
    headers: {
      'x-test-user-id': 'user-1',
      'x-test-user-email': 'user1@example.com',
      ...init.headers,
    },
  });
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org-Scoped Project Routes - GET /api/orgs/:orgId/projects/:id', () => {
  it('should return project when user is a member of org and project', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchProjects(org.id, `/${project.id}`, {
      headers: { 'x-test-user-id': owner.id },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.id).toBe(project.id);
    expect(body.name).toBe(project.name);
    expect(body.role).toBe('owner');
    expect(body.createdBy).toBe(owner.id);
  });

  it('should return 404 when project not found', async () => {
    const { org, owner } = await buildProject();

    const res = await fetchProjects(org.id, '/nonexistent', {
      headers: { 'x-test-user-id': owner.id },
    });
    expect(res.status).toBe(404);

    const body = await json(res);
    expect(body.code).toMatch(/NOT_FOUND/);
  });

  it('should return 403 when user is not a project member', async () => {
    const { project, org } = await buildProject();
    // Create an org member who is NOT a project member
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchProjects(org.id, `/${project.id}`, {
      headers: { 'x-test-user-id': orgOnlyMember.id },
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('should return 403 when user is not an org member', async () => {
    const { project, org } = await buildProject();
    // Create a user who is not in the org at all
    const nonOrgUser = await buildUser();

    const res = await fetchProjects(org.id, `/${project.id}`, {
      headers: { 'x-test-user-id': nonOrgUser.id },
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
  });
});

describe('Org-Scoped Project Routes - POST /api/orgs/:orgId/projects', () => {
  it('should create a new project with owner membership', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const res = await fetchProjects(org.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ name: 'New Project', description: 'Project description' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.id).toBeDefined();
    expect(body.name).toBe('New Project');
    expect(body.description).toBe('Project description');
    expect(body.role).toBe('owner');

    // Verify project was created in DB with orgId
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(body.id)
      .first();
    expect(project).toBeDefined();
    expect(project.name).toBe('New Project');
    expect(project.orgId).toBe(org.id);

    // Verify membership was created
    const membership = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind(body.id, owner.id)
      .first();
    expect(membership).toBeDefined();
    expect(membership.role).toBe('owner');
  });

  it('should trim name and description', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const res = await fetchProjects(org.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ name: '  Trimmed Project  ', description: '  Trimmed description  ' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('Trimmed Project');
    expect(body.description).toBe('Trimmed description');
  });

  it('should handle null description', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const res = await fetchProjects(org.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ name: 'Project Without Description' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('Project Without Description');
    expect(body.description).toBeNull();
  });

  it('should reject empty name', async () => {
    const { org, owner } = await buildOrg();
    await seedSubscription({
      id: `sub-${org.id}`,
      plan: 'team',
      referenceId: org.id,
      status: 'active',
      createdAt: Math.floor(Date.now() / 1000),
      updatedAt: Math.floor(Date.now() / 1000),
    });

    const res = await fetchProjects(org.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ name: '' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/VALIDATION/);
  });
});

describe('Org-Scoped Project Routes - PUT /api/orgs/:orgId/projects/:id', () => {
  it('should allow owner to update project', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchProjects(org.id, `/${project.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ name: 'Updated Name', description: 'Updated description' }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify update in DB
    const updatedProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(project.id)
      .first();
    expect(updatedProject.name).toBe('Updated Name');
    expect(updatedProject.description).toBe('Updated description');
  });

  it('should allow member to update project', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;

    const res = await fetchProjects(org.id, `/${project.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': regularMember.id },
      body: JSON.stringify({ name: 'Updated by Member' }),
    });

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-project-members in same org', async () => {
    const { project, org } = await buildProject();
    // Create an org member who is NOT a project member
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchProjects(org.id, `/${project.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': orgOnlyMember.id },
      body: JSON.stringify({ name: 'Updated by Non-Member' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org-Scoped Project Routes - DELETE /api/orgs/:orgId/projects/:id', () => {
  it('should allow owner to delete project', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchProjects(org.id, `/${project.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.deleted).toBe(project.id);

    // Verify project was deleted (D1 returns null, not undefined)
    const deletedProject = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(project.id)
      .first();
    expect(deletedProject).toBeNull();

    // Verify members were cascade deleted
    const members = await env.DB.prepare('SELECT * FROM project_members WHERE projectId = ?1')
      .bind(project.id)
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('should deny member from deleting project', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;

    const res = await fetchProjects(org.id, `/${project.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': regularMember.id },
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toMatch(/FORBIDDEN/);
  });
});
