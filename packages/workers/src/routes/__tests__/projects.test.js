/**
 * Integration tests for org-scoped project routes
 * Tests project CRUD operations with real D1 database
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  seedUser,
  seedProject,
  seedProjectMember,
  seedSubscription,
  seedOrganization,
  seedOrgMember,
  json,
} from '../../__tests__/helpers.js';

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
vi.mock('../../middleware/auth.js', () => {
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
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      description: 'A test project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.id).toBe('project-1');
    expect(body.name).toBe('Test Project');
    expect(body.description).toBe('A test project');
    expect(body.role).toBe('owner');
    expect(body.createdBy).toBe('user-1');
  });

  it('should return 404 when project not found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/nonexistent');
    expect(res.status).toBe(404);

    const body = await json(res);
    expect(body.code).toMatch(/NOT_FOUND/);
  });

  it('should return 403 when user is not a project member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // user-1 is an org member
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    // user-2 is the project owner, user-1 is NOT a project member
    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1');
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });

  it('should return 403 when user is not an org member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // user-1 is NOT an org member

    const res = await fetchProjects('org-1', '/project-1');
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
  });
});

describe('Org-Scoped Project Routes - POST /api/orgs/:orgId/projects', () => {
  it('should create a new project with owner membership', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'New Project',
        description: 'Project description',
      }),
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
    expect(project.orgId).toBe('org-1');

    // Verify membership was created
    const membership = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind(body.id, 'user-1')
      .first();
    expect(membership).toBeDefined();
    expect(membership.role).toBe('owner');
  });

  it('should trim name and description', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '  Trimmed Project  ',
        description: '  Trimmed description  ',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('Trimmed Project');
    expect(body.description).toBe('Trimmed description');
  });

  it('should handle null description', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Project Without Description',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.name).toBe('Project Without Description');
    expect(body.description).toBeNull();
  });

  it('should reject empty name', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedSubscription({
      id: 'sub-1',
      userId: 'user-1',
      tier: 'pro',
      status: 'active',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/VALIDATION/);
  });
});

describe('Org-Scoped Project Routes - PUT /api/orgs/:orgId/projects/:id', () => {
  it('should allow owner to update project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Original Name',
      description: 'Original description',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: 'Updated Name',
        description: 'Updated description',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);

    // Verify update in DB
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind('project-1')
      .first();
    expect(project.name).toBe('Updated Name');
    expect(project.description).toBe('Updated description');
  });

  it('should allow member to update project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-2',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'member',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-2',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'member',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        name: 'Updated by Member',
      }),
    });

    expect(res.status).toBe(200);
  });

  it('should return 403 for non-project-members in same org', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    // user-2 is an org member but not a project member
    await seedOrgMember({
      id: 'om-2',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'member',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        name: 'Updated by Non-Member',
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org-Scoped Project Routes - DELETE /api/orgs/:orgId/projects/:id', () => {
  it('should allow owner to delete project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.deleted).toBe('project-1');

    // Verify project was deleted (D1 returns null, not undefined)
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind('project-1')
      .first();
    expect(project).toBeNull();

    // Verify members were cascade deleted
    const members = await env.DB.prepare('SELECT * FROM project_members WHERE projectId = ?1')
      .bind('project-1')
      .all();
    expect(members.results).toHaveLength(0);
  });

  it('should deny member from deleting project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'User 2',
      email: 'user2@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'owner',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-2',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'member',
      createdAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      orgId: 'org-1',
      createdBy: 'user-1',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-1',
      role: 'owner',
      joinedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-2',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'member',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('org-1', '/project-1', {
      method: 'DELETE',
      headers: {
        'x-test-user-id': 'user-2',
      },
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toMatch(/FORBIDDEN/);
  });
});
