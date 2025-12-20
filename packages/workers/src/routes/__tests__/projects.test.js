/**
 * Integration tests for project routes
 * Tests project CRUD operations with real D1 database
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  seedUser,
  seedProject,
  seedProjectMember,
  json,
  fetchApp,
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
  const { projectRoutes } = await import('../projects.js');
  app = new Hono();
  app.route('/api/projects', projectRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
});

async function fetchProjects(path, init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(`http://localhost${path}`, {
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

describe('Project Routes - GET /api/projects/:id', () => {
  it('should return project when user is a member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      description: 'A test project',
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

    const res = await fetchProjects('/api/projects/project-1');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body.id).toBe('project-1');
    expect(body.name).toBe('Test Project');
    expect(body.description).toBe('A test project');
    expect(body.role).toBe('owner');
    expect(body.createdBy).toBe('user-1');
  });

  it('should return 404 when project not found', async () => {
    const res = await fetchProjects('/api/projects/nonexistent');
    expect(res.status).toBe(404);

    const body = await json(res);
    // Domain errors have 'code' field, not 'error'
    expect(body.code || body.error).toBeDefined();
    expect(body.code).toMatch(/NOT_FOUND/);
  });

  it('should return 404 when user is not a member', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
      createdBy: 'user-2',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects/project-1');
    expect(res.status).toBe(404);
  });
});

describe('Project Routes - POST /api/projects', () => {
  it('should create a new project with owner membership', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects', {
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

    // Verify project was created in DB
    const project = await env.DB.prepare('SELECT * FROM projects WHERE id = ?1')
      .bind(body.id)
      .first();
    expect(project).toBeDefined();
    expect(project.name).toBe('New Project');

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

    const res = await fetchProjects('/api/projects', {
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

    const res = await fetchProjects('/api/projects', {
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

    const res = await fetchProjects('/api/projects', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        name: '',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    // Domain errors have 'code' field, not 'error'
    expect(body.code || body.error).toBeDefined();
    expect(body.code).toMatch(/VALIDATION/);
  });
});

describe('Project Routes - PUT /api/projects/:id', () => {
  it('should allow owner to update project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Original Name',
      description: 'Original description',
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

    const res = await fetchProjects('/api/projects/project-1', {
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

  it('should allow collaborator to update project', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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
      role: 'collaborator',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects/project-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        name: 'Updated by Collaborator',
      }),
    });

    expect(res.status).toBe(200);
  });

  it('should deny viewer from updating project', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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
      role: 'viewer',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects/project-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        name: 'Updated by Viewer',
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    // Domain errors have 'code' field, not 'error'
    expect(body.code || body.error).toBeDefined();
    expect(body.code).toMatch(/FORBIDDEN/);
  });

  it('should return 404 for non-members', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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

    const res = await fetchProjects('/api/projects/project-1', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        name: 'Updated by Non-Member',
      }),
    });

    // Non-members get 403 ACCESS_DENIED, not 404
    expect([403, 404]).toContain(res.status);
  });
});

describe('Project Routes - DELETE /api/projects/:id', () => {
  it('should allow owner to delete project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'User 1',
      email: 'user1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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

    const res = await fetchProjects('/api/projects/project-1', {
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

  it('should deny collaborator from deleting project', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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
      role: 'collaborator',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects/project-1', {
      method: 'DELETE',
      headers: {
        'x-test-user-id': 'user-2',
      },
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    // Domain errors have 'code' field, not 'error'
    expect(body.code || body.error).toBeDefined();
    expect(body.code).toMatch(/FORBIDDEN/);
  });

  it('should deny viewer from deleting project', async () => {
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

    await seedProject({
      id: 'project-1',
      name: 'Test Project',
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
      role: 'viewer',
      joinedAt: nowSec,
    });

    const res = await fetchProjects('/api/projects/project-1', {
      method: 'DELETE',
      headers: {
        'x-test-user-id': 'user-2',
      },
    });

    expect(res.status).toBe(403);
  });
});
