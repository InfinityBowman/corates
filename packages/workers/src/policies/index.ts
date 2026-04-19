/**
 * Centralized Authorization Policies
 *
 * This module exports all policy functions for authorization checks.
 *
 * Usage in routes:
 *
 *   import { requireProjectEdit, requireMemberRemoval } from './';
 *
 *   // Assertion style (throws on failure)
 *   await requireProjectEdit(db, user.id, projectId);
 *   await requireMemberRemoval(db, user.id, projectId, targetId);
 *
 * Policy Naming Conventions:
 * - can*: Returns boolean, for conditional logic
 * - require*: Throws DomainError on failure, for guard clauses
 * - get*: Returns data (membership, role info)
 * - is*: Returns boolean for simple role checks
 * - has*: Returns boolean for role hierarchy checks
 */

// Role utilities
export { hasOrgRole, hasProjectRole, isOrgOwner, isProjectOwner } from './lib/roles';

// Project policies
export {
  // Data fetching
  getProjectMembership,

  // Assertions (throw on failure)
  requireProjectEdit,
  requireMemberRemoval,
  requireSafeRoleChange,
  requireSafeRemoval,
} from './projects';

// Organization policies
export {
  // Assertions (throw on failure)
  requireOrgMemberRemoval,
} from './orgs';

// Billing policies
export {
  // Assertions (throw on failure)
  requireOrgOwner,
} from './billing';
