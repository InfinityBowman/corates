# Centralized Authorization Implementation Plan

## Overview

Consolidate scattered authorization logic into a centralized policy system. This improves security auditability, reduces code duplication, and makes permission rules easier to maintain and test.

## Current State Analysis

### What Works Well

1. **Middleware-based auth** - `requireOrgMembership`, `requireProjectAccess`, `requireAdmin` handle basic access control
2. **Role hierarchies defined** - Org roles (member < admin < owner), project roles (member < owner)
3. **Entitlement system** - `requireEntitlement` for feature gating
4. **Domain errors** - Structured error responses with `AUTH_ERRORS.FORBIDDEN`

### Problems Identified

1. **Inline authorization checks scattered across handlers**
   ```javascript
   // Duplicated in members.js, orgs/members.js
   const isOwner = c.get('isOwner');
   if (!isOwner) {
     const error = createDomainError(AUTH_ERRORS.FORBIDDEN, ...);
     return c.json(error, error.statusCode);
   }
   ```

2. **Business rules mixed with authorization**
   ```javascript
   // "Last owner" check repeated in 4+ places
   if (targetMember?.role === 'owner' && ownerCountResult?.count <= 1) {
     const error = createDomainError(PROJECT_ERRORS.LAST_OWNER, ...);
   }
   ```

3. **Self-removal logic duplicated**
   ```javascript
   // In both members.js and orgs/members.js
   const isSelfRemoval = memberId === authUser.id;
   if (!isOwner && !isSelfRemoval) { ... }
   ```

4. **Hard to audit** - Must search entire codebase to understand "who can do what"

5. **Inconsistent error messages** - Same check returns different messages in different places

### Authorization Checks Inventory

| Resource | Action | Current Location | Check Logic |
|----------|--------|------------------|-------------|
| Project | create | orgs/projects.js:360 | Org member + entitlement + quota |
| Project | read | orgs/projects.js:482 | Project member |
| Project | update | orgs/projects.js:528 | Project member (any role) |
| Project | delete | orgs/projects.js:577 | Project owner |
| Project Member | list | members.js:307 | Project member |
| Project Member | add | members.js:339 | Project owner |
| Project Member | update role | members.js:667 | Project owner + not last owner |
| Project Member | remove | members.js:733 | Project owner OR self |
| Org | read | orgs/index.js:589 | Org member |
| Org | update | orgs/index.js:633 | Org admin |
| Org | delete | orgs/index.js:678 | Org owner |
| Org Member | list | orgs/index.js:709 | Org member |
| Org Member | add | orgs/index.js:736 | Org admin |
| Org Member | update role | orgs/index.js:796 | Org admin + not last owner |
| Org Member | remove | orgs/index.js:856 | Org admin OR self |

## Target Architecture

```
packages/workers/src/
  policies/                    # Centralized authorization (NEW)
    projects.js               # Project-level policies
    members.js                # Member management policies
    orgs.js                   # Organization-level policies
    lib/
      roles.js                # Role hierarchy utilities
      assertions.js           # Assertion helpers (require*, can*)
    index.js                  # Re-exports
  middleware/                  # Existing (simplified)
    requireOrg.js             # Uses policies internally
    requireAdmin.js           # Uses policies internally
  routes/                      # Existing (uses policies)
```

## Policy Design

### Core Principles

1. **Pure functions** - Policies take data, return boolean or throw
2. **No side effects** - Don't modify DB, don't send notifications
3. **Composable** - Complex policies built from simple ones
4. **Testable** - Easy to unit test with mock data
5. **Auditable** - All permissions visible in one place

### Policy Function Patterns

```javascript
// Check function - returns boolean
export function canEditProject(actor, project, membership) {
  return !!membership; // Any project member can edit
}

// Assertion function - throws on failure
export async function requireProjectEdit(db, actorId, projectId) {
  const membership = await getProjectMembership(db, actorId, projectId);
  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }
}

// Complex check - combines multiple conditions
export async function canRemoveMember(db, actor, projectId, targetUserId) {
  const actorMembership = await getProjectMembership(db, actor.id, projectId);
  const isOwner = actorMembership?.role === 'owner';
  const isSelf = actor.id === targetUserId;

  return isOwner || isSelf;
}
```

## Implementation Steps

### Phase 1: Role Utilities

#### 1.1 Create Role Hierarchy Module

**File**: `packages/workers/src/policies/lib/roles.js`

```javascript
/**
 * Role hierarchy definitions and comparison utilities
 */

// Organization role hierarchy (lowest to highest)
export const ORG_ROLES = ['member', 'admin', 'owner'];

// Project role hierarchy (lowest to highest)
export const PROJECT_ROLES = ['member', 'owner'];

/**
 * Check if actualRole meets or exceeds requiredRole
 * @param {string[]} hierarchy - Role hierarchy array
 * @param {string} actualRole - User's actual role
 * @param {string} requiredRole - Minimum required role
 * @returns {boolean}
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
 * Check org role meets minimum
 */
export function hasOrgRole(actualRole, minRole) {
  return hasMinRole(ORG_ROLES, actualRole, minRole);
}

/**
 * Check project role meets minimum
 */
export function hasProjectRole(actualRole, minRole) {
  return hasMinRole(PROJECT_ROLES, actualRole, minRole);
}

/**
 * Check if role is the highest in hierarchy
 */
export function isTopRole(hierarchy, role) {
  return hierarchy.indexOf(role) === hierarchy.length - 1;
}

export function isOrgOwner(role) {
  return role === 'owner';
}

export function isProjectOwner(role) {
  return role === 'owner';
}
```

### Phase 2: Project Policies

#### 2.1 Create Project Policy Module

**File**: `packages/workers/src/policies/projects.js`

```javascript
/**
 * Project authorization policies
 *
 * Centralizes all project-level permission checks.
 *
 * Actions:
 * - read: View project details and contents
 * - edit: Modify project metadata
 * - delete: Delete project entirely
 * - manage: Manage members (add/remove/update roles)
 */

import { createDb } from '@/db/client.js';
import { projects, projectMembers } from '@/db/schema.js';
import { eq, and, count } from 'drizzle-orm';
import { createDomainError, PROJECT_ERRORS, AUTH_ERRORS } from '@corates/shared';
import { hasProjectRole, isProjectOwner } from './lib/roles.js';

/**
 * Get user's membership for a project
 * @param {Object} db - Database instance
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @returns {Promise<{role: string, joinedAt: Date} | null>}
 */
export async function getProjectMembership(db, userId, projectId) {
  const membership = await db
    .select({
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.userId, userId)
    ))
    .get();

  return membership || null;
}

/**
 * Check if user can read project (is a member)
 */
export async function canReadProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership;
}

/**
 * Check if user can edit project (any member can edit)
 */
export async function canEditProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return !!membership;
}

/**
 * Check if user can delete project (owner only)
 */
export async function canDeleteProject(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return membership && isProjectOwner(membership.role);
}

/**
 * Check if user can manage project members (owner only)
 */
export async function canManageMembers(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);
  return membership && isProjectOwner(membership.role);
}

/**
 * Check if user can remove a specific member
 * Owners can remove anyone, non-owners can only remove themselves
 */
export async function canRemoveMember(db, actorId, projectId, targetUserId) {
  // Self-removal is always allowed (if you're a member)
  if (actorId === targetUserId) {
    const membership = await getProjectMembership(db, actorId, projectId);
    return !!membership;
  }

  // Otherwise, must be owner
  return canManageMembers(db, actorId, projectId);
}

/**
 * Check if a role change would leave project without owners
 * @returns {Promise<boolean>} true if safe, false if would remove last owner
 */
export async function canChangeRole(db, projectId, targetUserId, newRole) {
  // If promoting to owner, always safe
  if (newRole === 'owner') {
    return true;
  }

  // Check if target is currently an owner
  const targetMembership = await getProjectMembership(db, targetUserId, projectId);
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true; // Not demoting an owner
  }

  // Count current owners
  const [result] = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.role, 'owner')
    ));

  return (result?.count || 0) > 1;
}

/**
 * Check if removing a member would leave project without owners
 */
export async function canRemoveWithoutOrphaning(db, projectId, targetUserId) {
  const targetMembership = await getProjectMembership(db, targetUserId, projectId);

  // If not an owner, removal is safe
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true;
  }

  // Count current owners
  const [result] = await db
    .select({ count: count() })
    .from(projectMembers)
    .where(and(
      eq(projectMembers.projectId, projectId),
      eq(projectMembers.role, 'owner')
    ));

  return (result?.count || 0) > 1;
}

// ============================================
// Assertion Functions (throw on failure)
// ============================================

/**
 * Require user can read project, throw if not
 */
export async function requireProjectRead(db, userId, projectId) {
  if (!await canReadProject(db, userId, projectId)) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }
}

/**
 * Require user can edit project, throw if not
 */
export async function requireProjectEdit(db, userId, projectId) {
  if (!await canEditProject(db, userId, projectId)) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }
}

/**
 * Require user can delete project, throw if not
 */
export async function requireProjectDelete(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  if (!isProjectOwner(membership.role)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_required', action: 'delete_project' },
      'Only project owners can delete projects'
    );
  }
}

/**
 * Require user can manage members, throw if not
 */
export async function requireMemberManagement(db, userId, projectId) {
  const membership = await getProjectMembership(db, userId, projectId);

  if (!membership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  if (!isProjectOwner(membership.role)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_required', action: 'manage_members' },
      'Only project owners can manage members'
    );
  }
}

/**
 * Require member removal is allowed (owner or self)
 */
export async function requireMemberRemoval(db, actorId, projectId, targetUserId) {
  const actorMembership = await getProjectMembership(db, actorId, projectId);

  if (!actorMembership) {
    throw createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
  }

  const isSelf = actorId === targetUserId;
  const isOwner = isProjectOwner(actorMembership.role);

  if (!isOwner && !isSelf) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'owner_or_self_required', action: 'remove_member' },
      'Only project owners can remove other members'
    );
  }
}

/**
 * Require role change won't orphan project
 */
export async function requireSafeRoleChange(db, projectId, targetUserId, newRole) {
  if (!await canChangeRole(db, projectId, targetUserId, newRole)) {
    throw createDomainError(
      PROJECT_ERRORS.LAST_OWNER,
      { projectId },
      'Cannot demote the last owner. Assign another owner first.'
    );
  }
}

/**
 * Require removal won't orphan project
 */
export async function requireSafeRemoval(db, projectId, targetUserId) {
  if (!await canRemoveWithoutOrphaning(db, projectId, targetUserId)) {
    throw createDomainError(
      PROJECT_ERRORS.LAST_OWNER,
      { projectId },
      'Cannot remove the last owner. Assign another owner first or delete the project.'
    );
  }
}
```

### Phase 3: Organization Policies

#### 3.1 Create Org Policy Module

**File**: `packages/workers/src/policies/orgs.js`

```javascript
/**
 * Organization authorization policies
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
import { hasOrgRole, isOrgOwner, ORG_ROLES } from './lib/roles.js';

/**
 * Get user's membership for an organization
 */
export async function getOrgMembership(db, userId, orgId) {
  const membership = await db
    .select({
      role: member.role,
      createdAt: member.createdAt,
    })
    .from(member)
    .where(and(
      eq(member.organizationId, orgId),
      eq(member.userId, userId)
    ))
    .get();

  return membership || null;
}

/**
 * Check if user is org member
 */
export async function isOrgMember(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return !!membership;
}

/**
 * Check if user can read org (any member)
 */
export async function canReadOrg(db, userId, orgId) {
  return isOrgMember(db, userId, orgId);
}

/**
 * Check if user can update org (admin+)
 */
export async function canUpdateOrg(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can delete org (owner only)
 */
export async function canDeleteOrg(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && isOrgOwner(membership.role);
}

/**
 * Check if user can manage org members (admin+)
 */
export async function canManageOrgMembers(db, userId, orgId) {
  const membership = await getOrgMembership(db, userId, orgId);
  return membership && hasOrgRole(membership.role, 'admin');
}

/**
 * Check if user can remove a specific org member
 * Admins can remove anyone (except last owner), users can remove themselves
 */
export async function canRemoveOrgMember(db, actorId, orgId, targetUserId) {
  if (actorId === targetUserId) {
    return isOrgMember(db, actorId, orgId);
  }
  return canManageOrgMembers(db, actorId, orgId);
}

/**
 * Check if role change would orphan org
 */
export async function canChangeOrgRole(db, orgId, targetUserId, newRole) {
  if (newRole === 'owner') {
    return true;
  }

  const targetMembership = await getOrgMembership(db, targetUserId, orgId);
  if (!targetMembership || targetMembership.role !== 'owner') {
    return true;
  }

  const [result] = await db
    .select({ count: count() })
    .from(member)
    .where(and(
      eq(member.organizationId, orgId),
      eq(member.role, 'owner')
    ));

  return (result?.count || 0) > 1;
}

// ============================================
// Assertion Functions
// ============================================

/**
 * Require org membership at minimum role level
 */
export async function requireOrgAccess(db, userId, orgId, minRole = 'member') {
  const membership = await getOrgMembership(db, userId, orgId);

  if (!membership) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'not_org_member', orgId }
    );
  }

  if (!hasOrgRole(membership.role, minRole)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'insufficient_role', required: minRole, actual: membership.role },
      `This action requires ${minRole} role or higher`
    );
  }

  return membership;
}

/**
 * Require user can manage org members
 */
export async function requireOrgMemberManagement(db, userId, orgId) {
  return requireOrgAccess(db, userId, orgId, 'admin');
}

/**
 * Require user can delete org
 */
export async function requireOrgDelete(db, userId, orgId) {
  return requireOrgAccess(db, userId, orgId, 'owner');
}

/**
 * Require org member removal is allowed
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
      { reason: 'admin_or_self_required', action: 'remove_member' },
      'Only admins can remove other members'
    );
  }
}

/**
 * Require safe role change in org
 */
export async function requireSafeOrgRoleChange(db, orgId, targetUserId, newRole) {
  if (!await canChangeOrgRole(db, orgId, targetUserId, newRole)) {
    throw createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'last_owner', orgId },
      'Cannot demote the last owner. Assign another owner first.'
    );
  }
}
```

### Phase 4: Policy Index and Exports

#### 4.1 Create Main Index

**File**: `packages/workers/src/policies/index.js`

```javascript
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
 */

// Role utilities
export {
  ORG_ROLES,
  PROJECT_ROLES,
  hasMinRole,
  hasOrgRole,
  hasProjectRole,
  isOrgOwner,
  isProjectOwner,
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

  // Assertions (throw on failure)
  requireOrgAccess,
  requireOrgMemberManagement,
  requireOrgDelete,
  requireOrgMemberRemoval,
  requireSafeOrgRoleChange,
} from './orgs.js';
```

### Phase 5: Refactor Route Handlers

#### 5.1 Refactor Project Member Routes

**Before** (members.js:733-785):
```javascript
memberRoutes.openapi(removeMemberRoute, async c => {
  const { user: authUser } = getAuth(c);
  const isOwner = c.get('isOwner');
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');

  const isSelfRemoval = memberId === authUser.id;

  if (!isOwner && !isSelfRemoval) {
    const error = createDomainError(
      AUTH_ERRORS.FORBIDDEN,
      { reason: 'remove_member' },
      'Only project owners can remove members',
    );
    return c.json(error, error.statusCode);
  }

  const db = createDb(c.env.DB);

  // Check target member exists
  const targetMember = await db.select({ role: projectMembers.role })...;

  if (!targetMember) {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, ...);
    return c.json(error, error.statusCode);
  }

  // Prevent removing last owner
  if (targetMember.role === 'owner') {
    const ownerCountResult = await db.select({ count: count() })...;
    if (ownerCountResult?.count <= 1) {
      const error = createDomainError(PROJECT_ERRORS.LAST_OWNER, ...);
      return c.json(error, error.statusCode);
    }
  }

  // ... rest of handler
});
```

**After**:
```javascript
import {
  requireMemberRemoval,
  requireSafeRemoval,
  getProjectMembership
} from '@/policies';

memberRoutes.openapi(removeMemberRoute, async c => {
  const { user: authUser } = getAuth(c);
  const projectId = c.get('projectId');
  const memberId = c.req.param('userId');
  const db = createDb(c.env.DB);

  try {
    // Authorization: can this user remove this member?
    await requireMemberRemoval(db, authUser.id, projectId, memberId);

    // Business rule: won't orphan project?
    await requireSafeRemoval(db, projectId, memberId);

    // Check target exists
    const targetMember = await getProjectMembership(db, memberId, projectId);
    if (!targetMember) {
      throw createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId, userId: memberId });
    }

    // ... rest of handler (delete, sync, notify)

  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    throw error;
  }
});
```

#### 5.2 Refactor Org Member Routes

**Before** (orgs/index.js:796-830):
```javascript
orgRoutes.openapi(updateMemberRoleRoute, async c => {
  // Run membership middleware (admin required)
  const membershipResponse = await runMiddleware(requireOrgMembership('admin'), c);
  if (membershipResponse) return membershipResponse;

  // ... inline last-owner check
  if (targetMember?.role === 'owner' && ownerCountResult?.count <= 1) {
    const error = createDomainError(AUTH_ERRORS.FORBIDDEN, ...);
  }
});
```

**After**:
```javascript
import { requireOrgMemberManagement, requireSafeOrgRoleChange } from '@/policies';

orgRoutes.openapi(updateMemberRoleRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership('admin'), c);
  if (membershipResponse) return membershipResponse;

  const { orgId } = c.req.valid('param');
  const { userId: memberId } = c.req.valid('param');
  const { role } = c.req.valid('json');
  const db = createDb(c.env.DB);

  try {
    // Business rule: won't orphan org?
    await requireSafeOrgRoleChange(db, orgId, memberId, role);

    // ... update role
  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    throw error;
  }
});
```

### Phase 6: Update Middleware to Use Policies

#### 6.1 Simplify requireOrg.js

The existing middleware can delegate to policies internally:

```javascript
// In requireOrg.js
import { getProjectMembership, hasProjectRole } from '@/policies';

export function requireProjectAccess(minRole) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const projectId = c.req.param('projectId');
    const db = createDb(c.env.DB);

    const membership = await getProjectMembership(db, user.id, projectId);

    if (!membership) {
      const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
      return c.json(error, error.statusCode);
    }

    if (minRole && !hasProjectRole(membership.role, minRole)) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'insufficient_project_role',
        required: minRole,
        actual: membership.role,
      });
      return c.json(error, error.statusCode);
    }

    c.set('projectId', projectId);
    c.set('projectRole', membership.role);

    await next();
  };
}
```

### Phase 7: Testing

#### 7.1 Policy Unit Tests

**File**: `packages/workers/src/policies/__tests__/projects.test.js`

```javascript
import { describe, test, expect, beforeEach } from 'vitest';
import {
  canReadProject,
  canDeleteProject,
  canRemoveMember,
  canChangeRole,
  requireProjectDelete,
  requireSafeRoleChange,
} from '../projects.js';
import { setupTestDb, buildUser, buildProject, buildProjectMember } from '../../__tests__/helpers.js';

describe('Project Policies', () => {
  let db;

  beforeEach(async () => {
    db = await setupTestDb();
  });

  describe('canReadProject', () => {
    test('returns true for project members', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: user.id });

      expect(await canReadProject(db, user.id, project.id)).toBe(true);
    });

    test('returns false for non-members', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);

      expect(await canReadProject(db, user.id, project.id)).toBe(false);
    });
  });

  describe('canDeleteProject', () => {
    test('returns true for project owners', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: user.id, role: 'owner' });

      expect(await canDeleteProject(db, user.id, project.id)).toBe(true);
    });

    test('returns false for non-owner members', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: user.id, role: 'member' });

      expect(await canDeleteProject(db, user.id, project.id)).toBe(false);
    });
  });

  describe('canRemoveMember', () => {
    test('owners can remove any member', async () => {
      const owner = await buildUser(db);
      const member = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: owner.id, role: 'owner' });
      await buildProjectMember(db, { projectId: project.id, userId: member.id, role: 'member' });

      expect(await canRemoveMember(db, owner.id, project.id, member.id)).toBe(true);
    });

    test('members can remove themselves', async () => {
      const member = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: member.id, role: 'member' });

      expect(await canRemoveMember(db, member.id, project.id, member.id)).toBe(true);
    });

    test('members cannot remove others', async () => {
      const member1 = await buildUser(db);
      const member2 = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: member1.id, role: 'member' });
      await buildProjectMember(db, { projectId: project.id, userId: member2.id, role: 'member' });

      expect(await canRemoveMember(db, member1.id, project.id, member2.id)).toBe(false);
    });
  });

  describe('canChangeRole', () => {
    test('allows demoting owner when multiple owners exist', async () => {
      const owner1 = await buildUser(db);
      const owner2 = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: owner1.id, role: 'owner' });
      await buildProjectMember(db, { projectId: project.id, userId: owner2.id, role: 'owner' });

      expect(await canChangeRole(db, project.id, owner1.id, 'member')).toBe(true);
    });

    test('prevents demoting last owner', async () => {
      const owner = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: owner.id, role: 'owner' });

      expect(await canChangeRole(db, project.id, owner.id, 'member')).toBe(false);
    });
  });

  describe('requireProjectDelete', () => {
    test('throws ACCESS_DENIED for non-members', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);

      await expect(requireProjectDelete(db, user.id, project.id))
        .rejects.toMatchObject({ code: 'PROJECT_ACCESS_DENIED' });
    });

    test('throws FORBIDDEN for non-owner members', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: user.id, role: 'member' });

      await expect(requireProjectDelete(db, user.id, project.id))
        .rejects.toMatchObject({ code: 'AUTH_FORBIDDEN' });
    });

    test('succeeds for owners', async () => {
      const user = await buildUser(db);
      const project = await buildProject(db);
      await buildProjectMember(db, { projectId: project.id, userId: user.id, role: 'owner' });

      await expect(requireProjectDelete(db, user.id, project.id)).resolves.not.toThrow();
    });
  });
});
```

## File Structure After Implementation

```
packages/workers/src/
  policies/
    lib/
      roles.js                    # Role hierarchy utilities
      __tests__/
        roles.test.js
    projects.js                   # Project authorization policies
    orgs.js                       # Organization authorization policies
    index.js                      # Re-exports all policies
    __tests__/
      projects.test.js
      orgs.test.js
  middleware/
    requireOrg.js                 # Uses policies internally (refactored)
    requireAdmin.js               # Unchanged
    auth.js                       # Unchanged
  routes/
    ... (existing, uses policies for inline checks)
```

## Implementation Order

### Step 1: Create role utilities
- Create `policies/lib/roles.js`
- Write tests for role hierarchy functions

### Step 2: Create project policies
- Create `policies/projects.js`
- Write comprehensive tests
- Do NOT refactor routes yet

### Step 3: Create org policies
- Create `policies/orgs.js`
- Write comprehensive tests

### Step 4: Create index and exports
- Create `policies/index.js`
- Verify all exports work

### Step 5: Refactor one route file (pilot)
- Start with `members.js` (has most inline checks)
- Replace inline auth checks with policy calls
- Run existing tests to verify no regressions

### Step 6: Refactor remaining routes
- `orgs/members.js`
- `orgs/index.js`
- `orgs/projects.js`

### Step 7: Update middleware
- Refactor `requireOrg.js` to use policies internally
- Verify middleware still works correctly

### Step 8: Documentation
- Add policies section to API development guide
- Document policy naming conventions

## Success Metrics

1. **All auth checks in policies/** - No inline `isOwner` checks in routes
2. **Consistent error messages** - Same check = same error message everywhere
3. **Policy test coverage** - Each policy function has unit tests
4. **Audit trail** - Can answer "who can delete a project?" by reading one file

## Benefits Summary

| Before | After |
|--------|-------|
| Auth checks in 15+ route files | Auth checks in 3 policy files |
| "Last owner" check duplicated 4x | Single `canChangeRole` function |
| Must search codebase to audit | Read `policies/` directory |
| Inline DB queries for auth | Reusable `getProjectMembership` |
| Inconsistent error messages | Standardized error responses |

## Appendix: Quick Reference

### Policy Function Cheat Sheet

```javascript
// Import all policies
import * as policies from '@/policies';

// Or import specific functions
import {
  canReadProject,           // Boolean: can user read project?
  requireProjectEdit,       // Throws: assert user can edit
  getProjectMembership,     // Data: get user's membership
  hasProjectRole,           // Utility: compare roles
} from '@/policies';

// Usage patterns

// Guard clause pattern (recommended)
await requireProjectDelete(db, user.id, projectId);
// If we get here, user is authorized

// Conditional pattern (for UI logic)
if (await canManageMembers(db, user.id, projectId)) {
  // Show member management UI
}

// Data fetching (for displaying role)
const membership = await getProjectMembership(db, user.id, projectId);
// membership.role === 'owner' | 'member' | null
```
