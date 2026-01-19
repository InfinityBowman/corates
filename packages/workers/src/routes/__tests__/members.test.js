/**
 * Integration tests for org-scoped member routes
 * Tests member management operations with real D1 database
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs, json } from '@/__tests__/helpers.js';
import {
  buildProjectWithMembers,
  buildProject,
  buildSelfRemovalScenario,
  buildMultipleOwnersScenario,
  buildUser,
  buildOrgMember,
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
        givenName: 'Test',
        familyName: 'User',
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

// Mock billing resolver to return write access with unlimited quota by default
let mockResolveOrgAccess;
vi.mock('@/lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: vi.fn(),
  };
});

// Mock checkCollaboratorQuota to control quota enforcement in tests
let mockCheckCollaboratorQuota;
vi.mock('@/lib/quotaTransaction.js', () => {
  return {
    checkCollaboratorQuota: vi.fn(),
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
  vi.clearAllMocks();
  resetCounter();

  // Get the mocked functions
  const billingResolver = await import('@/lib/billingResolver.js');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess;

  const quotaTransaction = await import('@/lib/quotaTransaction.js');
  mockCheckCollaboratorQuota = quotaTransaction.checkCollaboratorQuota;

  // Setup default billing resolver mock (unlimited quota)
  mockResolveOrgAccess.mockResolvedValue({
    accessMode: 'full',
    quotas: {
      'projects.max': 10,
      'collaborators.org.max': -1, // -1 means unlimited
    },
    entitlements: {
      'project.create': true,
    },
  });

  // Setup default quota mock (quota allowed)
  mockCheckCollaboratorQuota.mockResolvedValue({
    allowed: true,
    used: 0,
    limit: -1,
  });
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
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });

    const res = await fetchMembers(org.id, project.id, '', {
      headers: { 'x-test-user-id': owner.id },
    });
    expect(res.status).toBe(200);

    const body = await json(res);
    expect(body).toHaveLength(2);
    expect(body[0].userId).toBe(owner.id);
    expect(body[0].role).toBe('owner');
    expect(body[0].name).toBe(owner.name);
    expect(body[1].userId).toBe(members[1].user.id);
    expect(body[1].role).toBe('member');
  });

  it('should order members by join date', async () => {
    const { project, org, owner } = await buildProjectWithMembers({ memberCount: 1 });

    const res = await fetchMembers(org.id, project.id, '', {
      headers: { 'x-test-user-id': owner.id },
    });
    const body = await json(res);

    // joinedAt is returned as Unix timestamp (number or string)
    const joinedAt0 =
      typeof body[0].joinedAt === 'string' ? parseInt(body[0].joinedAt) : body[0].joinedAt;
    const joinedAt1 =
      typeof body[1].joinedAt === 'string' ? parseInt(body[1].joinedAt) : body[1].joinedAt;
    expect(joinedAt0).toBeLessThanOrEqual(joinedAt1);
  });

  it('should require project membership to view members', async () => {
    const { project, org } = await buildProject();

    // Create an org member who is NOT a project member
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    // org member who is not a project member should get 403 ACCESS_DENIED
    const res = await fetchMembers(org.id, project.id, '', {
      headers: { 'x-test-user-id': orgOnlyMember.id },
    });
    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('Org-Scoped Member Routes - POST /api/orgs/:orgId/projects/:projectId/members', () => {
  it('should allow owner to add member by userId', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ userId: newMember.id, role: 'member' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.userId).toBe(newMember.id);
    expect(body.role).toBe('member');
    expect(body.name).toBe(newMember.name);
  });

  it('should allow owner to add member by email', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: newMember.email, role: 'member' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.userId).toBe(newMember.id);
    expect(body.email).toBe(newMember.email);
  });

  it('should normalize email to lowercase', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: newMember.email.toUpperCase(), role: 'member' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.email).toBe(newMember.email);
  });

  it('should create invitation when user not found', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: 'nonexistent@example.com', role: 'member' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.invitation).toBe(true);
  });

  it('should return 409 if user is already a member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const existingMember = members[1].user;

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ userId: existingMember.id, role: 'member' }),
    });

    expect(res.status).toBe(409);
    const body = await json(res);
    expect(body.code).toMatch(/MEMBER_ALREADY_EXISTS/);
  });

  it('should deny non-owner from adding members', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;

    // Create a new org member to try to add
    const { user: newUser } = await buildOrgMember({ orgId: org.id, role: 'member' });

    // Non-owner member tries to add someone
    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': regularMember.id },
      body: JSON.stringify({ userId: newUser.id, role: 'member' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toMatch(/FORBIDDEN/);
  });

  it('should default role to member', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ userId: newMember.id }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.role).toBe('member');
  });
});

describe('Org-Scoped Member Routes - PUT /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('should allow owner to update member role', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToUpdate = members[1].user;

    const res = await fetchMembers(org.id, project.id, `/${memberToUpdate.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ role: 'member' }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.role).toBe('member');

    // Verify update in DB
    const member = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind(project.id, memberToUpdate.id)
      .first();
    expect(member.role).toBe('member');
  });

  it('should prevent removing the last owner', async () => {
    // buildProject creates a project with a single owner
    const { project, org, owner } = await buildProject();

    const res = await fetchMembers(org.id, project.id, `/${owner.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ role: 'member' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('should allow demoting owner if multiple owners exist', async () => {
    // buildMultipleOwnersScenario creates a project with two owners
    const { project, org, owner1, owner2 } = await buildMultipleOwnersScenario();

    const res = await fetchMembers(org.id, project.id, `/${owner1.id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner2.id },
      body: JSON.stringify({ role: 'member' }),
    });

    expect(res.status).toBe(200);
  });
});

describe('Org-Scoped Member Routes - DELETE /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('should allow owner to remove member', async () => {
    // Factory creates: owner user, member user, org, org memberships, project, project memberships
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToRemove = members[1].user;

    const res = await fetchMembers(org.id, project.id, `/${memberToRemove.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.removed).toBe(memberToRemove.id);

    // Verify member was removed
    const member = await env.DB.prepare(
      'SELECT * FROM project_members WHERE projectId = ?1 AND userId = ?2',
    )
      .bind(project.id, memberToRemove.id)
      .first();
    expect(member).toBeNull();
  });

  it('should allow member to remove themselves', async () => {
    const { project, org, selfRemover } = await buildSelfRemovalScenario();

    const res = await fetchMembers(org.id, project.id, `/${selfRemover.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': selfRemover.id },
    });

    expect(res.status).toBe(200);
  });

  it('should prevent removing the last owner', async () => {
    // buildProject creates a project with a single owner
    const { project, org, owner } = await buildProject();

    const res = await fetchMembers(org.id, project.id, `/${owner.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('should return 404 if member not found', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchMembers(org.id, project.id, '/nonexistent-user', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(404);
  });
});

describe('Org-Scoped Member Routes - Collaborator Quota Enforcement', () => {
  it('should reject adding a new org member when at collaborator quota', async () => {
    const { project, org, owner } = await buildProject();
    const newUser = await buildUser();

    // Mock quota exceeded
    const { createDomainError, AUTH_ERRORS } = await import('@corates/shared');
    mockCheckCollaboratorQuota.mockResolvedValueOnce({
      allowed: false,
      used: 1,
      limit: 0,
      error: createDomainError(
        AUTH_ERRORS.FORBIDDEN,
        {
          reason: 'quota_exceeded',
          quotaKey: 'collaborators.org.max',
          used: 1,
          limit: 0,
          requested: 1,
        },
        'Collaborator quota exceeded.',
      ),
    });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ userId: newUser.id, role: 'member' }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('quota_exceeded');
    expect(body.details?.quotaKey).toBe('collaborators.org.max');
  });

  it('should allow adding existing org member without quota check', async () => {
    const { project, org, owner } = await buildProject();

    // Create user who is already an org member but not a project member
    const { user: existingOrgMember } = await buildOrgMember({ orgId: org.id, role: 'member' });

    const res = await fetchMembers(org.id, project.id, '', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ userId: existingOrgMember.id, role: 'member' }),
    });

    // Should succeed because user is already an org member (no quota check needed)
    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.userId).toBe(existingOrgMember.id);
  });
});
