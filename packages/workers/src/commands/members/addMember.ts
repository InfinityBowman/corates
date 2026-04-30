/**
 * Add an existing user as a project member
 *
 * @throws DomainError MEMBER_ALREADY_EXISTS if user is already a member
 * @throws DomainError AUTH_FORBIDDEN if quota exceeded
 */

import { captureError } from '../../lib/logger';
import { createDb } from '@corates/db/client';
import { projectMembers, projects, member } from '@corates/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import type { OrgId, ProjectId, UserId } from '@corates/shared/ids';
import { syncMemberWithRetry } from '../../lib/syncWithRetry';
import { notifyUser, NotificationTypes } from '../lib/notifications';
import { insertWithQuotaCheck, type InsertRollbackMeta } from '../../lib/quotaTransaction';
import type { Env } from '../../types';
import type { ProjectRole } from '../../policies/lib/roles';

interface AddMemberActor {
  id: UserId;
}

interface UserToAdd {
  id: UserId;
  name: string | null;
  email: string | null;
  username?: string | null;
  givenName?: string | null;
  familyName?: string | null;
  image?: string | null;
}

interface AddMemberParams {
  orgId: OrgId;
  projectId: ProjectId;
  userToAdd: UserToAdd;
  role: ProjectRole;
}

interface AddMemberResult {
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

  const now = new Date();
  const insertOperations: unknown[] = [];
  const rollbackMeta: InsertRollbackMeta[] = [];

  const memberId = crypto.randomUUID();
  const projectMemberId = crypto.randomUUID();

  if (!existingOrgMembership) {
    insertOperations.push(
      db.insert(member).values({
        id: memberId,
        userId: userToAdd.id,
        organizationId: orgId,
        role: 'member',
        createdAt: now,
      }),
    );
    rollbackMeta.push({ table: member, idColumn: member.id, id: memberId });
  }

  insertOperations.push(
    db.insert(projectMembers).values({
      id: projectMemberId,
      projectId,
      userId: userToAdd.id,
      role,
      joinedAt: now,
    }),
  );
  rollbackMeta.push({ table: projectMembers, idColumn: projectMembers.id, id: projectMemberId });

  if (!existingOrgMembership) {
    const result = await insertWithQuotaCheck(db, {
      orgId,
      quotaKey: 'collaborators.org.max',
      countTable: member,
      countColumn: member.organizationId,
      insertStatements: insertOperations,
      rollbackMeta,
    });
    if (!result.success) {
      throw result.error;
    }
  } else {
    await db.batch(insertOperations as unknown as Parameters<typeof db.batch>[0]);
  }

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
    captureError(err, { tags: { component: 'member', action: 'add-notify' }, extra: { projectId } });
  }

  // Sync member to DO with automatic retry
  await syncMemberWithRetry(env, projectId, 'add', {
    userId: userToAdd.id,
    role,
    joinedAt: now.getTime(),
    name: userToAdd.name,
    email: userToAdd.email,
    givenName: userToAdd.givenName,
    familyName: userToAdd.familyName,
    image: userToAdd.image,
  });

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
