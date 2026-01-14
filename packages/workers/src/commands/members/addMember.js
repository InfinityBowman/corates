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
import { syncMemberToDO } from '@/lib/project-sync.js';
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

  // Ensure org membership first
  await ensureOrgMembership(db, orgId, userToAdd.id);

  // Add project membership
  const now = new Date();
  await db.insert(projectMembers).values({
    id: crypto.randomUUID(),
    projectId,
    userId: userToAdd.id,
    role,
    joinedAt: now,
  });

  // Get project name for notification
  const project = await db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();

  // Send notification to the added user
  try {
    const userSessionId = env.USER_SESSION.idFromName(userToAdd.id);
    const userSession = env.USER_SESSION.get(userSessionId);
    await userSession.fetch(
      new Request('https://internal/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'project-membership-added',
          orgId,
          projectId,
          projectName: project?.name || 'Unknown Project',
          role,
          timestamp: Date.now(),
        }),
      }),
    );
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

/**
 * Ensure user is a member of the organization, adding them if not
 */
async function ensureOrgMembership(db, orgId, userId, role = 'member') {
  const existingMembership = await db
    .select({ id: member.id })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .get();

  if (existingMembership) {
    return existingMembership;
  }

  const memberId = crypto.randomUUID();
  const now = new Date();

  await db.insert(member).values({
    id: memberId,
    userId,
    organizationId: orgId,
    role,
    createdAt: now,
  });

  return { id: memberId, role };
}
