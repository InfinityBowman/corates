// Boots the test worker at import so the DO bindings are up before the per-test timeout starts.
import 'cloudflare:test';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { env } from 'cloudflare:workers';
import { createDb } from '@corates/db/client';
import { member, organization, projectInvitations, projectMembers } from '@corates/db/schema';
import { and, eq } from 'drizzle-orm';
import { resetTestDatabase } from '@/__tests__/server/helpers';
import {
  buildOrg,
  buildOrgMember,
  buildProject,
  buildProjectInvitation,
  buildProjectMember,
  buildUser,
  resetCounter,
} from '@/__tests__/server/factories';
import type { Session } from '@/server/middleware/auth';
import { DomainErrorException } from '@corates/shared';
import {
  listMyWorkspaces,
  createWorkspaceForUser,
  updateWorkspaceSettings,
  checkWorkspaceSlug,
  getWorkspaceMembers,
  removeWorkspaceMember,
  countCollaboratorSeats,
} from '@/server/functions/workspaces.server';

vi.mock('@corates/workers/billing-resolver', () => ({
  resolveOrgAccess: vi.fn(async () => ({
    accessMode: 'write',
    source: 'free',
    quotas: { 'projects.max': 1, 'collaborators.org.max': 3 },
    entitlements: { 'project.create': true },
  })),
}));

function sessionFor(user: { id: string; email: string; name?: string }): Session {
  return {
    user: { id: user.id, email: user.email, name: user.name ?? 'Test User' },
    session: { id: `sess-${user.id}`, userId: user.id },
  } as Session;
}

async function expectDomainError(promise: Promise<unknown>, reason: string) {
  try {
    await promise;
    expect.unreachable('should have thrown');
  } catch (err) {
    const body = (err as DomainErrorException).toDomainError() as {
      details?: { reason?: string };
    };
    expect(body.details?.reason).toBe(reason);
  }
}

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  resetCounter();
});

describe('listMyWorkspaces', () => {
  it('lists the workspaces the user owns first', async () => {
    const user = await buildUser();
    const { org: other } = await buildOrg({ org: { name: 'Aardvark Lab' } });
    await buildOrgMember({ orgId: other.id, user, role: 'member' });
    const { org: own } = await buildOrg({ owner: user, org: { name: 'Zebra Lab' } });

    const workspaces = await listMyWorkspaces(sessionFor(user), createDb(env.DB));
    expect(workspaces.map(w => [w.id, w.role])).toEqual([
      [own.id, 'owner'],
      [other.id, 'member'],
    ]);
  });
});

describe('createWorkspaceForUser and updateWorkspaceSettings', () => {
  it('creates a workspace owned by the caller', async () => {
    const user = await buildUser();
    const db = createDb(env.DB);
    const created = await createWorkspaceForUser(sessionFor(user), db, {
      name: 'Evidence Lab',
      slug: 'evidence-lab',
    });
    expect(created).toMatchObject({ slug: 'evidence-lab', role: 'owner' });
    const row = await db
      .select({ role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, created.id), eq(member.userId, user.id)))
      .get();
    expect(row?.role).toBe('owner');
  });

  it('rejects a slug another workspace already uses', async () => {
    const user = await buildUser();
    await buildOrg({ org: { slug: 'taken' } });
    await expectDomainError(
      createWorkspaceForUser(sessionFor(user), createDb(env.DB), { name: 'X', slug: 'taken' }),
      'slug_taken',
    );
  });

  it('lets the owner rename and change the slug', async () => {
    const { org, owner } = await buildOrg();
    const db = createDb(env.DB);
    const updated = await updateWorkspaceSettings(sessionFor(owner), db, org.id, {
      name: 'Renamed',
      slug: 'renamed',
    });
    expect(updated).toMatchObject({ name: 'Renamed', slug: 'renamed' });
  });

  it('keeps the current slug available to its own workspace', async () => {
    const { org, owner } = await buildOrg({ org: { slug: 'mine' } });
    const result = await checkWorkspaceSlug(createDb(env.DB), 'mine', org.id);
    expect(result.available).toBe(true);
    await updateWorkspaceSettings(sessionFor(owner), createDb(env.DB), org.id, { slug: 'mine' });
  });

  it('refuses settings changes from a member', async () => {
    const { org } = await buildOrg();
    const { user } = await buildOrgMember({ orgId: org.id, role: 'member' });
    await expectDomainError(
      updateWorkspaceSettings(sessionFor(user), createDb(env.DB), org.id, { name: 'Mine now' }),
      'insufficient_org_role',
    );
    const row = await createDb(env.DB)
      .select({ name: organization.name })
      .from(organization)
      .where(eq(organization.id, org.id))
      .get();
    expect(row?.name).toBe(org.name);
  });
});

describe('checkWorkspaceSlug', () => {
  it('reports reserved and malformed slugs with a message', async () => {
    const db = createDb(env.DB);
    expect(await checkWorkspaceSlug(db, 'dashboard')).toMatchObject({ available: false });
    expect(await checkWorkspaceSlug(db, 'no spaces')).toMatchObject({ available: false });
    expect(await checkWorkspaceSlug(db, 'Fine-Slug')).toMatchObject({
      available: true,
      slug: 'fine-slug',
    });
  });
});

describe('getWorkspaceMembers', () => {
  it('counts members plus each invited person once against the plan limit', async () => {
    const { project, org, owner } = await buildProject();
    await buildProjectMember({ projectId: project.id, orgId: org.id });
    const { project: second } = await buildProject({ org, owner, skipOrgMembership: true });
    for (const projectId of [project.id, second.id]) {
      await buildProjectInvitation({
        orgId: org.id,
        projectId,
        invitedBy: owner.id,
        email: 'soraia@example.com',
      });
    }

    const result = await getWorkspaceMembers(sessionFor(owner), createDb(env.DB), org.id);
    expect(result.members).toHaveLength(2);
    expect(result.members[0]).toMatchObject({ userId: owner.id, role: 'owner' });
    expect(result.pendingInvitations).toHaveLength(2);
    expect(result.seats).toEqual({ used: 3, max: 3 });
    expect(await countCollaboratorSeats(createDb(env.DB), org.id)).toBe(3);
  });

  it('refuses someone outside the workspace', async () => {
    const { org } = await buildOrg();
    const outsider = await buildUser();
    await expectDomainError(
      getWorkspaceMembers(sessionFor(outsider), createDb(env.DB), org.id),
      'not_org_member',
    );
  });
});

describe('removeWorkspaceMember', () => {
  it('takes the person off every project, cancels their invites, and frees the seat', async () => {
    const { project, org, owner } = await buildProject();
    const { project: second } = await buildProject({ org, owner, skipOrgMembership: true });
    const { user: pat } = await buildProjectMember({ projectId: project.id, orgId: org.id });
    await buildProjectMember({
      projectId: second.id,
      orgId: org.id,
      user: pat,
      skipOrgMembership: true,
    });
    await buildProjectInvitation({
      orgId: org.id,
      projectId: second.id,
      invitedBy: owner.id,
      email: pat.email.toLowerCase(),
    });
    const db = createDb(env.DB);
    expect(await countCollaboratorSeats(db, org.id)).toBe(2);

    const result = await removeWorkspaceMember(sessionFor(owner), db, org.id, pat.id);
    expect(result.projectsLeft).toHaveLength(2);

    expect(
      await db.select().from(projectMembers).where(eq(projectMembers.userId, pat.id)).all(),
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(member)
        .where(and(eq(member.organizationId, org.id), eq(member.userId, pat.id)))
        .all(),
    ).toHaveLength(0);
    expect(
      await db.select().from(projectInvitations).where(eq(projectInvitations.orgId, org.id)).all(),
    ).toHaveLength(0);
    expect(await countCollaboratorSeats(db, org.id)).toBe(1);
  });

  it('refuses when the person is the only owner of a project', async () => {
    const { project, org, owner } = await buildProject();
    await buildProjectMember({ projectId: project.id, orgId: org.id, role: 'member' });
    const { user: lead } = await buildOrgMember({ orgId: org.id, role: 'member' });
    // A project whose only owner is a workspace member, not the workspace owner.
    await buildProject({ org, owner: lead, skipOrgMembership: true });

    await expect(
      removeWorkspaceMember(sessionFor(owner), createDb(env.DB), org.id, lead.id),
    ).rejects.toThrow(/only owner/);
  });

  it('refuses to remove the owner or let a member remove anyone', async () => {
    const { org, owner } = await buildOrg();
    const { user: pat } = await buildOrgMember({ orgId: org.id, role: 'member' });
    const { user: luana } = await buildOrgMember({ orgId: org.id, role: 'member' });
    const db = createDb(env.DB);

    await expectDomainError(
      removeWorkspaceMember(sessionFor(owner), db, org.id, owner.id),
      'cannot_remove_self',
    );
    await expectDomainError(
      removeWorkspaceMember(sessionFor(pat), db, org.id, luana.id),
      'insufficient_org_role',
    );
  });
});
