/**
 * Accept a project invitation by token
 *
 * Handles: token validation, expiry, email verification, quota enforcement,
 * org/project membership grants, DO sync, notifications
 *
 * @throws DomainError FIELD_INVALID_FORMAT if token is invalid or expired
 * @throws DomainError MEMBER_ALREADY_EXISTS if invitation already accepted
 * @throws DomainError AUTH_FORBIDDEN if email mismatch or quota exceeded
 */

import { createDb } from '@/db/client';
import {
  projectInvitations,
  projectMembers,
  projects,
  user,
  member,
  organization,
} from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, AUTH_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/lib/project-sync';
import { checkCollaboratorQuota } from '@/lib/quotaTransaction';
import type { Env } from '@/types';

export interface AcceptInvitationActor {
  id: string;
}

export interface AcceptInvitationParams {
  token: string;
}

export interface AcceptInvitationResult {
  orgId: string | null;
  orgSlug: string | null;
  projectId: string;
  projectName: string;
  role: string | null;
  alreadyMember: boolean;
}

export async function acceptInvitation(
  env: Env,
  actor: AcceptInvitationActor,
  { token }: AcceptInvitationParams,
): Promise<AcceptInvitationResult> {
  const db = createDb(env.DB);

  // Find invitation by token
  const invitation = await db
    .select({
      id: projectInvitations.id,
      orgId: projectInvitations.orgId,
      projectId: projectInvitations.projectId,
      email: projectInvitations.email,
      role: projectInvitations.role,
      orgRole: projectInvitations.orgRole,
      grantOrgMembership: projectInvitations.grantOrgMembership,
      expiresAt: projectInvitations.expiresAt,
      acceptedAt: projectInvitations.acceptedAt,
    })
    .from(projectInvitations)
    .where(eq(projectInvitations.token, token))
    .get();

  if (!invitation) {
    throw createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
      field: 'token',
      value: token,
    });
  }

  if (Date.now() > invitation.expiresAt.getTime()) {
    throw createDomainError(VALIDATION_ERRORS.FIELD_INVALID_FORMAT, {
      field: 'token',
      value: 'expired',
    });
  }

  if (invitation.acceptedAt) {
    throw createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
      projectId: invitation.projectId,
    });
  }

  // Verify email match
  const currentUser = await db
    .select({
      email: user.email,
      name: user.name,
      givenName: user.givenName,
      familyName: user.familyName,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, actor.id))
    .get();

  if (!currentUser) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'user_not_found' });
  }

  const normalizedUserEmail = (currentUser.email || '').trim().toLowerCase();
  const normalizedInvitationEmail = (invitation.email || '').trim().toLowerCase();

  if (normalizedUserEmail !== normalizedInvitationEmail) {
    console.error(
      `[Invitation] Email mismatch: user email="${currentUser.email}", invitation email="${invitation.email}"`,
    );
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'email_mismatch',
      userEmail: currentUser.email,
      invitationEmail: invitation.email,
    });
  }

  // Check if already a project member
  const existingMember = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(eq(projectMembers.projectId, invitation.projectId), eq(projectMembers.userId, actor.id)),
    )
    .get();

  if (existingMember) {
    await db
      .update(projectInvitations)
      .set({ acceptedAt: new Date() })
      .where(eq(projectInvitations.id, invitation.id));

    const project = await db
      .select({ name: projects.name })
      .from(projects)
      .where(eq(projects.id, invitation.projectId))
      .get();

    return {
      orgId: invitation.orgId,
      orgSlug: null,
      projectId: invitation.projectId,
      projectName: project?.name || 'Unknown Project',
      role: invitation.role,
      alreadyMember: true,
    };
  }

  // Quota enforcement
  if (invitation.orgId) {
    const existingOrgMembership = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, invitation.orgId), eq(member.userId, actor.id)))
      .get();

    if (!existingOrgMembership) {
      const quotaResult = await checkCollaboratorQuota(db, invitation.orgId);
      if (!quotaResult.allowed && quotaResult.error) {
        throw quotaResult.error;
      }
    }
  }

  // Build atomic batch operations
  const nowDate = new Date();
  const batchOps: Promise<unknown>[] = [];

  // Grant org membership if not already a member
  if (invitation.orgId) {
    const existingOrgMembership = await db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, invitation.orgId), eq(member.userId, actor.id)))
      .get();

    if (!existingOrgMembership) {
      batchOps.push(
        db.insert(member).values({
          id: crypto.randomUUID(),
          userId: actor.id,
          organizationId: invitation.orgId,
          role: invitation.orgRole || 'member',
          createdAt: nowDate,
        }),
      );
    }
  }

  // Add project membership
  batchOps.push(
    db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: invitation.projectId,
      userId: actor.id,
      role: invitation.role,
      joinedAt: nowDate,
    }),
  );

  // Mark invitation accepted
  batchOps.push(
    db
      .update(projectInvitations)
      .set({ acceptedAt: nowDate })
      .where(eq(projectInvitations.id, invitation.id)),
  );

  await db.batch(batchOps as unknown as Parameters<typeof db.batch>[0]);

  // Post-insert quota race condition detection
  if (invitation.orgId) {
    const postInsertQuotaResult = await checkCollaboratorQuota(db, invitation.orgId);
    if (
      !postInsertQuotaResult.allowed &&
      postInsertQuotaResult.used > postInsertQuotaResult.limit
    ) {
      console.warn(
        `[Invitation] Race condition detected: collaborator quota exceeded for org ${invitation.orgId}. ` +
          `Count: ${postInsertQuotaResult.used}, Limit: ${postInsertQuotaResult.limit}. ` +
          `User ${actor.id} was still added. Consider manual intervention.`,
      );
    }
  }

  // Get project name and org slug for response
  const project = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, invitation.projectId))
    .get();

  let orgSlug: string | null = null;
  if (invitation.orgId) {
    const org = await db
      .select({ slug: organization.slug })
      .from(organization)
      .where(eq(organization.id, invitation.orgId))
      .get();
    orgSlug = org?.slug ?? null;
  }

  // Notification
  try {
    const userSessionId = env.USER_SESSION.idFromName(actor.id);
    const userSession = env.USER_SESSION.get(userSessionId);
    await userSession.notify({
      type: 'project-invite',
      projectId: invitation.projectId,
      projectName: project?.name || 'Unknown Project',
      role: invitation.role,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error('Failed to send project invite notification:', err);
  }

  // DO sync
  try {
    await syncMemberToDO(env, invitation.projectId, 'add', {
      userId: actor.id,
      role: invitation.role ?? undefined,
      joinedAt: nowDate.getTime(),
      name: currentUser.name,
      email: currentUser.email,
      givenName: currentUser.givenName,
      familyName: currentUser.familyName,
      image: currentUser.image,
    });
  } catch (err) {
    console.error('Failed to sync member to DO:', err);
  }

  return {
    orgId: invitation.orgId,
    orgSlug,
    projectId: invitation.projectId,
    projectName: project?.name || 'Unknown Project',
    role: invitation.role,
    alreadyMember: false,
  };
}
