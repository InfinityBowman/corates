/**
 * Centralized Authorization Policies
 *
 * This module exports all policy functions for authorization checks.
 *
 * Usage in routes:
 *
 *   import { requireProjectEdit, canRemoveMember } from '@/policies';
 *
 *   // Assertion style (throws on failure)
 *   await requireProjectEdit(db, user.id, projectId);
 *
 *   // Check style (returns boolean)
 *   if (await canRemoveMember(db, user.id, projectId, targetId)) { ... }
 *
 * Policy Naming Conventions:
 * - can*: Returns boolean, for conditional logic
 * - require*: Throws DomainError on failure, for guard clauses
 * - get*: Returns data (membership, role info)
 * - is*: Returns boolean for simple role checks
 * - has*: Returns boolean for role hierarchy checks
 */

// Role utilities
export {
  ORG_ROLES,
  PROJECT_ROLES,
  hasMinRole,
  hasOrgRole,
  hasProjectRole,
  isOrgOwner,
  isOrgAdmin,
  isProjectOwner,
  isTopRole,
} from './lib/roles.js';

// Project policies
export {
  // Data fetching
  getProjectMembership,

  // Boolean checks
  canReadProject,
  canEditProject,
  canDeleteProject,
  canManageMembers,
  canRemoveMember,
  canChangeRole,
  canRemoveWithoutOrphaning,

  // Assertions (throw on failure)
  requireProjectRead,
  requireProjectEdit,
  requireProjectDelete,
  requireMemberManagement,
  requireMemberRemoval,
  requireSafeRoleChange,
  requireSafeRemoval,
} from './projects.js';

// Organization policies
export {
  // Data fetching
  getOrgMembership,

  // Boolean checks
  isOrgMember,
  canReadOrg,
  canUpdateOrg,
  canDeleteOrg,
  canManageOrgMembers,
  canRemoveOrgMember,
  canChangeOrgRole,
  canRemoveOrgMemberWithoutOrphaning,

  // Assertions (throw on failure)
  requireOrgAccess,
  requireOrgMemberManagement,
  requireOrgDelete,
  requireOrgMemberRemoval,
  requireSafeOrgRoleChange,
  requireSafeOrgMemberRemoval,
} from './orgs.js';
