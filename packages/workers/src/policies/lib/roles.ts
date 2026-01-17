/**
 * Role hierarchy definitions and comparison utilities
 *
 * Centralizes role definitions and provides utilities for comparing roles
 * across the application. Used by authorization policies to check permissions.
 */

// Role type definitions
export type OrgRole = 'member' | 'admin' | 'owner';
export type ProjectRole = 'member' | 'owner';

// Organization role hierarchy (lowest to highest)
export const ORG_ROLES: readonly OrgRole[] = ['member', 'admin', 'owner'];

// Project role hierarchy (lowest to highest)
export const PROJECT_ROLES: readonly ProjectRole[] = ['member', 'owner'];

/**
 * Check if actualRole meets or exceeds requiredRole in a hierarchy
 */
export function hasMinRole<T extends string>(
  hierarchy: readonly T[],
  actualRole: T | string,
  requiredRole: T | string,
): boolean {
  const actualIndex = hierarchy.indexOf(actualRole as T);
  const requiredIndex = hierarchy.indexOf(requiredRole as T);

  if (actualIndex === -1 || requiredIndex === -1) {
    return false;
  }

  return actualIndex >= requiredIndex;
}

/**
 * Check if org role meets minimum requirement
 */
export function hasOrgRole(actualRole: string, minRole: OrgRole | string): boolean {
  return hasMinRole(ORG_ROLES, actualRole, minRole);
}

/**
 * Check if project role meets minimum requirement
 */
export function hasProjectRole(actualRole: string, minRole: ProjectRole | string): boolean {
  return hasMinRole(PROJECT_ROLES, actualRole, minRole);
}

/**
 * Check if role is the highest in a hierarchy
 */
export function isTopRole<T extends string>(hierarchy: readonly T[], role: T | string): boolean {
  return hierarchy.indexOf(role as T) === hierarchy.length - 1;
}

/**
 * Check if user has org owner role
 */
export function isOrgOwner(role: string): boolean {
  return role === 'owner';
}

/**
 * Check if user has org admin role or higher
 */
export function isOrgAdmin(role: string): boolean {
  return hasOrgRole(role, 'admin');
}

/**
 * Check if user has project owner role
 */
export function isProjectOwner(role: string): boolean {
  return role === 'owner';
}
