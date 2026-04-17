import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:test';
import { eq } from 'drizzle-orm';
import { createDb } from '@corates/db/client';
import { projectInvitations } from '@corates/db/schema';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import { buildProject, buildProjectInvitation, resetCounter } from '@/__tests__/server/factories';
import { handleGet as listHandler, handlePost as createHandler } from '../invitations';
import { handleDelete as cancelHandler } from '../invitations/$invitationId';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

vi.mock('@corates/workers/auth', () => ({
  getSession: async () => ({
    user: { id: currentUser.id, email: currentUser.email, name: 'Test User' },
    session: { id: 'test-session', userId: currentUser.id },
  }),
}));

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

vi.mock('postmark', () => ({
  Client: class {
    constructor() {}
    sendEmail() {
      return Promise.resolve({ Message: 'mock' });
    }
  },
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('POST /api/orgs/:orgId/projects/:projectId/invitations', () => {
  it('creates a new invitation and returns 201', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'invitee@example.com',
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; email: string };
    expect(body.success).toBe(true);
    expect(body.email).toBe('invitee@example.com');

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

  it('lowercases email when creating invitation', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'UPPERCASE@EXAMPLE.COM',
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(201);

    const db = createDb(env.DB);
    const invitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project.id))
      .get();

    expect(invitation!.email).toBe('uppercase@example.com');
  });

  it('resends existing pending invitation with updated role', async () => {
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

    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'invitee@example.com',
        role: 'owner',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(201);

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

  it('returns error when invitation already accepted', async () => {
    const { project, org, owner } = await buildProject();

    await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'invitee@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'invitee@example.com',
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });

  it('rejects invalid email', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'not-an-email',
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/INVALID_INPUT/);
  });

  it('rejects invalid role', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await createHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'POST', {
        email: 'invitee@example.com',
        role: 'admin',
      }),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/INVALID_INPUT/);
  });
});

describe('GET /api/orgs/:orgId/projects/:projectId/invitations', () => {
  it('lists only pending invitations', async () => {
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

    currentUser = { id: owner.id, email: owner.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/invitations`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ email: string }>;
    expect(body).toHaveLength(1);
    expect(body[0].email).toBe('pending@example.com');
  });
});

describe('DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invitationId', () => {
  it('returns error for nonexistent invitation', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await cancelHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/invitations/nonexistent`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, invitationId: 'nonexistent' },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/FIELD_INVALID_FORMAT/);
  });

  it('returns error when canceling accepted invitation', async () => {
    const { project, org, owner } = await buildProject();

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'accepted@example.com',
      invitedBy: owner.id,
      status: 'accepted',
    });

    currentUser = { id: owner.id, email: owner.email };

    const res = await cancelHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/invitations/${invitation.id}`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, invitationId: invitation.id },
    });

    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/INVITATION_ALREADY_ACCEPTED/);
  });

  it('cancels pending invitation', async () => {
    const { project, org, owner } = await buildProject();

    const invitation = await buildProjectInvitation({
      orgId: org.id,
      projectId: project.id,
      email: 'pending@example.com',
      invitedBy: owner.id,
      status: 'pending',
    });

    currentUser = { id: owner.id, email: owner.email };

    const res = await cancelHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/invitations/${invitation.id}`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, invitationId: invitation.id },
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; cancelled: string };
    expect(body.success).toBe(true);
    expect(body.cancelled).toBe(invitation.id);

    const db = createDb(env.DB);
    const dbInvitation = await db
      .select()
      .from(projectInvitations)
      .where(eq(projectInvitations.id, invitation.id))
      .get();

    expect(dbInvitation).toBeUndefined();
  });
});
