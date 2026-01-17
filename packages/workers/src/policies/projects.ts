/**
 * Project authorization policies
 *
 * Centralizes all project-level permission checks.
 *
 * Actions:
 * - read: View project details and contents
 * - edit: Modify project metadata
 * - delete: Delete project entirely
 * - manage: Manage members (add/remove/update roles)
 */

import { projectMembers } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { isProjectOwner } from './lib/roles';
import type { Database } from '@/db/client';
import type { ProjectRole } from './lib/roles';

// Return types for membership queries
export interface ProjectMembership {
  role: string | null;
  joinedAt: Date | null;
}

/**
 * Get user's membership for a project
 */
export async function getProjectMembership(
  db: Database,
  userId: string,
  projectId: string,
): Promise<ProjectMembership | null> {
  const membership = await db
    .select({
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .get();

  return membership || null;
}

/**
 * Check if user can read project (is a member)
 */
export async function canReadProject(
  db: Database,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership;
}

/**
 * Check if user can edit project (any member can edit)
 */
export async function canEditProject(
  db: Database,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership;
}

/**
 * Check if user can delete project (owner only)
 */
export async function canDeleteProject(
  db: Database,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership && !!membership.role && isProjectOwner(membership.role);
}

/**
 * Check if user can manage project members (owner only)
 */
export async function canManageMembers(
  db: Database,
  userId: string,
  projectId: string,
): Promise<boolean> {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership && !!membership.role && isProjectOwner(membership.role);
}

/**
 * Check if user can remove a specific member
 * Owners can remove anyone, non-owners can only remove themselves
 */
export async function canRemoveMember(
  db: Database,
  actorId: string,
  projectId: string,
  targetUserId: string,
): Promise<boolean> {
  // Self-removal is always allowed (if you're a member)
  if (actorId === targetUserId) {
    const membership = await getProjectMembership(db, actorId, projectId);
    return !!membership;
  }

  // Otherwise, must be owner
  return canManageMembers(db, actorId, projectId);
}

/**
 * Check if a role change would leave project without owners
 *
 * @returns True if safe, false if would remove last owner
 */
export async function canChangeRole(
  db: Database,
  projectId: string,
  targetUserId: string,
  newRole: ProjectRole | string,
): Promise<boolean> {
  // If promoting to owner, always safe
  if (newRole === 'owner') {
    return true;
  }

  // Check if target is currently an owner
  const targetMembership = await getProjectMembership(db, targetUserId, projectId);
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true; // Not demoting an owner
  }

  // Count current owners
  const result = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
    .get();

  return (result?.count || 0) > 1;
}

/**
 * Check if removing a member would leave project without owners
 *
 * @returns True if safe, false if would orphan project
 */
export async function canRemoveWithoutOrphaning(
  db: Database,
  projectId: string,
  targetUserId: string,
): Promise<boolean> {
  const targetMembership = await getProjectMembership(db, targetUserId, projectId);

  // If not an owner, removal is safe
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true;
  }

  // Count current owners
  const result = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, 'owner')))
    .get();

  return (result?.count || 0) > 1;
}

// ============================================
// Assertion Functions (throw on failure)
// ============================================

/**
 * Require user can read project, throw if not
 *
 * @throws {DomainError} PROJECT_ACCESS_DENIED if not a member
 */
export async function requireProjectRead(
  db: Database,
  userId: string,
  projectId: string,
): Promise<void> {
  if (!(await canReadProject(db, userId, projectId))) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }
}

/**
 * Require user can edit project, throw if not
 *
 * @throws {DomainError} PROJECT_ACCESS_DENIED if not a member
 */
export async function requireProjectEdit(
  db: Database,
  userId: string,
  projectId: string,
): Promise<void> {
  if (!(await canEditProject(db, userId, projectId))) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }
}

/**
 * Require user can delete project, throw if not
 *
 * @throws {DomainError} PROJECT_ACCESS_DENIED if not a member
 * @throws {DomainError} AUTH_FORBIDDEN if not owner
 */
export async function requireProjectDelete(
  db: Database,
  userId: string,
  projectId: string,
): Promise<void> {
  const membership = await getProjectMembership(db, userId, projectId);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  if (!membership.role || !isProjectOwner(membership.role)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_required', action: 'delete_project' },
      'Only project owners can delete projects',
    );
  }
}

/**
 * Require user can manage members, throw if not
 *
 * @throws {DomainError} PROJECT_ACCESS_DENIED if not a member
 * @throws {DomainError} AUTH_FORBIDDEN if not owner
 */
export async function requireMemberManagement(
  db: Database,
  userId: string,
  projectId: string,
): Promise<void> {
  const membership = await getProjectMembership(db, userId, projectId);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  if (!membership.role || !isProjectOwner(membership.role)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_required', action: 'manage_members' },
      'Only project owners can manage members',
    );
  }
}

/**
 * Require member removal is allowed (owner or self)
 *
 * @throws {DomainError} PROJECT_ACCESS_DENIED if actor not a member
 * @throws {DomainError} AUTH_FORBIDDEN if not owner and not self
 */
export async function requireMemberRemoval(
  db: Database,
  actorId: string,
  projectId: string,
  targetUserId: string,
): Promise<void> {
  const actorMembership = await getProjectMembership(db, actorId, projectId);

  if (!actorMembership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  const isSelf = actorId === targetUserId;
  const isOwner = !!actorMembership.role && isProjectOwner(actorMembership.role);

  if (!isOwner && !isSelf) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_or_self_required', action: 'remove_member' },
      'Only project owners can remove other members',
    );
  }
}

/**
 * Require role change won't orphan project
 *
 * @throws {DomainError} PROJECT_LAST_OWNER if would remove last owner
 */
export async function requireSafeRoleChange(
  db: Database,
  projectId: string,
  targetUserId: string,
  newRole: ProjectRole | string,
): Promise<void> {
  if (!(await canChangeRole(db, projectId, targetUserId, newRole))) {
    throw createDomainError(
      PROJECT_ERRORS.LAST_OWNER,
      { projectId },
      'Cannot demote the last owner. Assign another owner first.',
    );
  }
}

/**
 * Require removal won't orphan project
 *
 * @throws {DomainError} PROJECT_LAST_OWNER if would remove last owner
 */
export async function requireSafeRemoval(
  db: Database,
  projectId: string,
  targetUserId: string,
): Promise<void> {
  if (!(await canRemoveWithoutOrphaning(db, projectId, targetUserId))) {
    throw createDomainError(
      PROJECT_ERRORS.LAST_OWNER,
      { projectId },
      'Cannot remove the last owner. Assign another owner first or delete the project.',
    );
  }
}
