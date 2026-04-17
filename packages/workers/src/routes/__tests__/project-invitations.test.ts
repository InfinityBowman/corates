/**
 * Integration tests for org-scoped project invitation routes
 * Tests invitation create/resend/cancel/accept flows with side-effects mocked
 */

import { beforeAll, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { Hono, type Context } from 'hono';
import { env, createExecutionContext, waitOnExecutionContext } from 'cloudflare:test';
import { resetTestDatabase, clearProjectDOs, json } from '../../__tests__/helpers.js';
import { buildProject, buildProjectInvitation, resetCounter } from '../../__tests__/factories';
import { createDb } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { eq } from 'drizzle-orm';
import { STATIC_ORIGINS } from '../../config/origins';

const TRUSTED_ORIGIN = STATIC_ORIGINS[0];

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
    requireAuth: async (c: Context, next: () => Promise<void>) => {
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
    getAuth: (c: Context) => ({
      user: c.get('user'),
      session: c.get('session'),
    }),
  };
});

// Mock billing resolver to return write access with unlimited quota by default
let mockResolveOrgAccess: Mock;
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

let app: Hono;
let mockUserSessionFetch: Mock;
let mockSyncMemberToDO: Mock;

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
  const billingResolver = await import('../../lib/billingResolver.js');
  mockResolveOrgAccess = billingResolver.resolveOrgAccess as unknown as Mock;

  const projectSync = await import('../../lib/project-sync.js');
  mockSyncMemberToDO = projectSync.syncMemberToDO as unknown as Mock;

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
  mockUserSessionFetch = vi.fn(
    async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
  );

  mockSyncMemberToDO.mockResolvedValue(undefined);
});

interface FetchInit extends RequestInit {
  headers?: Record<string, string>;
}

async function fetchInvitations(orgId: string, projectId: string, path = '', init: FetchInit = {}) {
  const testEnv = {
    ...env,
    APP_URL: TRUSTED_ORIGIN,
    AUTH_BASE_URL: TRUSTED_ORIGIN,
    AUTH_SECRET: 'test-secret',
    SECRET: 'test-secret',
    EMAIL_QUEUE: {
      send: vi.fn(async () => {}),
      sendBatch: vi.fn(async () => {}),
    },
    USER_SESSION: {
      idFromName: (userId: string) => ({ toString: () => `user-session-${userId}` }),
      get: () => ({
        fetch: mockUserSessionFetch,
        notify: mockUserSessionFetch,
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
    expect(invitation!.orgId).toBe(org.id);
    expect(invitation!.projectId).toBe(project.id);
    expect(invitation!.invitedBy).toBe(owner.id);
    expect(invitation!.acceptedAt).toBeNull();
    expect(invitation!.role).toBe('member');
    expect(invitation!.orgRole).toBe('member');
    expect(invitation!.grantOrgMembership).toBe(true);
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

    expect(invitation!.email).toBe('uppercase@example.com');
  });
});

describe('Project Invitation Routes - POST resend/cancel', () => {
  it('should resend existing pending invitation', async () => {
    const { project, org, owner } = await buildProject();
    const token = 'existing-token';

    const invitation = await buildProjectInvitation({
      id: 'inv-1',
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      token,
      invitedBy: owner.id,
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
    expect(invitations[0].id).toBe(invitation.id);
    expect(invitations[0].token).toBe(token);
    expect(invitations[0].role).toBe('owner');
  });

  it('should return error when invitation already accepted', async () => {
    const { project, org, owner } = await buildProject();

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      invitedBy: owner.id,
      status: 'accepted',
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

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      invitedBy: owner.id,
      status: 'pending',
    });

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      invitedBy: owner.id,
      status: 'accepted',
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

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    const res = await fetchInvitations(org.id, project.id, `/${invitation.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });

  it('should cancel pending invitation', async () => {
    const { project, org, owner } = await buildProject();

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      invitedBy: owner.id,
      status: 'pending',
    });

    const res = await fetchInvitations(org.id, project.id, `/${invitation.id}`, {
      method: 'DELETE',
      headers: { 'x-test-user-id': owner.id },
    });

    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.success).toBe(true);
    expect(body.cancelled).toBe(invitation.id);

    // Check invitation was deleted
    const db = createDb(env.DB);
    const dbInvitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, invitation.id))
      .get();

    expect(dbInvitation).toBeUndefined();
  });
});

