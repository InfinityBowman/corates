// Boots the test worker at import so the DO bindings are up before the per-test timeout starts.
import 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { projectMembers, projectInvitations } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildProjectWithMembers,
  buildProject,
  buildSelfRemovalScenario,
  buildMultipleOwnersScenario,
  buildOrgMember,
  resetCounter,
  asUserId,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
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

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
  currentUser = { id: 'user-1', email: 'user1@example.com' };
});

describe('listProjectMembers', () => {
  it('lists all members of a project', async () => {
    const { project, org, owner, members } = await buildProjectWithMembers({ memberCount: 1 });
    currentUser = { id: owner.id, email: owner.email };

    const result = await listProjectMembers(mockSession(), createDb(env.DB), org.id, project.id);
    expect(result).toHaveLength(2);
    // Both members join within the same second, so assert by identity
    // rather than position.
    const ownerRow = result.find(m => m.userId === owner.id);
    const memberRow = result.find(m => m.userId === members[1].user.id);
    expect(ownerRow?.role).toBe('owner');
    expect(memberRow?.role).toBe('member');
  });

  it('returns 403 for org-only member trying to view project members', async () => {
    const { project, org } = await buildProject();
    const { user: orgOnlyMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: orgOnlyMember.id, email: orgOnlyMember.email };

    try {
      await listProjectMembers(mockSession(), createDb(env.DB), org.id, project.id);
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(403);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toBe('PROJECT_ACCESS_DENIED');
    }
  });
});

describe('addProjectMember', () => {
  it('creates an invitation for an existing user added by userId', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: newMember.id,
      role: 'member',
    })) as { success: boolean; invitation: boolean; email: string };
    expect(result.success).toBe(true);
    expect(result.invitation).toBe(true);
    expect(result.email).toBe(newMember.email);

    // No membership until the invitation is accepted
    const memberRow = await createDb(env.DB)
      .select({ id: projectMembers.id })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, newMember.id)))
      .get();
    expect(memberRow).toBeUndefined();
  });

  it('creates an invitation for an existing user added by email', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: newMember.email,
      role: 'member',
    })) as { invitation: boolean; email: string };
    expect(result.invitation).toBe(true);
    expect(result.email).toBe(newMember.email);
  });

  it('normalizes email to lowercase', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: newMember.email.toUpperCase(),
      role: 'member',
    })) as { email: string };
    expect(result.email).toBe(newMember.email);
  });

  it('creates invitation when user not found', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: 'nonexistent@example.com',
      role: 'member',
    })) as { success: boolean; invitation: boolean };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(409);
      const body = res.toDomainError() as { code: string };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(403);
      const body = res.toDomainError() as { code: string };
      expect(body.code).toMatch(/FORBIDDEN/);
    }
  });

  it('defaults invitation role to member', async () => {
    const { project, org, owner } = await buildProject();
    const { user: newMember } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };

    await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: newMember.id,
    });

    const invitationRow = await createDb(env.DB)
      .select({ role: projectInvitations.role })
      .from(projectInvitations)
      .where(
        and(
          eq(projectInvitations.projectId, project.id),
          eq(projectInvitations.email, newMember.email),
        ),
      )
      .get();
    expect(invitationRow?.role).toBe('member');
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
      await updateProjectMemberRole(mockSession(), createDb(env.DB), org.id, project.id, owner.id, {
        role: 'member',
      });
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      const res = err as DomainErrorException;
      expect(res.statusCode).toBe(400);
      const body = res.toDomainError() as { code: string };
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
      expect(err).toBeInstanceOf(DomainErrorException);
      expect((err as DomainErrorException).statusCode).toBe(404);
    }
  });
});

// Collaborator quota is enforced when an invitation is accepted (membership
// creation), covered in invitations.server.test.ts. Sending an invitation is
// not quota-checked.
