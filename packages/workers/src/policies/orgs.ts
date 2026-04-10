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
import { eq, and } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { hasOrgRole } from './lib/roles';
import type { Database } from '@/db/client';

// Return types for membership queries
interface OrgMembership {
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

// ============================================
// Assertion Functions (throw on failure)
// ============================================

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
