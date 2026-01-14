/**
 * Role hierarchy definitions and comparison utilities
 *
 * Centralizes role definitions and provides utilities for comparing roles
 * across the application. Used by authorization policies to check permissions.
 */

// Organization role hierarchy (lowest to highest)
export const ORG_ROLES = ['member', 'admin', 'owner'];

// Project role hierarchy (lowest to highest)
export const PROJECT_ROLES = ['member', 'owner'];

/**
 * Check if actualRole meets or exceeds requiredRole in a hierarchy
 *
 * @param {string[]} hierarchy - Role hierarchy array (lowest to highest)
 * @param {string} actualRole - User's actual role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean} True if actualRole >= requiredRole
 */
export function hasMinRole(hierarchy, actualRole, requiredRole) {
  const actualIndex = hierarchy.indexOf(actualRole);
  const requiredIndex = hierarchy.indexOf(requiredRole);

  if (actualIndex === -1 || requiredIndex === -1) {
    return false;
  }

  return actualIndex >= requiredIndex;
}

/**
 * Check if org role meets minimum requirement
 *
 * @param {string} actualRole - User's actual org role
 * @param {string} minRole - Minimum required role
 * @returns {boolean}
 */
export function hasOrgRole(actualRole, minRole) {
  return hasMinRole(ORG_ROLES, actualRole, minRole);
}

/**
 * Check if project role meets minimum requirement
 *
 * @param {string} actualRole - User's actual project role
 * @param {string} minRole - Minimum required role
 * @returns {boolean}
 */
export function hasProjectRole(actualRole, minRole) {
  return hasMinRole(PROJECT_ROLES, actualRole, minRole);
}

/**
 * Check if role is the highest in a hierarchy
 *
 * @param {string[]} hierarchy - Role hierarchy array
 * @param {string} role - Role to check
 * @returns {boolean}
 */
export function isTopRole(hierarchy, role) {
  return hierarchy.indexOf(role) === hierarchy.length - 1;
}

/**
 * Check if user has org owner role
 *
 * @param {string} role - User's org role
 * @returns {boolean}
 */
export function isOrgOwner(role) {
  return role === 'owner';
}

/**
 * Check if user has org admin role or higher
 *
 * @param {string} role - User's org role
 * @returns {boolean}
 */
export function isOrgAdmin(role) {
  return hasOrgRole(role, 'admin');
}

/**
 * Check if user has project owner role
 *
 * @param {string} role - User's project role
 * @returns {boolean}
 */
export function isProjectOwner(role) {
  return role === 'owner';
}
