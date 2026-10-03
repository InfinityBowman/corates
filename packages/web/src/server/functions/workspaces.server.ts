import { captureError, info } from '@corates/workers/logger';
import { env } from 'cloudflare:workers';
import type { Database } from '@corates/db/client';
import {
  member,
  organization,
  projectInvitations,
  projectMembers,
  projects,
  user,
} from '@corates/db/schema';
import { and, asc, eq, gt, inArray, isNull, ne, notExists, sql } from 'drizzle-orm';
import {
  isDomainError,
  DomainErrorException,
  PROJECT_ERRORS,
  throwDomainError,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared';
import type { OrgId, UserId } from '@corates/shared/ids';
import { resolveOrgAccess } from '@corates/workers/billing-resolver';
import { removeMember as removeMemberCmd } from '@corates/workers/commands/members';
import { requireOrgMembership } from '@/server/guards/requireOrgMembership';
import type { Session } from '@/server/middleware/auth';

export interface WorkspaceSummary {
  id: OrgId;
  name: string;
  role: string;
}

export async function listMyWorkspaces(
  session: Session,
  db: Database,
): Promise<WorkspaceSummary[]> {
  return db
    .select({
      id: organization.id,
      name: organization.name,
      role: member.role,
    })
    .from(member)
    .innerJoin(organization, eq(member.organizationId, organization.id))
    .where(eq(member.userId, session.user.id as UserId))
    .orderBy(sql`${member.role} != 'owner'`, sql`lower(${organization.name})`)
    .all();
}

export async function updateWorkspaceSettings(
  session: Session,
  db: Database,
  orgId: OrgId,
  data: { name: string },
) {
  const membership = await requireOrgMembership(session, db, orgId, 'owner');
  if (!membership.ok) throw membership.error;

  await db.update(organization).set({ name: data.name }).where(eq(organization.id, orgId));

  info('workspace.updated', { orgId, userId: session.user.id });

  return { id: orgId, name: data.name, role: membership.context.orgRole };
}

// Live invitations to people not yet in the workspace. Each person holds one
// seat however many projects they are invited to.
function pendingInvitationsWhere(db: Database, orgId: OrgId) {
  return and(
    eq(projectInvitations.orgId, orgId),
    isNull(projectInvitations.acceptedAt),
    gt(projectInvitations.expiresAt, new Date()),
    notExists(
      db
        .select({ id: member.id })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, orgId),
            eq(sql`lower(${user.email})`, projectInvitations.email),
          ),
        ),
    ),
  );
}

/**
 * Seats in use: every workspace member, owner included, plus each person with a
 * live invitation who is not yet in the workspace. Must match the count
 * acceptInvitation enforces.
 */
export async function countCollaboratorSeats(db: Database, orgId: OrgId): Promise<number> {
  const [members] = await db
    .select({ count: sql<number>`count(*)` })
    .from(member)
    .where(eq(member.organizationId, orgId));
  const [pending] = await db
    .select({ count: sql<number>`count(distinct ${projectInvitations.email})` })
    .from(projectInvitations)
    .where(pendingInvitationsWhere(db, orgId));
  return (members?.count ?? 0) + (pending?.count ?? 0);
}

/** Whether this address already holds a seat through a live invitation here. */
export async function hasPendingInvitation(db: Database, orgId: OrgId, email: string) {
  const row = await db
    .select({ id: projectInvitations.id })
    .from(projectInvitations)
    .where(and(pendingInvitationsWhere(db, orgId), eq(projectInvitations.email, email)))
    .get();
  return !!row;
}

export async function getWorkspaceMembers(session: Session, db: Database, orgId: OrgId) {
  const membership = await requireOrgMembership(session, db, orgId);
  if (!membership.ok) throw membership.error;

  const [memberRows, projectRows, pending, orgBilling] = await Promise.all([
    db
      .select({
        userId: member.userId,
        role: member.role,
        joinedAt: member.createdAt,
        name: user.name,
        givenName: user.givenName,
        familyName: user.familyName,
        email: user.email,
        image: user.image,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(eq(member.organizationId, orgId))
      .orderBy(sql`${member.role} != 'owner'`, asc(member.createdAt))
      .all(),
    db
      .select({ userId: projectMembers.userId, id: projects.id, name: projects.name })
      .from(projectMembers)
      .innerJoin(projects, eq(projects.id, projectMembers.projectId))
      .where(eq(projects.orgId, orgId))
      .orderBy(asc(projects.name))
      .all(),
    db
      .select({
        id: projectInvitations.id,
        email: projectInvitations.email,
        projectId: projectInvitations.projectId,
        projectName: projects.name,
        createdAt: projectInvitations.createdAt,
        expiresAt: projectInvitations.expiresAt,
      })
      .from(projectInvitations)
      .innerJoin(projects, eq(projects.id, projectInvitations.projectId))
      .where(pendingInvitationsWhere(db, orgId))
      .orderBy(asc(projectInvitations.createdAt))
      .all(),
    resolveOrgAccess(db, orgId),
  ]);

  const members = memberRows.map(row => ({
    ...row,
    projects: projectRows
      .filter(project => project.userId === row.userId)
      .map(({ id, name }) => ({ id, name })),
  }));
  const pendingPeople = new Set(pending.map(invitation => invitation.email)).size;

  return {
    members,
    pendingInvitations: pending,
    seats: {
      used: members.length + pendingPeople,
      max: orgBilling.quotas['collaborators.org.max'],
    },
  };
}

/**
 * Take someone out of the workspace: off every project in it, their pending
 * invitations here cancelled, then the membership row itself. Projects go first
 * so a failure part-way leaves them still a member (and still counted) rather
 * than holding project access without a workspace seat.
 */
export async function removeWorkspaceMember(
  session: Session,
  db: Database,
  orgId: OrgId,
  targetUserId: UserId,
) {
  const membership = await requireOrgMembership(session, db, orgId, 'owner');
  if (!membership.ok) throw membership.error;

  if (targetUserId === session.user.id) {
    throwDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      { reason: 'cannot_remove_self' },
      'You cannot remove yourself from your own workspace.',
    );
  }

  const target = await db
    .select({ role: member.role, email: user.email })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(and(eq(member.organizationId, orgId), eq(member.userId, targetUserId)))
    .get();
  if (!target) {
    throwDomainError(PROJECT_ERRORS.NOT_FOUND, { orgId, userId: targetUserId }, 'Member not found');
  }
  if (target.role === 'owner') {
    throwDomainError(
      VALIDATION_ERRORS.INVALID_INPUT,
      { reason: 'cannot_remove_owner' },
      'The workspace owner cannot be removed.',
    );
  }

  const theirProjects = await db
    .select({ id: projects.id, name: projects.name, role: projectMembers.role })
    .from(projectMembers)
    .innerJoin(projects, eq(projects.id, projectMembers.projectId))
    .where(and(eq(projects.orgId, orgId), eq(projectMembers.userId, targetUserId)))
    .all();

  const ownedProjectIds = theirProjects.filter(p => p.role === 'owner').map(p => p.id);
  if (ownedProjectIds.length > 0) {
    const otherOwners = await db
      .select({ projectId: projectMembers.projectId })
      .from(projectMembers)
      .where(
        and(
          inArray(projectMembers.projectId, ownedProjectIds),
          eq(projectMembers.role, 'owner'),
          ne(projectMembers.userId, targetUserId),
        ),
      )
      .all();
    const covered = new Set(otherOwners.map(row => row.projectId));
    const soleOwned = theirProjects.filter(p => p.role === 'owner' && !covered.has(p.id));
    if (soleOwned.length > 0) {
      throwDomainError(
        PROJECT_ERRORS.LAST_OWNER,
        { projects: soleOwned.map(p => p.name) },
        `They are the only owner of ${soleOwned.map(p => `"${p.name}"`).join(', ')}. Make someone else an owner first.`,
      );
    }
  }

  const actor = { id: session.user.id, name: session.user.name, email: session.user.email };
  try {
    for (const project of theirProjects) {
      await removeMemberCmd(env, actor, {
        orgId,
        projectId: project.id,
        userId: targetUserId,
        isSelfRemoval: false,
      });
    }

    await db
      .delete(projectInvitations)
      .where(
        and(
          eq(projectInvitations.orgId, orgId),
          eq(projectInvitations.email, target.email.toLowerCase()),
          isNull(projectInvitations.acceptedAt),
        ),
      );

    await db
      .delete(member)
      .where(and(eq(member.organizationId, orgId), eq(member.userId, targetUserId)));
  } catch (err) {
    if (isDomainError(err)) throw new DomainErrorException(err as DomainError);
    captureError(err, {
      tags: { component: 'workspaces', action: 'remove-member' },
      extra: { orgId, targetUserId },
    });
    throw err;
  }

  info('workspace.member_removed', {
    orgId,
    userId: session.user.id,
    removedUserId: targetUserId,
    projectCount: theirProjects.length,
  });
  return { removed: targetUserId, projectsLeft: theirProjects.map(p => p.name) };
}
