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
  seedUser,
  seedProject,
  seedProjectMember,
  seedOrganization,
  seedOrgMember,
  seedProjectInvitation,
  json,
} from '../../__tests__/helpers.js';
import { createDb } from '../../db/client.js';
import { projectInvitations, projectMembers, member } from '../../db/schema.js';
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

// Mock billing resolver to return write access with unlimited quota by default
let mockResolveOrgAccess;
vi.mock('../../lib/billingResolver.js', () => {
  return {
    resolveOrgAccess: vi.fn(),
  };
});

// Mock project sync
vi.mock('../../lib/project-sync.js', () => {
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
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();

  // Get the mocked functions
  const billingResolver = await import('../../lib/billingResolver.js');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess;

  const projectSync = await import('../../lib/project-sync.js');
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    const res = await fetchInvitations('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    expect(invitation.orgId).toBe('org-1');
    expect(invitation.projectId).toBe('project-1');
    expect(invitation.invitedBy).toBe('user-1');
    expect(invitation.acceptedAt).toBeNull();
    expect(invitation.role).toBe('member');
    expect(invitation.orgRole).toBe('member');
    expect(invitation.grantOrgMembership).toBe(true);

    // Note: Email queueing happens inside a try-catch that swallows errors
    // The magic link generation code uses dynamic imports that may fail in test env
    // For now, we just verify the invitation was created successfully
  });

  it('should lowercase email when creating invitation', async () => {
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    const res = await fetchInvitations('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'INVITEE@EXAMPLE.COM', role: 'member' }),
    });

    expect(res.status).toBe(201);

    // Check invitation email was lowercased
    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'invitee@example.com'))
      .get();

    expect(invitation).toBeDefined();
  });

  it('should resend existing pending invitation', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'existing-token';

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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'invitee@example.com', role: 'member' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });
});

describe('Project Invitation Routes - GET /api/orgs/:orgId/projects/:projectId/invitations', () => {
  it('should list only pending invitations', async () => {
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'pending@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    await seedProjectInvitation({
      id: 'inv-2',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'accepted@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-2',
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1');

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe('pending@example.com');
  });
});

describe('Project Invitation Routes - DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId', () => {
  it('should return error for nonexistent invitation', async () => {
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    const res = await fetchInvitations('org-1', 'project-1', '/nonexistent', {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('should return error when canceling accepted invitation', async () => {
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'accepted@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: nowSec,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/inv-1', {
      method: 'DELETE',
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });

  it('should cancel pending invitation', async () => {
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'pending@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token: 'token-1',
      invitedBy: 'user-1',
      expiresAt: nowSec + 7 * 24 * 60 * 60,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/inv-1', {
      method: 'DELETE',
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
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'accept-token';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedUser({
      id: 'user-1',
      name: 'Inviter',
      email: 'inviter@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Invitee',
      email: 'invitee@example.com',
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
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
        'x-test-user-email': 'invitee@example.com',
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.orgId).toBe('org-1');
    expect(body.projectId).toBe('project-1');
    expect(body.role).toBe('member');

    // Check org membership was created
    const db = createDb(env.DB);
    const orgMember = await db
      .select()
      .from(member)
      .where(and(eq(member.organizationId, 'org-1'), eq(member.userId, 'user-2')))
      .get();

    expect(orgMember).toBeDefined();
    expect(orgMember.role).toBe('member');

    // Check project membership was created
    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, 'project-1'), eq(projectMembers.userId, 'user-2')))
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
      'project-1',
      'add',
      expect.objectContaining({
        userId: 'user-2',
        role: 'member',
      }),
    );

    // Check USER_SESSION notification was sent
    expect(mockUserSessionFetch).toHaveBeenCalled();
  });

  it('should return error for invalid token', async () => {
    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token: 'invalid-token' }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('should return error for expired invitation', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'expired-token';
    const pastExpiresAt = nowSec - 24 * 60 * 60;

    await seedUser({
      id: 'user-1',
      name: 'Inviter',
      email: 'inviter@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Invitee',
      email: 'invitee@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
      expiresAt: pastExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
        'x-test-user-email': 'invitee@example.com',
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
    expect(body.details?.value).toBe('expired');
  });

  it('should return error for email mismatch', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedUser({
      id: 'user-1',
      name: 'Inviter',
      email: 'inviter@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Different User',
      email: 'different@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
        'x-test-user-email': 'different@example.com',
      },
      body: JSON.stringify({ token }),
    });

    expect(res.status).toBe(403);
    const body = await json(res);
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('email_mismatch');
  });

  it('should mark invitation as accepted if user is already project member', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedUser({
      id: 'user-1',
      name: 'Inviter',
      email: 'inviter@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Invitee',
      email: 'invitee@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
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
      userId: 'user-2',
      role: 'member',
      joinedAt: nowSec,
    });

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
      expiresAt: futureExpiresAt,
      acceptedAt: null,
      createdAt: nowSec,
    });

    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
        'x-test-user-email': 'invitee@example.com',
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
      .where(and(eq(projectMembers.projectId, 'project-1'), eq(projectMembers.userId, 'user-2')))
      .all();

    expect(projectMembersList).toHaveLength(1);
  });

  it('should return error when quota exceeded', async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const token = 'token-1';
    const futureExpiresAt = nowSec + 7 * 24 * 60 * 60;

    await seedUser({
      id: 'user-1',
      name: 'Owner',
      email: 'owner@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedUser({
      id: 'user-2',
      name: 'Invitee',
      email: 'invitee@example.com',
      createdAt: nowSec,
      updatedAt: nowSec,
    });

    await seedOrganization({
      id: 'org-1',
      name: 'Test Org',
      slug: 'test-org',
      createdAt: nowSec,
    });

    // Owner counts as a collaborator
    await seedOrgMember({
      id: 'member-1',
      userId: 'user-1',
      organizationId: 'org-1',
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

    await seedProjectInvitation({
      id: 'inv-1',
      orgId: 'org-1',
      projectId: 'project-1',
      email: 'invitee@example.com',
      role: 'member',
      orgRole: 'member',
      grantOrgMembership: 1,
      token,
      invitedBy: 'user-1',
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

    const res = await fetchInvitations('org-1', 'project-1', '/accept', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-test-user-id': 'user-2',
        'x-test-user-email': 'invitee@example.com',
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
      .where(and(eq(member.organizationId, 'org-1'), eq(member.userId, 'user-2')))
      .get();

    expect(orgMember).toBeUndefined();

    const projectMember = await db
      .select()
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, 'project-1'), eq(projectMembers.userId, 'user-2')))
      .get();

    expect(projectMember).toBeUndefined();
  });
});
