/**
 * Helper middleware to verify user is org owner
 * Extracts repeated owner verification pattern
 */
import { createDomainError, AUTH_ERRORS } from '@corates/shared';

/**
 * Verify user is org owner, throw error if not
 * @param {Object} params
 * @param {string|null} params.orgId - Organization ID
 * @param {string|null} params.role - User's role in org
 * @throws {Error} If orgId is missing or user is not owner
 */
export function requireOrgOwner({ orgId, role }) {
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
