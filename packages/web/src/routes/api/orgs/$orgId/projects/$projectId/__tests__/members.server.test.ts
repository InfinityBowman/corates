import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { env } from 'cloudflare:test';
import { createDb } from '@corates/db/client';
import { resetTestDatabase, clearProjectDOs } from '@/__tests__/server/helpers';
import {
  buildProjectWithMembers,
  buildProject,
  buildSelfRemovalScenario,
  buildMultipleOwnersScenario,
  buildUser,
  buildOrgMember,
  resetCounter,
  asUserId,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { handleGet as listHandler, handlePost as addHandler } from '../members';
import { handlePut as updateRoleHandler, handleDelete as removeHandler } from '../members/$userId';

let currentUser: { id: string; email: string } = { id: 'user-1', email: 'user1@example.com' };

function mockSession(overrides?: { userId?: string; email?: string }): Session {
  return {
    user: {
      id: overrides?.userId ?? currentUser.id,
      email: overrides?.email ?? currentUser.email,
      name: 'Test User',
    },
    session: {
      id: 'test-session',
      userId: overrides?.userId ?? currentUser.id,
    },
  } as Session;
}

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 10, 'collaborators.org.max': -1 },
    entitlements: { 'project.create': true },
  })),
}));

let mockCheckCollaboratorQuota: Mock;
vi.mock('@corates/workers/quota-transaction', () => ({
  checkCollaboratorQuota: vi.fn(),
}));

beforeEach(async () => {
  await resetTestDatabase();
  await clearProjectDOs(['project-1']);
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };

  const quotaTransaction = await import('@corates/workers/quota-transaction');
  mockCheckCollaboratorQuota = quotaTransaction.checkCollaboratorQuota as unknown as Mock;
  mockCheckCollaboratorQuota.mockResolvedValue({ allowed: true, used: 0, limit: -1 });
});

function jsonReq(path: string, method: string, body?: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe('GET /api/orgs/:orgId/projects/:projectId/members', () => {
  it('lists all members of a project', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    currentUser = { id: owner.id, email: owner.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<{ userId: string; role: string; name: string }>;
    expect(body).toHaveLength(2);
    expect(body[0].userId).toBe(owner.id);
    expect(body[0].role).toBe('owner');
    expect(body[1].userId).toBe(members[1].user.id);
    expect(body[1].role).toBe('member');
  });

  it('returns 403 for org-only member trying to view project members', async () => {
    const { project, org } = await buildProject();
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: orgOnlyMember.id, email: orgOnlyMember.email };

    const res = await listHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'GET'),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toBe('PROJECT_ACCESS_DENIED');
  });
});

describe('POST /api/orgs/:orgId/projects/:projectId/members', () => {
  it('allows owner to add member by userId', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: newMember.id,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; role: string; name: string };
    expect(body.userId).toBe(newMember.id);
    expect(body.role).toBe('member');
  });

  it('allows owner to add member by email', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        email: newMember.email,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string; email: string };
    expect(body.userId).toBe(newMember.id);
    expect(body.email).toBe(newMember.email);
  });

  it('normalizes email to lowercase', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        email: newMember.email.toUpperCase(),
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { email: string };
    expect(body.email).toBe(newMember.email);
  });

  it('creates invitation when user not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        email: 'nonexistent@example.com',
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { success: boolean; invitation: boolean };
    expect(body.success).toBe(true);
    expect(body.invitation).toBe(true);
  });

  it('returns 409 if user is already a member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const existingMember = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: existingMember.id,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(409);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/MEMBER_ALREADY_EXISTS/);
  });

  it('denies non-owner from adding members', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;
    const { user: newUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: regularMember.id, email: regularMember.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: newUser.id,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/FORBIDDEN/);
  });

  it('defaults role to member', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: newMember.id,
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { role: string };
    expect(body.role).toBe('member');
  });
});

describe('PUT /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('allows owner to update member role', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToUpdate = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    const res = await updateRoleHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/members/${memberToUpdate.id}`,
        'PUT',
        { role: 'member' },
      ),
      params: { orgId: org.id, projectId: project.id, userId: memberToUpdate.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; role: string };
    expect(body.success).toBe(true);
    expect(body.role).toBe('member');
  });

  it('prevents removing the last owner', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await updateRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members/${owner.id}`, 'PUT', {
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id, userId: owner.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('allows demoting owner if multiple owners exist', async () => {
    const { project, org, owner1, owner2 } = await buildMultipleOwnersScenario();
    currentUser = { id: owner2.id, email: owner2.email };

    const res = await updateRoleHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members/${owner1.id}`, 'PUT', {
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id, userId: owner1.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
  });
});

describe('DELETE /api/orgs/:orgId/projects/:projectId/members/:userId', () => {
  it('allows owner to remove member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToRemove = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    const res = await removeHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/members/${memberToRemove.id}`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, userId: memberToRemove.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; removed: string };
    expect(body.success).toBe(true);
    expect(body.removed).toBe(memberToRemove.id);
  });

  it('allows member to remove themselves', async () => {
    const { project, org, selfRemover } = await buildSelfRemovalScenario();
    currentUser = { id: selfRemover.id, email: selfRemover.email };

    const res = await removeHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/members/${selfRemover.id}`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, userId: selfRemover.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(200);
  });

  it('prevents removing the last owner', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await removeHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members/${owner.id}`, 'DELETE'),
      params: { orgId: org.id, projectId: project.id, userId: owner.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { code: string };
    expect(body.code).toMatch(/LAST_OWNER/);
  });

  it('returns 404 if member not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const res = await removeHandler({
      request: jsonReq(
        `/api/orgs/${org.id}/projects/${project.id}/members/nonexistent-user`,
        'DELETE',
      ),
      params: { orgId: org.id, projectId: project.id, userId: asUserId('nonexistent-user') },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(404);
  });
});

describe('Collaborator Quota Enforcement', () => {
  it('rejects adding a new org member when at collaborator quota', async () => {
    const { project, org, owner } = await buildProject();
    const newUser = await buildUser();
    currentUser = { id: owner.id, email: owner.email };

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

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: newUser.id,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(403);
    const body = (await res.json()) as {
      code: string;
      details?: { reason?: string; quotaKey?: string };
    };
    expect(body.code).toBe('AUTH_FORBIDDEN');
    expect(body.details?.reason).toBe('quota_exceeded');
    expect(body.details?.quotaKey).toBe('collaborators.org.max');
  });

  it('allows adding existing org member without quota check', async () => {
    const { project, org, owner } = await buildProject();
    const { user: existingOrgMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const res = await addHandler({
      request: jsonReq(`/api/orgs/${org.id}/projects/${project.id}/members`, 'POST', {
        userId: existingOrgMember.id,
        role: 'member',
      }),
      params: { orgId: org.id, projectId: project.id },
      context: { db: createDb(env.DB), session: mockSession() },
    });
    expect(res.status).toBe(201);
    const body = (await res.json()) as { userId: string };
    expect(body.userId).toBe(existingOrgMember.id);
  });
});
