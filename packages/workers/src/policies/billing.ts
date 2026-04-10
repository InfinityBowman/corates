/**
 * Billing authorization policies
 *
 * Centralizes billing-related permission checks.
 *
 * Actions:
 * - manageBilling: Purchase subscriptions, manage payment methods
 * - viewBilling: View billing status and invoices
 */

import { createDomainError, AUTH_ERRORS } from '@corates/shared';
import { isOrgOwner } from './lib/roles';

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

  if (!role || !isOrgOwner(role)) {
    throw createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'org_owner_required',
    });
  }
}
