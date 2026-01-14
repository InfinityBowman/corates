/**
 * Organization authorization policies
 *
 * Centralizes all organization-level permission checks.
 *
 * Actions:
 * - read: View org details
 * - update: Modify org settings
 * - delete: Delete organization
 * - manage_members: Add/remove/update member roles
 */

import { member } from '@/db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { hasOrgRole, isOrgOwner } from './lib/roles.js';

/**
 * Get user's membership for an organization
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<{role: string, createdAt: Date} | null>}
 */
export async function getOrgMembership(db, userId, orgId) {
  const membership = await db
    .select({
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .get();

  return membership || null;
}

/**
 * Check if user is an org member
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>}
 */
export async function isOrgMember(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership;
}

/**
 * Check if user can read org (any member)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>}
 */
export async function canReadOrg(db, userId, orgId) {
  return isOrgMember(db, userId, orgId);
}

/**
 * Check if user can update org (admin+)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>}
 */
export async function canUpdateOrg(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can delete org (owner only)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>}
 */
export async function canDeleteOrg(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && isOrgOwner(membership.role);
}

/**
 * Check if user can manage org members (admin+)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<boolean>}
 */
export async function canManageOrgMembers(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can remove a specific org member
 * Admins can remove anyone (except last owner), users can remove themselves
 *
 * @param {Object} db - Database instance
 * @param {string} actorId - User performing the action
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User to be removed
 * @returns {Promise<boolean>}
 */
export async function canRemoveOrgMember(db, actorId, orgId, targetUserId) {
  if (actorId === targetUserId) {
    return isOrgMember(db, actorId, orgId);
  }
  return canManageOrgMembers(db, actorId, orgId);
}

/**
 * Check if role change would orphan org (remove last owner)
 *
 * @param {Object} db - Database instance
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User whose role is changing
 * @param {string} newRole - New role to assign
 * @returns {Promise<boolean>} True if safe, false if would orphan
 */
export async function canChangeOrgRole(db, orgId, targetUserId, newRole) {
  if (newRole === 'owner') {
    return true;
  }

  const targetMembership = await getOrgMembership(db, targetUserId, orgId);
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true;
  }

  const result = await db
    .select({ count: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.role, 'owner')))
    .get();

  return (result?.count || 0) > 1;
}

/**
 * Check if removing a member would orphan org
 *
 * @param {Object} db - Database instance
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User to be removed
 * @returns {Promise<boolean>} True if safe, false if would orphan
 */
export async function canRemoveOrgMemberWithoutOrphaning(db, orgId, targetUserId) {
  const targetMembership = await getOrgMembership(db, targetUserId, orgId);

  if (!targetMembership || targetMembership.role !== 'owner') {
    return true;
  }

  const result = await db
    .select({ count: count() })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.role, 'owner')))
    .get();

  return (result?.count || 0) > 1;
}

// ============================================
// Assertion Functions (throw on failure)
// ============================================

/**
 * Require org membership at minimum role level
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @param {string} [minRole='member'] - Minimum required role
 * @returns {Promise<{role: string, createdAt: Date}>} Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not a member or insufficient role
 */
export async function requireOrgAccess(db, userId, orgId, minRole = 'member') {
  const membership = await getOrgMembership(db, userId, orgId);

  if (!membership) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'not_org_member', orgId });
  }

  if (!hasOrgRole(membership.role, minRole)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'insufficient_role', required: minRole, actual: membership.role },
      `This action requires ${minRole} role or higher`,
    );
  }

  return membership;
}

/**
 * Require user can manage org members (admin+)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<{role: string, createdAt: Date}>} Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not admin+
 */
export async function requireOrgMemberManagement(db, userId, orgId) {
  return requireOrgAccess(db, userId, orgId, 'admin');
}

/**
 * Require user can delete org (owner only)
 *
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} orgId - Organization ID
 * @returns {Promise<{role: string, createdAt: Date}>} Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not owner
 */
export async function requireOrgDelete(db, userId, orgId) {
  return requireOrgAccess(db, userId, orgId, 'owner');
}

/**
 * Require org member removal is allowed (admin or self)
 *
 * @param {Object} db - Database instance
 * @param {string} actorId - User performing the action
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User to be removed
 * @throws {DomainError} AUTH_FORBIDDEN if not authorized
 */
export async function requireOrgMemberRemoval(db, actorId, orgId, targetUserId) {
  const actorMembership = await getOrgMembership(db, actorId, orgId);

  if (!actorMembership) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'not_org_member', orgId });
  }

  const isSelf = actorId === targetUserId;
  const canManage = hasOrgRole(actorMembership.role, 'admin');

  if (!canManage && !isSelf) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'cannot_remove_member' },
      'Only admins can remove other members',
    );
  }
}

/**
 * Require safe role change in org (won't orphan)
 *
 * @param {Object} db - Database instance
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User whose role is changing
 * @param {string} newRole - New role to assign
 * @throws {DomainError} AUTH_FORBIDDEN if would orphan org
 */
export async function requireSafeOrgRoleChange(db, orgId, targetUserId, newRole) {
  if (!(await canChangeOrgRole(db, orgId, targetUserId, newRole))) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'last_owner', orgId },
      'Cannot demote the last owner. Assign another owner first.',
    );
  }
}

/**
 * Require safe member removal in org (won't orphan)
 *
 * @param {Object} db - Database instance
 * @param {string} orgId - Organization ID
 * @param {string} targetUserId - User to be removed
 * @throws {DomainError} AUTH_FORBIDDEN if would orphan org
 */
export async function requireSafeOrgMemberRemoval(db, orgId, targetUserId) {
  if (!(await canRemoveOrgMemberWithoutOrphaning(db, orgId, targetUserId))) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'last_owner', orgId },
      'Cannot remove the last owner. Assign another owner first.',
    );
  }
}
