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
import {
  listProjectMembers,
  addProjectMember,
  updateProjectMemberRole,
  removeProjectMember,
} from '@/server/functions/org-projects.server';

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

describe('listProjectMembers', () => {
  it('lists all members of a project', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    currentUser = { id: owner.id, email: owner.email };

    const result = await listProjectMembers(mockSession(), createDb(env.DB), org.id, project.id);
    expect(result).toHaveLength(2);
    expect(result[0].userId).toBe(owner.id);
    expect(result[0].role).toBe('owner');
    expect(result[1].userId).toBe(members[1].user.id);
    expect(result[1].role).toBe('member');
  });

  it('returns 403 for org-only member trying to view project members', async () => {
    const { project, org } = await buildProject();
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: orgOnlyMember.id, email: orgOnlyMember.email };

    try {
      await listProjectMembers(mockSession(), createDb(env.DB), org.id, project.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string };
      expect(body.code).toBe('PROJECT_ACCESS_DENIED');
    }
  });
});

describe('addProjectMember', () => {
  it('allows owner to add member by userId', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: newMember.id,
      role: 'member',
    }) as { userId: string; role: string };
    expect(result.userId).toBe(newMember.id);
    expect(result.role).toBe('member');
  });

  it('allows owner to add member by email', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: newMember.email,
      role: 'member',
    }) as { userId: string; email: string };
    expect(result.userId).toBe(newMember.id);
    expect(result.email).toBe(newMember.email);
  });

  it('normalizes email to lowercase', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: newMember.email.toUpperCase(),
      role: 'member',
    }) as { email: string };
    expect(result.email).toBe(newMember.email);
  });

  it('creates invitation when user not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: 'nonexistent@example.com',
      role: 'member',
    }) as { success: boolean; invitation: boolean };
    expect(result.success).toBe(true);
    expect(result.invitation).toBe(true);
  });

  it('returns 409 if user is already a member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const existingMember = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    try {
      await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        userId: existingMember.id,
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(409);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/MEMBER_ALREADY_EXISTS/);
    }
  });

  it('denies non-owner from adding members', async () => {
    const { project, org, members } = await buildProjectWithMembers({ memberCount: 1 });
    const regularMember = members[1].user;
    const { user: newUser } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: regularMember.id, email: regularMember.email };

    try {
      await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        userId: newUser.id,
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/FORBIDDEN/);
    }
  });

  it('defaults role to member', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: newMember.id,
    }) as { role: string };
    expect(result.role).toBe('member');
  });
});

describe('updateProjectMemberRole', () => {
  it('allows owner to update member role', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToUpdate = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    const result = await updateProjectMemberRole(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      memberToUpdate.id,
      { role: 'member' },
    );
    expect(result.success).toBe(true);
    expect(result.role).toBe('member');
  });

  it('prevents removing the last owner', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    try {
      await updateProjectMemberRole(
        mockSession(),
        createDb(env.DB),
        org.id,
        project.id,
        owner.id,
        { role: 'member' },
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/LAST_OWNER/);
    }
  });

  it('allows demoting owner if multiple owners exist', async () => {
    const { project, org, owner1, owner2 } = await buildMultipleOwnersScenario();
    currentUser = { id: owner2.id, email: owner2.email };

    const result = await updateProjectMemberRole(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      owner1.id,
      { role: 'member' },
    );
    expect(result.success).toBe(true);
  });
});

describe('removeProjectMember', () => {
  it('allows owner to remove member', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    const memberToRemove = members[1].user;
    currentUser = { id: owner.id, email: owner.email };

    const result = await removeProjectMember(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      memberToRemove.id,
    );
    expect(result.success).toBe(true);
    expect(result.removed).toBe(memberToRemove.id);
  });

  it('allows member to remove themselves', async () => {
    const { project, org, selfRemover } = await buildSelfRemovalScenario();
    currentUser = { id: selfRemover.id, email: selfRemover.email };

    const result = await removeProjectMember(
      mockSession(),
      createDb(env.DB),
      org.id,
      project.id,
      selfRemover.id,
    );
    expect(result.success).toBe(true);
  });

  it('prevents removing the last owner', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    try {
      await removeProjectMember(mockSession(), createDb(env.DB), org.id, project.id, owner.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(400);
      const body = (await res.json()) as { code: string };
      expect(body.code).toMatch(/LAST_OWNER/);
    }
  });

  it('returns 404 if member not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    try {
      await removeProjectMember(
        mockSession(),
        createDb(env.DB),
        org.id,
        project.id,
        asUserId('nonexistent-user'),
      );
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      expect((err as Response).status).toBe(404);
    }
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

    try {
      await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        userId: newUser.id,
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Response);
      const res = err as Response;
      expect(res.status).toBe(403);
      const body = (await res.json()) as {
        code: string;
        details?: { reason?: string; quotaKey?: string };
      };
      expect(body.code).toBe('AUTH_FORBIDDEN');
      expect(body.details?.reason).toBe('quota_exceeded');
      expect(body.details?.quotaKey).toBe('collaborators.org.max');
    }
  });

  it('allows adding existing org member without quota check', async () => {
    const { project, org, owner } = await buildProject();
    const { user: existingOrgMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: existingOrgMember.id,
      role: 'member',
    }) as { userId: string };
    expect(result.userId).toBe(existingOrgMember.id);
  });
});
