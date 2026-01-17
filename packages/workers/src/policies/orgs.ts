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

import { member } from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { hasOrgRole, isOrgOwner } from './lib/roles';
import type { Database } from '@/db/client';
import type { OrgRole } from './lib/roles';

// Return types for membership queries
export interface OrgMembership {
  role: string | null;
  createdAt: Date | null;
}

/**
 * Get user's membership for an organization
 */
export async function getOrgMembership(
  db: Database,
  userId: string,
  orgId: string,
): Promise<OrgMembership | null> {
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
 */
export async function isOrgMember(db: Database, userId: string, orgId: string): Promise<boolean> {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership;
}

/**
 * Check if user can read org (any member)
 */
export async function canReadOrg(db: Database, userId: string, orgId: string): Promise<boolean> {
  return isOrgMember(db, userId, orgId);
}

/**
 * Check if user can update org (admin+)
 */
export async function canUpdateOrg(db: Database, userId: string, orgId: string): Promise<boolean> {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership && !!membership.role && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can delete org (owner only)
 */
export async function canDeleteOrg(db: Database, userId: string, orgId: string): Promise<boolean> {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership && !!membership.role && isOrgOwner(membership.role);
}

/**
 * Check if user can manage org members (admin+)
 */
export async function canManageOrgMembers(
  db: Database,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership && !!membership.role && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can remove a specific org member
 * Admins can remove anyone (except last owner), users can remove themselves
 */
export async function canRemoveOrgMember(
  db: Database,
  actorId: string,
  orgId: string,
  targetUserId: string,
): Promise<boolean> {
  if (actorId === targetUserId) {
    return isOrgMember(db, actorId, orgId);
  }
  return canManageOrgMembers(db, actorId, orgId);
}

/**
 * Check if role change would orphan org (remove last owner)
 *
 * @returns True if safe, false if would orphan
 */
export async function canChangeOrgRole(
  db: Database,
  orgId: string,
  targetUserId: string,
  newRole: OrgRole | string,
): Promise<boolean> {
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
 * @returns True if safe, false if would orphan
 */
export async function canRemoveOrgMemberWithoutOrphaning(
  db: Database,
  orgId: string,
  targetUserId: string,
): Promise<boolean> {
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
 * @returns Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not a member or insufficient role
 */
export async function requireOrgAccess(
  db: Database,
  userId: string,
  orgId: string,
  minRole: OrgRole | string = 'member',
): Promise<OrgMembership> {
  const membership = await getOrgMembership(db, userId, orgId);

  if (!membership) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'not_org_member', orgId });
  }

  if (!membership.role || !hasOrgRole(membership.role, minRole)) {
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
 * @returns Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not admin+
 */
export async function requireOrgMemberManagement(
  db: Database,
  userId: string,
  orgId: string,
): Promise<OrgMembership> {
  return requireOrgAccess(db, userId, orgId, 'admin');
}

/**
 * Require user can delete org (owner only)
 *
 * @returns Membership if authorized
 * @throws {DomainError} AUTH_FORBIDDEN if not owner
 */
export async function requireOrgDelete(
  db: Database,
  userId: string,
  orgId: string,
): Promise<OrgMembership> {
  return requireOrgAccess(db, userId, orgId, 'owner');
}

/**
 * Require org member removal is allowed (admin or self)
 *
 * @throws {DomainError} AUTH_FORBIDDEN if not authorized
 */
export async function requireOrgMemberRemoval(
  db: Database,
  actorId: string,
  orgId: string,
  targetUserId: string,
): Promise<void> {
  const actorMembership = await getOrgMembership(db, actorId, orgId);

  if (!actorMembership) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, { reason: 'not_org_member', orgId });
  }

  const isSelf = actorId === targetUserId;
  const canManage = !!actorMembership.role && hasOrgRole(actorMembership.role, 'admin');

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
 * @throws {DomainError} AUTH_FORBIDDEN if would orphan org
 */
export async function requireSafeOrgRoleChange(
  db: Database,
  orgId: string,
  targetUserId: string,
  newRole: OrgRole | string,
): Promise<void> {
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
 * @throws {DomainError} AUTH_FORBIDDEN if would orphan org
 */
export async function requireSafeOrgMemberRemoval(
  db: Database,
  orgId: string,
  targetUserId: string,
): Promise<void> {
  if (!(await canRemoveOrgMemberWithoutOrphaning(db, orgId, targetUserId))) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'last_owner', orgId },
      'Cannot remove the last owner. Assign another owner first.',
    );
  }
}
