/**
 * Billing authorization policies
 *
 * Centralizes billing-related permission checks.
 *
 * Actions:
 * - manageBilling: Purchase subscriptions, manage payment methods
 * - viewBilling: View billing status and invoices
 */

import { member } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isOrgOwner } from './lib/roles';
import type { Database } from '@/db/client';

/**
 * Get user's role in an organization
 */
export async function getOrgRole(
  db: Database,
  userId: string,
  orgId: string,
): Promise<string | null> {
  const membership = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, userId)))
    .get();

  return membership?.role || null;
}

/**
 * Check if user can manage billing (owner only)
 */
export async function canManageBilling(
  db: Database,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const role = await getOrgRole(db, userId, orgId);
  return role !== null && isOrgOwner(role);
}

/**
 * Check if user can view billing (any member)
 */
export async function canViewBilling(
  db: Database,
  userId: string,
  orgId: string,
): Promise<boolean> {
  const role = await getOrgRole(db, userId, orgId);
  return role !== null;
}

// ============================================
// Assertion Functions (throw on failure)
// ============================================

/**
 * Require org owner role for billing management
 *
 * @throws {DomainError} AUTH_FORBIDDEN if no org or not owner
 */
export function requireOrgOwner({
  orgId,
  role,
}: {
  orgId: string | null;
  role: string | null;
}): void {
  if (!orgId) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'no_org_found',
    });
  }

  if (role !== 'owner') {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'org_owner_required',
    });
  }
}

/**
 * Require billing management access (owner role)
 *
 * @throws {DomainError} AUTH_FORBIDDEN if not org owner
 */
export async function requireBillingManagement(
  db: Database,
  userId: string,
  orgId: string,
): Promise<void> {
  if (!(await canManageBilling(db, userId, orgId))) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'billing_owner_required', orgId },
      'Only organization owners can manage billing',
    );
  }
}

/**
 * Require billing view access (any member)
 *
 * @throws {DomainError} AUTH_FORBIDDEN if not org member
 */
export async function requireBillingView(
  db: Database,
  userId: string,
  orgId: string,
): Promise<void> {
  if (!(await canViewBilling(db, userId, orgId))) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'org_member_required', orgId },
      'Organization membership required to view billing',
    );
  }
}
