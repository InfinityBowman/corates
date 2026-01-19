/**
 * Add an existing user as a project member
 *
 * @throws DomainError MEMBER_ALREADY_EXISTS if user is already a member
 * @throws DomainError AUTH_FORBIDDEN if quota exceeded
 */

import { createDb } from '@/db/client';
import { projectMembers, projects, member } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/commands/lib/doSync';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications';
import { checkCollaboratorQuota } from '@/lib/quotaTransaction';
import type { Env } from '@/types';
import type { ProjectRole } from '@/policies/lib/roles';

export interface AddMemberActor {
  id: string;
}

export interface UserToAdd {
  id: string;
  name: string | null;
  email: string | null;
  username?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
}

export interface AddMemberParams {
  orgId: string;
  projectId: string;
  userToAdd: UserToAdd;
  role: ProjectRole;
}

export interface AddMemberResult {
  member: {
    userId: string;
    name: string | null;
    email: string | null;
    username?: string | null;
    givenName?: string | null;
    familyName?: string | null;
    image?: string | null;
    role: ProjectRole;
    joinedAt: Date;
  };
}

export async function addMember(
  env: Env,
  _actor: AddMemberActor,
  { orgId, projectId, userToAdd, role }: AddMemberParams,
): Promise<AddMemberResult> {
  const db = createDb(env.DB);

  // Check if already a project member
  const existingMember = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userToAdd.id)))
    .get();

  if (existingMember) {
    throw createDomainError(PROJECT_ERRORS.MEMBER_ALREADY_EXISTS, {
      projectId,
      userId: userToAdd.id,
    });
  }

  // Check if user is already an org member (for quota purposes)
  const existingOrgMembership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userToAdd.id)))
    .get();

  // Enforce collaborator quota if adding a new org member
  if (!existingOrgMembership) {
    const quotaResult = await checkCollaboratorQuota(db, orgId);
    if (!quotaResult.allowed) {
      throw quotaResult.error;
    }
  }

  // Build insert operations for atomic batch execution
  const now = new Date();
  const insertOperations: unknown[] = [];

  // Add org membership insert if user is not already an org member
  if (!existingOrgMembership) {
    insertOperations.push(
      db.insert(member).values({
        id: crypto.randomUUID(),
        userId: userToAdd.id,
        organizationId: orgId,
        role: 'member',
        createdAt: now,
      }),
    );
  }

  // Add project membership insert
  insertOperations.push(
    db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId,
      userId: userToAdd.id,
      role,
      joinedAt: now,
    }),
  );

  // Execute all inserts atomically - both succeed or both fail
  await db.batch(insertOperations as unknown as Parameters<typeof db.batch>[0]);

  // Get project name for notification
  const project = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  // Send notification to the added user
  try {
    await notifyUser(env, userToAdd.id, {
      type: NotificationTypes.PROJECT_MEMBERSHIP_ADDED,
      orgId,
      projectId,
      projectName: project?.name || 'Unknown Project',
      role,
    });
  } catch (err) {
    console.error('Failed to send project membership notification:', err);
  }

  // Sync member to DO
  try {
    await syncMemberToDO(env, projectId, 'add', {
      userId: userToAdd.id,
      role,
      joinedAt: now.getTime(),
      name: userToAdd.name,
      email: userToAdd.email,
      givenName: userToAdd.givenName,
      familyName: userToAdd.familyName,
      image: userToAdd.image,
    });
  } catch (err) {
    console.error('Failed to sync member to DO:', err);
  }

  return {
    member: {
      userId: userToAdd.id,
      name: userToAdd.name,
      email: userToAdd.email,
      username: userToAdd.username,
      givenName: userToAdd.givenName,
      familyName: userToAdd.familyName,
      image: userToAdd.image,
      role,
      joinedAt: now,
    },
  };
}
