/**
 * Integration tests for org-scoped project invitation routes
 * Tests invitation create/resend/cancel/accept flows with side-effects mocked
 */

import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Hono } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import {
  resetTestDatabase,
  clearProjectDOs,
  seedProjectInvitation,
  json,
} from '@/__tests__/helpers.js';
import {
  buildProject,
  buildProjectWithMembers,
  buildUser,
  resetCounter,
} from '@/__tests__/factories';
import { createDb } from '@/db/client.js';
import { projectInvitations, projectMembers, member } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';

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

// Mock billing resolver to return write access with unlimited quota by default
let mockResolveOrgAccess;
vi.mock('@/lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: vi.fn(),
  };
});

// Mock project sync
vi.mock('@/lib/project-sync.js', () => {
  return {
    syncMemberToDO: vi.fn(),
  };
});

// Note: We don't mock drizzle-orm/d1 because createDb needs it
// The magic link generation code dynamically imports these modules
// We'll need to handle the magic link generation differently
// For now, we'll let it fail silently (it's in a try-catch)

let app;
let mockEmailQueueFetch;
let mockUserSessionFetch;
let mockSyncMemberToDO;

beforeAll(async () => {
  const { orgInvitationRoutes } = await import('../orgs/invitations.js');
  app = new Hono();
  app.route('/api/orgs/:orgId/projects/:projectId/invitations', orgInvitationRoutes);
});

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();

  // Get the mocked functions
  const billingResolver = await import('@/lib/billingResolver.js');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess;

  const projectSync = await import('@/lib/project-sync.js');
  mockSyncMemberToDO = projectSync.syncMemberToDO;

  // Setup default billing resolver mock (unlimited quota)
  mockResolveOrgAccess.mockResolvedValue({
    accessMode: 'write',
    quotas: {
      'projects.max': 10,
      'collaborators.org.max': -1, // -1 means unlimited
    },
    entitlements: {
      'project.create': true,
    },
  });

  // Setup default DO mocks
  mockEmailQueueFetch = vi.fn(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );
  mockUserSessionFetch = vi.fn(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );

  mockSyncMemberToDO.mockResolvedValue(undefined);
});

async function fetchInvitations(orgId, projectId, path = '', init = {}) {
  const testEnv = {
    ...env,
    APP_URL: 'http://localhost:5173',
    AUTH_BASE_URL: 'http://localhost:8787',
    AUTH_SECRET: 'test-secret',
    SECRET: 'test-secret',
    EMAIL_QUEUE: {
      idFromName: () => ({ toString: () => 'default-queue' }),
      get: () => ({
        fetch: mockEmailQueueFetch,
      }),
    },
    USER_SESSION: {
      idFromName: userId => ({ toString: () => `user-session-${userId}` }),
      get: () => ({
        fetch: mockUserSessionFetch,
      }),
    },
  };

  const ctx = createExecutionContext();
  const req = new Request(
    `http://localhost/api/orgs/${orgId}/projects/${projectId}/invitations${path}`,
    {
      ...init,
      headers: {
        'x-test-user-id': 'user-1',
        'x-test-user-email': 'user1@example.com',
        ...init.headers,
      },
    },
  );
  const res = await app.fetch(req, testEnv, ctx);
  await waitOnExecutionContext(ctx);
  return res;
}

describe('Project Invitation Routes - POST /api/orgs/:orgId/projects/:projectId/invitations', () => {
  it('should create new invitation and return 201', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchInvitations(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: 'invitee@example.com', role: 'member' }),
    });

    expect(res.status).toBe(201);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.email).toBe('invitee@example.com');

    // Check invitation was created in DB
    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'invitee@example.com'))
      .get();

    expect(invitation).toBeDefined();
    expect(invitation.orgId).toBe(org.id);
    expect(invitation.projectId).toBe(project.id);
    expect(invitation.invitedBy).toBe(owner.id);
    expect(invitation.acceptedAt).toBeNull();
    expect(invitation.role).toBe('member');
    expect(invitation.orgRole).toBe('member');
    expect(invitation.grantOrgMembership).toBe(true);
  });

  it('should lowercase email when creating invitation', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchInvitations(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: 'UPPERCASE@EXAMPLE.COM', role: 'member' }),
    });

    expect(res.status).toBe(201);

    // Verify email was lowercased in DB
    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project.id))
      .get();

    expect(invitation.email).toBe('uppercase@example.com');
  });
});


describe('Project Invitation Routes - POST resend/cancel', () => {
  it('should resend existing pending invitation', async () => {
    const { project, org, owner } = await buildProject();
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'existing-token';

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: 'invitee@example.com', role: 'owner' }),
    });

    expect(res.status).toBe(201);

    // Check invitation was updated (not created new)
    const db = createDb(env.DB);
    const invitations = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'invitee@example.com'))
      .all();

    expect(invitations).toHaveLength(1);
    expect(invitations[0].id).toBe('inv-1');
    expect(invitations[0].token).toBe(token);
    expect(invitations[0].role).toBe('owner');
  });

  it('should return error when invitation already accepted', async () => {
    const { project, org, owner } = await buildProject();
    const nowSec = Math.floor(Date.now() / 1000);

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ email: 'invitee@example.com', role: 'member' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });
});

describe('Project Invitation Routes - GET /api/orgs/:orgId/projects/:projectId/invitations', () => {
  it('should list only pending invitations', async () => {
    const { project, org, owner } = await buildProject();
    const nowSec = Math.floor(Date.now() / 1000);

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    await seedProjectInvitation({
      id: 'inv-2',
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-2',
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '', {
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe('pending@example.com');
  });
});

describe('Project Invitation Routes - DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId', () => {
  it('should return error for nonexistent invitation', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchInvitations(org.id, project.id, '/nonexistent', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('should return error when canceling accepted invitation', async () => {
    const { project, org, owner } = await buildProject();
    const nowSec = Math.floor(Date.now() / 1000);

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/inv-1', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });

  it('should cancel pending invitation', async () => {
    const { project, org, owner } = await buildProject();
    const nowSec = Math.floor(Date.now() / 1000);

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: owner.id,
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/inv-1', {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.cancelled).toBe('inv-1');

    // Check invitation was deleted
    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, 'inv-1'))
      .get();

    expect(invitation).toBeUndefined();
  });
});

describe('Project Invitation Routes - POST /api/orgs/:orgId/projects/:projectId/invitations/accept', () => {
  it('should accept invitation and add user to org and project', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'accept-token';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': invitee.id,
        'x-test-user-email': invitee.email,
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.orgId).toBe(org.id);
    expect(body.projectId).toBe(project.id);
    expect(body.role).toBe('member');

    // Check org membership was created
    const db = createDb(env.DB);
    const orgMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.userId, invitee.id)))
      .get();

    expect(orgMember).toBeDefined();
    expect(orgMember.role).toBe('member');

    // Check project membership was created
    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, invitee.id)))
      .get();

    expect(projectMember).toBeDefined();
    expect(projectMember.role).toBe('member');

    // Check invitation was marked as accepted
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, 'inv-1'))
      .get();

    expect(invitation.acceptedAt).not.toBeNull();

    // Check syncMemberToDO was called
    expect(mockSyncMemberToDO).toHaveBeenCalledWith(
      expect.any(Object),
      project.id,
      'add',
      expect.objectContaining({
        userId: invitee.id,
        role: 'member',
      }),
    );

    // Check USER_SESSION notification was sent
    expect(mockUserSessionFetch).toHaveBeenCalled();
  });

  it('should return error for invalid token', async () => {
    const { project, org, owner } = await buildProject();

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-test-user-id': owner.id },
      body: JSON.stringify({ token: 'invalid-token' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('should return error for expired invitation', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'expired-token';
    const pastExpiresAt = nowSec - 24 * 60 * 60;

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: pastExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': invitee.id,
        'x-test-user-email': invitee.email,
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
    expect(body.details?.value).toBe('expired');
  });

  it('should return error for email mismatch', async () => {
    const { project, org, owner } = await buildProject();
    const differentUser = await buildUser({ email: 'different@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': differentUser.id,
        'x-test-user-email': differentUser.email,
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('email_mismatch');
  });

  it('should mark invitation as accepted if user is already project member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const existingMember = members[1].user;
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: existingMember.email,
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': existingMember.id,
        'x-test-user-email': existingMember.email,
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.alreadyMember).toBe(true);

    // Check invitation was marked as accepted
    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, 'inv-1'))
      .get();

    expect(invitation.acceptedAt).not.toBeNull();

    // Check only one project member exists (not duplicated)
    const projectMembersList = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, existingMember.id)))
      .all();

    expect(projectMembersList).toHaveLength(1);
  });

  it('should return error when quota exceeded', async () => {
    const { project, org, owner } = await buildProject();
    const invitee = await buildUser({ email: 'invitee@example.com' });
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: invitee.email,
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: owner.id,
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    // Mock quota as 0 (no collaborators allowed)
    mockResolveOrgAccess.mockResolvedValueOnce({
      accessMode: 'write',
      quotas: {
        'collaborators.org.max': 0,
      },
      entitlements: {},
    });

    const res = await fetchInvitations(org.id, project.id, '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': invitee.id,
        'x-test-user-email': invitee.email,
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('quota_exceeded');

    // Check org/project membership was NOT created
    const db = createDb(env.DB);
    const orgMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, org.id), eq(member.userId, invitee.id)))
      .get();

    expect(orgMember).toBeUndefined();

    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, invitee.id)))
      .get();

    expect(projectMember).toBeUndefined();
  });
});
