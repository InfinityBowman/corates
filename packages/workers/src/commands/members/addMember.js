/**
 * Add an existing user as a project member
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the action
 * @param {Object} params - Add member parameters
 * @param {string} params.orgId - Organization ID
 * @param {string} params.projectId - Project ID
 * @param {Object} params.userToAdd - User to add (with id, name, email, etc.)
 * @param {string} params.role - Role to assign (owner or member)
 * @returns {Promise<{ member: Object }>}
 * @throws {DomainError} MEMBER_ALREADY_EXISTS if user is already a member
 * @throws {DomainError} AUTH_FORBIDDEN if quota exceeded
 */

import { createDb } from '@/db/client.js';
import { projectMembers, projects, member } from '@/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';
import { syncMemberToDO } from '@/commands/lib/doSync.js';
import { notifyUser, NotificationTypes } from '@/commands/lib/notifications.js';
import { checkCollaboratorQuota } from '@/lib/quotaTransaction.js';

export async function addMember(env, actor, { orgId, projectId, userToAdd, role }) {
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
  const insertOperations = [];

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
  await db.batch(insertOperations);

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
      displayName: userToAdd.displayName,
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
      displayName: userToAdd.displayName,
      image: userToAdd.image,
      role,
      joinedAt: now,
    },
  };
}
