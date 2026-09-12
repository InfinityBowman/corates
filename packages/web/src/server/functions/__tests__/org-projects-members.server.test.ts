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
  buildProjectInvitation,
  buildSelfRemovalScenario,
  buildOrgMember,
  resetCounter,
  asUserId,
} from '@/__tests__/server/factories';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { INVITATION_LIMITS } from '@corates/workers/constants';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import {
  listProjectMembers,
  addProjectMember,
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

  it('strips invisible characters pasted into the address', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      email: '\u2060pasted@example.com',
      role: 'member',
    })) as { email: string };
    expect(result.email).toBe('pasted@example.com');

    const invitation = await createDb(env.DB)
      .select({ email: projectInvitations.email })
      .from(projectInvitations)
      .where(eq(projectInvitations.projectId, project.id))
      .get();
    expect(invitation?.email).toBe('pasted@example.com');
  });

  it('rejects an address that is not parseable', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    await expect(
      addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        email: 'not-an-address',
        role: 'member',
      }),
    ).rejects.toThrow(DomainErrorException);
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

  it('reports whether the email was queued', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };
    const db = createDb(env.DB);

    const first = (await addProjectMember(mockSession(), db, org.id, project.id, {
      email: 'fresh@example.com',
    })) as { delivery: string };
    expect(first.delivery).toBe('queued');

    const row = await db
      .select({
        emailStatus: projectInvitations.emailStatus,
        sentAt: projectInvitations.emailSentAt,
      })
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'fresh@example.com'))
      .get();
    expect(row?.emailStatus).toBe('queued');
    expect(row?.sentAt).toBeInstanceOf(Date);

    // Re-inviting right away updates the row but does not send another email
    const again = (await addProjectMember(mockSession(), db, org.id, project.id, {
      email: 'fresh@example.com',
      role: 'owner',
    })) as { delivery: string };
    expect(again.delivery).toBe('recently_sent');

    const rows = await db
      .select({ role: projectInvitations.role })
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'fresh@example.com'));
    expect(rows).toEqual([{ role: 'owner' }]);
  });

  it('keeps one row when the same address is invited twice at once', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };
    const db = createDb(env.DB);

    const results = await Promise.all([
      addProjectMember(mockSession(), db, org.id, project.id, { email: 'twice@example.com' }),
      addProjectMember(mockSession(), db, org.id, project.id, { email: 'twice@example.com' }),
    ]);
    expect(results.map(r => (r as { invitation: boolean }).invitation)).toEqual([true, true]);

    const rows = await db
      .select({ id: projectInvitations.id })
      .from(projectInvitations)
      .where(eq(projectInvitations.email, 'twice@example.com'));
    expect(rows).toHaveLength(1);
  });

  it('caps live invitations per project', async () => {
    const { project, org, owner } = await buildProject();
    currentUser = { id: owner.id, email: owner.email };

    for (let i = 0; i < INVITATION_LIMITS.MAX_PENDING_PER_PROJECT; i++) {
      await buildProjectInvitation({ orgId: org.id, projectId: project.id, invitedBy: owner.id });
    }

    await expect(
      addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        email: 'one-too-many@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('caps invitations created per inviter per hour', async () => {
    const { project, org, owner } = await buildProject();
    const other = await buildProject({ owner });
    currentUser = { id: owner.id, email: owner.email };

    // Spread across two projects so the per-project cap is not what trips
    for (let i = 0; i < INVITATION_LIMITS.MAX_CREATED_PER_INVITER_PER_HOUR; i++) {
      await buildProjectInvitation({
        orgId: i % 2 ? org.id : other.org.id,
        projectId: i % 2 ? project.id : other.project.id,
        invitedBy: owner.id,
      });
    }

    await expect(
      addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        email: 'one-too-many@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 429 });
  });

  it('counts live invitations against the collaborator quota', async () => {
    const { project, org, owner } = await buildProject();
    const { user: existing } = await buildOrgMember({ orgId: org.id, role: 'member' });
    currentUser = { id: owner.id, email: owner.email };
    vi.mocked(resolveOrgAccess).mockResolvedValue({
      accessMode: 'write',
      source: 'free',
      quotas: { 'projects.max': 10, 'collaborators.org.max': 2 },
      entitlements: { 'project.create': true },
    } as never);

    await buildProjectInvitation({ orgId: org.id, projectId: project.id, invitedBy: owner.id });

    // One member plus one pending invitation fills a quota of two
    await expect(
      addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
        email: 'third@example.com',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });

    // Someone already in the workspace takes no seat
    const result = (await addProjectMember(mockSession(), createDb(env.DB), org.id, project.id, {
      userId: existing.id,
    })) as { invitation: boolean };
    expect(result.invitation).toBe(true);
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
