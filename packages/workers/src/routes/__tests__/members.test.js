/**
 * Integration tests for org-scoped member routes
 * Tests member management operations with real D1 database
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
  const { orgProjectMemberRoutes } = await import('../orgs/members.js');
  app = new Hono();
  app.route('/api/orgs/:orgId/projects/:projectId/members', orgProjectMemberRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  // Clear ProjectDoc DOs to prevent invalidation errors between tests
  await clearProjectDOs(['project-1']);
});

async function fetchMembers(orgId, projectId, path = '', init = {}) {
  const ctx = createExecutionContext();
  const req = new Request(
    `http://localhost/api/orgs/${orgId}/projects/${projectId}/members${path}`,
    {
      ...init,
      headers: {
        'x-test-user-id': 'user-1',
        'x-test-user-email': 'user1@example.com',
        ...init.headers,
      },
    },
  );
  const res = await app.fetch(req, env, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Org-Scoped Member Routes - GET /api/orgs/:orgId/projects/:projectId/members', () => {
  it('should list all members of a project', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner User',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Test User 2',
      email: 'collab@example.com',
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
      joinedAt: nowSec + 1,
    });

    const res = await fetchMembers('org-1', 'project-1');
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(2);
    expect(body[0].userId).toBe('user-1');
    expect(body[0].role).toBe('owner');
    expect(body[0].name).toBe('Owner User');
    expect(body[1].userId).toBe('user-2');
    expect(body[1].role).toBe('member');
  });

  it('should order members by join date', async () => {
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
      joinedAt: nowSec + 10,
    });

    const res = await fetchMembers('org-1', 'project-1');
    const body = await json(res);

    // joinedAt is returned as Unix timestamp (number or string)
    const joinedAt0 =
      typeof body[0].joinedAt === 'string' ? parseInt(body[0].joinedAt) : body[0].joinedAt;
    const joinedAt1 =
      typeof body[1].joinedAt === 'string' ? parseInt(body[1].joinedAt) : body[1].joinedAt;
    expect(joinedAt0).toBeLessThanOrEqual(joinedAt1);
  });

  it('should require project membership to view members', async () => {
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

    // user-1 is an org member but NOT a project member
    await seedOrgMember({
      id: 'om-1',
      organizationId: 'org-1',
      userId: 'user-1',
      role: 'member',
      createdAt: nowSec,
    });

    await seedOrgMember({
      id: 'om-2',
      organizationId: 'org-1',
      userId: 'user-2',
      role: 'owner',
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

    await seedProjectMember({
      id: 'pm-1',
      projectId: 'project-1',
      userId: 'user-2',
      role: 'owner',
      joinedAt: nowSec,
    });

    // user-1 is not a project member - should get 403 ACCESS_DENIED
    const res = await fetchMembers('org-1', 'project-1');
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org-Scoped Member Routes - POST /api/orgs/:orgId/projects/:projectId/members', () => {
  it('should allow owner to add member by userId', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'New User',
      email: 'new@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-2',
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.userId).toBe('user-2');
    expect(body.role).toBe('member');
    expect(body.name).toBe('New User');
  });

  it('should allow owner to add member by email', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'New User',
      email: 'new@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'new@example.com',
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.userId).toBe('user-2');
    expect(body.email).toBe('new@example.com');
  });

  it('should normalize email to lowercase', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'New User',
      email: 'new@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'NEW@EXAMPLE.COM',
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.email).toBe('new@example.com');
  });

  it('should create invitation when user not found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'nonexistent@example.com',
        role: 'member',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.invitation).toBe(true);
  });

  it('should return 409 if user is already a member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Existing Member',
      email: 'member@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-2',
        role: 'member',
      }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.code).toMatch(/MEMBER_ALREADY_EXISTS/);
  });

  it('should deny non-owner from adding members', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Test User 2',
      email: 'collab@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-3',
      name: 'New User',
      email: 'new@example.com',
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

    await seedOrgMember({
      id: 'om-3',
      organizationId: 'org-1',
      userId: 'user-3',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
      },
      body: JSON.stringify({
        userId: 'user-3',
        role: 'member',
      }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toMatch(/FORBIDDEN/);
  });

  it('should default role to member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'New User',
      email: 'new@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        userId: 'user-2',
      }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.role).toBe('member');
  });
});

describe('Org-Scoped Member Routes - PUT /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('should allow owner to update member role', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Member',
      email: 'member@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/user-2', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'member',
      }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.role).toBe('member');

    // Verify update in DB
    const member = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind('project-1', 'user-2')
      .first();
    expect(member.role).toBe('member');
  });

  it('should prevent removing the last owner', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/user-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'member',
      }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('should allow demoting owner if multiple owners exist', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner 1',
      email: 'owner1@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Owner 2',
      email: 'owner2@example.com',
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
      role: 'admin',
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
      role: 'owner',
      joinedAt: nowSec,
    });

    const res = await fetchMembers('org-1', 'project-1', '/user-1', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        role: 'member',
      }),
    });

    expect(res.status).toBe(200);
  });
});

describe('Org-Scoped Member Routes - DELETE /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('should allow owner to remove member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Member',
      email: 'member@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/user-2', {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.removed).toBe('user-2');

    // Verify member was removed (D1 returns null, not undefined)
    const member = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind('project-1', 'user-2')
      .first();
    expect(member).toBeNull();
  });

  it('should allow member to remove themselves', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Member',
      email: 'member@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/user-2', {
      method: 'DELETE',
      headers: {
        'x-test-user-id': 'user-2',
      },
    });

    expect(res.status).toBe(200);
  });

  it('should prevent removing the last owner', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/user-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('should return 404 if member not found', async () => {
    const nowSec = Math.floor(Date.now() / 1000);

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
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

    const res = await fetchMembers('org-1', 'project-1', '/nonexistent-user', {
      method: 'DELETE',
    });

    expect(res.status).toBe(404);
  });
});
