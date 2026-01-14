# Test Factory Pattern Implementation Plan

## Overview

Replace verbose seed function calls with fluent factory functions that auto-generate IDs, timestamps, and related entities. This reduces test setup boilerplate and makes tests more readable and maintainable.

## Current State Analysis

### What Works Well

1. **Existing seed functions** - `seedUser`, `seedProject`, etc. provide type-safe insertion
2. **Schema validation** - Zod schemas validate seed data
3. **Test database reset** - `resetTestDatabase()` provides clean state
4. **Test environment helpers** - `createTestEnv()`, `fetchApp()` simplify HTTP testing

### Problems Identified

1. **Verbose test setup** - Every test requires 30-50 lines of seed calls
2. **Manual timestamp handling** - `nowSec = Math.floor(Date.now() / 1000)` repeated everywhere
3. **Manual ID coordination** - Must manually ensure `userId: 'user-1'` matches across entities
4. **Dependency chains** - Must remember correct order: user -> org -> member -> project -> projectMember
5. **Duplicated patterns** - Same "create user with org and project" pattern repeated in 20+ tests

### Current Test Pattern (Problematic)

```javascript
it('should return project when user is a member', async () => {
  const nowSec = Math.floor(Date.now() / 1000);

  await seedUser({
    id: 'user-1',
    name: 'User 1',
    email: 'user1@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedOrganization({
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    createdAt: nowSec,
  });

  await seedOrgMember({
    id: 'om-1',
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'owner',
    createdAt: nowSec,
  });

  await seedProject({
    id: 'project-1',
    name: 'Test Project',
    description: 'A test project',
    orgId: 'org-1',
    createdBy: 'user-1',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedProjectMember({
    id: 'pm-1',
    projectId: 'project-1',
    userId: 'user-1',
    role: 'owner',
    joinedAt: nowSec,
  });

  // 40+ lines just to test one thing
  const res = await fetchProjects('org-1', '/project-1');
  expect(res.status).toBe(200);
});
```

### Target Test Pattern (Clean)

```javascript
it('should return project when user is a member', async () => {
  const { user, org, project } = await buildProjectWithOwner();

  const res = await fetchProjects(org.id, `/${project.id}`);
  expect(res.status).toBe(200);
});

// Or with custom overrides
it('should return 403 for non-member', async () => {
  const owner = await buildUser();
  const nonMember = await buildUser();
  const { org, project } = await buildProjectWithOwner({ user: owner });

  const res = await fetchProjects(org.id, `/${project.id}`, {
    headers: { 'x-test-user-id': nonMember.id },
  });
  expect(res.status).toBe(403);
});
```

## Factory Design

### Core Principles

1. **Auto-generate IDs** - Use `crypto.randomUUID()` by default
2. **Auto-generate timestamps** - Use current time by default
3. **Auto-create dependencies** - Building a project auto-creates user and org
4. **Allow overrides** - Any field can be overridden
5. **Return created entities** - Return all created records for assertions
6. **Fluent API** - Chain modifiers for common patterns

### Factory Function Signatures

```javascript
// Basic factories - create single entity with minimal dependencies
await buildUser(overrides?)           // Creates user only
await buildOrg(overrides?)            // Creates org + owner user + membership
await buildProject(overrides?)        // Creates project + org + user + memberships

// Composite factories - create common test scenarios
await buildProjectWithOwner(overrides?)     // User who owns a project
await buildProjectWithMembers(config?)      // Project with multiple members
await buildOrgWithProjects(config?)         // Org with multiple projects

// Scenario factories - create complex test setups
await buildMemberRemovalScenario()          // Owner + member ready for removal test
await buildLastOwnerScenario()              // Single owner (can't be demoted)
await buildMultipleOwnersScenario()         // Multiple owners (can demote one)
```

## Implementation

### File Structure

```
packages/workers/src/__tests__/
  factories/
    user.js                 # User factory
    org.js                  # Organization + member factories
    project.js              # Project + member factories
    subscription.js         # Subscription/billing factories
    invitation.js           # Invitation factories
    scenarios.js            # Complex multi-entity scenarios
    utils.js                # Shared utilities (ID generation, timestamps)
    index.js                # Re-exports all factories
  helpers.js                # Existing (keep seed functions for low-level use)
  setup.js                  # Existing
```

### Phase 1: Utility Functions

**File**: `packages/workers/src/__tests__/factories/utils.js`

```javascript
/**
 * Shared utilities for test factories
 */

/**
 * Generate a unique ID with optional prefix
 */
export function generateId(prefix = '') {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}

/**
 * Get current timestamp in seconds (for database)
 */
export function nowSec() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Get current timestamp as Date
 */
export function nowDate() {
  return new Date();
}

/**
 * Merge defaults with overrides, preferring overrides
 */
export function withDefaults(defaults, overrides = {}) {
  return { ...defaults, ...overrides };
}

/**
 * Generate a test email from an ID
 */
export function emailFromId(id) {
  return `${id}@test.example.com`;
}

/**
 * Generate a slug from a name
 */
export function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

/**
 * Counter for generating sequential names
 */
let counter = 0;
export function nextCounter() {
  return ++counter;
}

export function resetCounter() {
  counter = 0;
}
```

### Phase 2: User Factory

**File**: `packages/workers/src/__tests__/factories/user.js`

```javascript
/**
 * User factory for tests
 */

import { seedUser } from '../helpers.js';
import { generateId, nowSec, withDefaults, emailFromId, nextCounter } from './utils.js';

/**
 * Build a user with sensible defaults
 *
 * @param {Object} overrides - Override any user field
 * @returns {Promise<Object>} Created user record
 *
 * @example
 * // Create user with defaults
 * const user = await buildUser();
 *
 * // Create user with specific email
 * const admin = await buildUser({ email: 'admin@example.com', role: 'admin' });
 */
export async function buildUser(overrides = {}) {
  const n = nextCounter();
  const id = overrides.id || generateId('user');
  const ts = nowSec();

  const defaults = {
    id,
    name: `Test User ${n}`,
    email: emailFromId(id),
    displayName: `Test User ${n}`,
    username: `testuser${n}`,
    role: 'user',
    emailVerified: 1,
    banned: 0,
    banReason: null,
    banExpires: null,
    stripeCustomerId: null,
    createdAt: ts,
    updatedAt: ts,
  };

  const userData = withDefaults(defaults, overrides);
  await seedUser(userData);

  return userData;
}

/**
 * Build an admin user
 */
export async function buildAdminUser(overrides = {}) {
  return buildUser({
    role: 'admin',
    ...overrides,
  });
}

/**
 * Build a banned user
 */
export async function buildBannedUser(overrides = {}) {
  const ts = nowSec();
  return buildUser({
    banned: 1,
    banReason: overrides.banReason || 'Test ban',
    banExpires: overrides.banExpires || ts + 86400, // 1 day from now
    ...overrides,
  });
}
```

### Phase 3: Organization Factory

**File**: `packages/workers/src/__tests__/factories/org.js`

```javascript
/**
 * Organization factory for tests
 */

import { seedOrganization, seedOrgMember } from '../helpers.js';
import { generateId, nowSec, withDefaults, slugify, nextCounter } from './utils.js';
import { buildUser } from './user.js';

/**
 * Build an organization with an owner
 *
 * @param {Object} options
 * @param {Object} [options.org] - Org field overrides
 * @param {Object} [options.owner] - Owner user (created if not provided)
 * @param {string} [options.ownerRole='owner'] - Owner's role in org
 * @returns {Promise<{org: Object, owner: Object, membership: Object}>}
 *
 * @example
 * // Create org with auto-generated owner
 * const { org, owner } = await buildOrg();
 *
 * // Create org with existing user as owner
 * const user = await buildUser();
 * const { org } = await buildOrg({ owner: user });
 *
 * // Create org with specific name
 * const { org } = await buildOrg({ org: { name: 'My Team' } });
 */
export async function buildOrg(options = {}) {
  const n = nextCounter();
  const ts = nowSec();

  // Create or use provided owner
  const owner = options.owner || await buildUser();

  // Create organization
  const orgId = options.org?.id || generateId('org');
  const orgName = options.org?.name || `Test Org ${n}`;

  const orgDefaults = {
    id: orgId,
    name: orgName,
    slug: slugify(orgName),
    logo: null,
    metadata: null,
    createdAt: ts,
  };

  const orgData = withDefaults(orgDefaults, options.org);
  await seedOrganization(orgData);

  // Create owner membership
  const membershipId = generateId('om');
  const membershipData = {
    id: membershipId,
    organizationId: orgId,
    userId: owner.id,
    role: options.ownerRole || 'owner',
    createdAt: ts,
  };
  await seedOrgMember(membershipData);

  return {
    org: orgData,
    owner,
    membership: membershipData,
  };
}

/**
 * Add a member to an existing organization
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization ID
 * @param {Object} [options.user] - User to add (created if not provided)
 * @param {string} [options.role='member'] - Role in organization
 * @returns {Promise<{user: Object, membership: Object}>}
 */
export async function buildOrgMember(options) {
  const { orgId, role = 'member' } = options;
  const ts = nowSec();

  const user = options.user || await buildUser();

  const membershipData = {
    id: generateId('om'),
    organizationId: orgId,
    userId: user.id,
    role,
    createdAt: ts,
  };
  await seedOrgMember(membershipData);

  return {
    user,
    membership: membershipData,
  };
}

/**
 * Build an organization with multiple members
 *
 * @param {Object} options
 * @param {number} [options.memberCount=2] - Number of additional members (besides owner)
 * @param {Object} [options.org] - Org field overrides
 * @returns {Promise<{org: Object, owner: Object, members: Array}>}
 */
export async function buildOrgWithMembers(options = {}) {
  const { memberCount = 2, ...orgOptions } = options;

  const { org, owner, membership } = await buildOrg(orgOptions);

  const members = [{ user: owner, membership, role: 'owner' }];

  for (let i = 0; i < memberCount; i++) {
    const { user, membership } = await buildOrgMember({
      orgId: org.id,
      role: 'member',
    });
    members.push({ user, membership, role: 'member' });
  }

  return { org, owner, members };
}
```

### Phase 4: Project Factory

**File**: `packages/workers/src/__tests__/factories/project.js`

```javascript
/**
 * Project factory for tests
 */

import { seedProject, seedProjectMember } from '../helpers.js';
import { generateId, nowSec, withDefaults, nextCounter } from './utils.js';
import { buildUser } from './user.js';
import { buildOrg, buildOrgMember } from './org.js';

/**
 * Build a project with an owner
 *
 * Creates: user -> org -> org membership -> project -> project membership
 *
 * @param {Object} options
 * @param {Object} [options.project] - Project field overrides
 * @param {Object} [options.owner] - Owner user (created with org if not provided)
 * @param {Object} [options.org] - Org (created if not provided)
 * @returns {Promise<{project: Object, owner: Object, org: Object, membership: Object}>}
 *
 * @example
 * // Create project with all dependencies
 * const { project, owner, org } = await buildProject();
 *
 * // Create project in existing org
 * const { org, owner } = await buildOrg();
 * const { project } = await buildProject({ org, owner });
 *
 * // Create project with specific name
 * const { project } = await buildProject({ project: { name: 'My Project' } });
 */
export async function buildProject(options = {}) {
  const n = nextCounter();
  const ts = nowSec();

  // Create or use provided org (which creates owner)
  let org, owner;
  if (options.org) {
    org = options.org;
    owner = options.owner || await buildUser();
    // Ensure owner is org member if not already
    if (options.owner && !options.skipOrgMembership) {
      await buildOrgMember({ orgId: org.id, user: owner, role: 'owner' });
    }
  } else {
    const orgResult = await buildOrg({ owner: options.owner });
    org = orgResult.org;
    owner = orgResult.owner;
  }

  // Create project
  const projectId = options.project?.id || generateId('proj');
  const projectName = options.project?.name || `Test Project ${n}`;

  const projectDefaults = {
    id: projectId,
    name: projectName,
    description: options.project?.description || `Description for ${projectName}`,
    orgId: org.id,
    createdBy: owner.id,
    createdAt: ts,
    updatedAt: ts,
  };

  const projectData = withDefaults(projectDefaults, options.project);
  await seedProject(projectData);

  // Create owner project membership
  const membershipId = generateId('pm');
  const membershipData = {
    id: membershipId,
    projectId: projectId,
    userId: owner.id,
    role: 'owner',
    joinedAt: ts,
  };
  await seedProjectMember(membershipData);

  return {
    project: projectData,
    owner,
    org,
    membership: membershipData,
  };
}

/**
 * Add a member to an existing project
 *
 * @param {Object} options
 * @param {string} options.projectId - Project ID
 * @param {string} options.orgId - Organization ID (for org membership)
 * @param {Object} [options.user] - User to add (created if not provided)
 * @param {string} [options.role='member'] - Role in project
 * @returns {Promise<{user: Object, membership: Object}>}
 */
export async function buildProjectMember(options) {
  const { projectId, orgId, role = 'member' } = options;
  const ts = nowSec();

  const user = options.user || await buildUser();

  // Ensure user is org member
  if (orgId && !options.skipOrgMembership) {
    try {
      await buildOrgMember({ orgId, user, role: 'member' });
    } catch (e) {
      // Ignore if already a member
      if (!e.message?.includes('UNIQUE constraint')) throw e;
    }
  }

  // Add to project
  const membershipData = {
    id: generateId('pm'),
    projectId,
    userId: user.id,
    role,
    joinedAt: ts,
  };
  await seedProjectMember(membershipData);

  return {
    user,
    membership: membershipData,
  };
}

/**
 * Build a project with multiple members
 *
 * @param {Object} options
 * @param {number} [options.memberCount=2] - Number of additional members (besides owner)
 * @param {Object} [options.project] - Project field overrides
 * @returns {Promise<{project: Object, owner: Object, org: Object, members: Array}>}
 */
export async function buildProjectWithMembers(options = {}) {
  const { memberCount = 2, ...projectOptions } = options;

  const { project, owner, org, membership } = await buildProject(projectOptions);

  const members = [{ user: owner, membership, role: 'owner' }];

  for (let i = 0; i < memberCount; i++) {
    const { user, membership } = await buildProjectMember({
      projectId: project.id,
      orgId: org.id,
      role: 'member',
    });
    members.push({ user, membership, role: 'member' });
  }

  return { project, owner, org, members };
}

/**
 * Alias for buildProject - clearer name for common case
 */
export const buildProjectWithOwner = buildProject;
```

### Phase 5: Scenario Factories

**File**: `packages/workers/src/__tests__/factories/scenarios.js`

```javascript
/**
 * Complex test scenario factories
 *
 * These create complete test setups for specific test cases.
 */

import { buildUser } from './user.js';
import { buildOrg, buildOrgMember } from './org.js';
import { buildProject, buildProjectMember, buildProjectWithMembers } from './project.js';

/**
 * Create scenario for testing member removal
 *
 * Returns an owner who can remove a member, and a member who can be removed.
 *
 * @returns {Promise<{project, org, owner, member, ownerMembership, memberMembership}>}
 */
export async function buildMemberRemovalScenario() {
  const { project, owner, org, members } = await buildProjectWithMembers({ memberCount: 1 });

  return {
    project,
    org,
    owner,
    member: members[1].user,
    ownerMembership: members[0].membership,
    memberMembership: members[1].membership,
  };
}

/**
 * Create scenario for testing "last owner" protection
 *
 * Returns a project with only one owner (who cannot be demoted/removed).
 *
 * @returns {Promise<{project, org, owner, membership}>}
 */
export async function buildLastOwnerScenario() {
  const { project, owner, org, membership } = await buildProject();

  return {
    project,
    org,
    owner,
    membership,
    // Helper for assertions
    isLastOwner: true,
  };
}

/**
 * Create scenario for testing owner demotion (multiple owners)
 *
 * Returns a project with two owners (one can be demoted).
 *
 * @returns {Promise<{project, org, owner1, owner2, members}>}
 */
export async function buildMultipleOwnersScenario() {
  const { project, owner, org, membership } = await buildProject();

  // Add second owner
  const { user: owner2, membership: membership2 } = await buildProjectMember({
    projectId: project.id,
    orgId: org.id,
    role: 'owner',
  });

  return {
    project,
    org,
    owner1: owner,
    owner2,
    members: [
      { user: owner, membership, role: 'owner' },
      { user: owner2, membership: membership2, role: 'owner' },
    ],
  };
}

/**
 * Create scenario for testing self-removal
 *
 * Returns a member who can remove themselves from a project.
 *
 * @returns {Promise<{project, org, owner, selfRemover, selfRemoverMembership}>}
 */
export async function buildSelfRemovalScenario() {
  const { project, owner, org } = await buildProject();

  const { user: selfRemover, membership: selfRemoverMembership } = await buildProjectMember({
    projectId: project.id,
    orgId: org.id,
    role: 'member',
  });

  return {
    project,
    org,
    owner,
    selfRemover,
    selfRemoverMembership,
  };
}

/**
 * Create scenario for testing non-member access denial
 *
 * Returns a project and a user who is NOT a member.
 *
 * @returns {Promise<{project, org, owner, nonMember}>}
 */
export async function buildNonMemberScenario() {
  const { project, owner, org } = await buildProject();
  const nonMember = await buildUser();

  return {
    project,
    org,
    owner,
    nonMember,
  };
}

/**
 * Create scenario for testing org role inheritance
 *
 * Returns an org admin who is not a project member.
 *
 * @returns {Promise<{project, org, owner, orgAdmin}>}
 */
export async function buildOrgAdminScenario() {
  const { project, owner, org } = await buildProject();

  const { user: orgAdmin } = await buildOrgMember({
    orgId: org.id,
    role: 'admin',
  });

  return {
    project,
    org,
    owner,
    orgAdmin,
  };
}

/**
 * Create scenario for testing cross-org access denial
 *
 * Returns two separate orgs with projects, for testing isolation.
 *
 * @returns {Promise<{org1, project1, owner1, org2, project2, owner2}>}
 */
export async function buildCrossOrgScenario() {
  const result1 = await buildProject();
  const result2 = await buildProject();

  return {
    org1: result1.org,
    project1: result1.project,
    owner1: result1.owner,
    org2: result2.org,
    project2: result2.project,
    owner2: result2.owner,
  };
}
```

### Phase 6: Subscription/Billing Factories

**File**: `packages/workers/src/__tests__/factories/subscription.js`

```javascript
/**
 * Subscription and billing factories
 */

import { seedSubscription } from '../helpers.js';
import { generateId, nowSec, withDefaults } from './utils.js';
import { buildOrg } from './org.js';

/**
 * Build a subscription for an organization
 *
 * @param {Object} options
 * @param {string} options.orgId - Organization ID
 * @param {string} [options.plan='pro'] - Subscription plan
 * @param {string} [options.status='active'] - Subscription status
 * @returns {Promise<Object>} Subscription data
 */
export async function buildSubscription(options) {
  const { orgId, plan = 'pro', status = 'active' } = options;
  const ts = nowSec();

  const defaults = {
    id: generateId('sub'),
    plan,
    referenceId: orgId,
    status,
    stripeCustomerId: `cus_test_${generateId()}`,
    stripeSubscriptionId: `sub_test_${generateId()}`,
    periodStart: ts,
    periodEnd: ts + 30 * 24 * 60 * 60, // 30 days
    cancelAtPeriodEnd: 0,
    cancelAt: null,
    canceledAt: null,
    endedAt: null,
    seats: 5,
    trialStart: null,
    trialEnd: null,
    createdAt: ts,
    updatedAt: ts,
  };

  const subData = withDefaults(defaults, options);
  await seedSubscription(subData);

  return subData;
}

/**
 * Build an org with an active subscription
 */
export async function buildOrgWithSubscription(options = {}) {
  const { org, owner, membership } = await buildOrg(options);

  const subscription = await buildSubscription({
    orgId: org.id,
    plan: options.plan || 'pro',
    status: 'active',
  });

  return { org, owner, membership, subscription };
}

/**
 * Build an org with expired subscription (read-only mode)
 */
export async function buildOrgWithExpiredSubscription(options = {}) {
  const { org, owner, membership } = await buildOrg(options);
  const ts = nowSec();

  const subscription = await buildSubscription({
    orgId: org.id,
    plan: options.plan || 'pro',
    status: 'past_due',
    periodEnd: ts - 86400, // Expired yesterday
  });

  return { org, owner, membership, subscription };
}

/**
 * Build an org on free tier (no subscription)
 */
export async function buildFreeOrg(options = {}) {
  const { org, owner, membership } = await buildOrg(options);

  // No subscription = free tier
  return { org, owner, membership, subscription: null };
}
```

### Phase 7: Factory Index

**File**: `packages/workers/src/__tests__/factories/index.js`

```javascript
/**
 * Test factories index
 *
 * Usage:
 *   import { buildUser, buildProject, buildMemberRemovalScenario } from '@/__tests__/factories';
 *
 * Or import specific modules:
 *   import { buildUser, buildAdminUser } from '@/__tests__/factories/user';
 */

// Utilities
export {
  generateId,
  nowSec,
  nowDate,
  resetCounter,
} from './utils.js';

// User factories
export {
  buildUser,
  buildAdminUser,
  buildBannedUser,
} from './user.js';

// Organization factories
export {
  buildOrg,
  buildOrgMember,
  buildOrgWithMembers,
} from './org.js';

// Project factories
export {
  buildProject,
  buildProjectWithOwner,
  buildProjectMember,
  buildProjectWithMembers,
} from './project.js';

// Subscription factories
export {
  buildSubscription,
  buildOrgWithSubscription,
  buildOrgWithExpiredSubscription,
  buildFreeOrg,
} from './subscription.js';

// Scenario factories
export {
  buildMemberRemovalScenario,
  buildLastOwnerScenario,
  buildMultipleOwnersScenario,
  buildSelfRemovalScenario,
  buildNonMemberScenario,
  buildOrgAdminScenario,
  buildCrossOrgScenario,
} from './scenarios.js';
```

## Migration Guide

### Before: Current Test Pattern

```javascript
it('should allow owner to remove member', async () => {
  const nowSec = Math.floor(Date.now() / 1000);

  await seedUser({
    id: 'user-1',
    name: 'Owner User',
    email: 'owner@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedUser({
    id: 'user-2',
    name: 'Member User',
    email: 'member@example.com',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedOrganization({
    id: 'org-1',
    name: 'Test Org',
    slug: 'test-org',
    createdAt: nowSec,
  });

  await seedOrgMember({
    id: 'om-1',
    organizationId: 'org-1',
    userId: 'user-1',
    role: 'owner',
    createdAt: nowSec,
  });

  await seedOrgMember({
    id: 'om-2',
    organizationId: 'org-1',
    userId: 'user-2',
    role: 'member',
    createdAt: nowSec,
  });

  await seedProject({
    id: 'project-1',
    name: 'Test Project',
    description: 'A test project',
    orgId: 'org-1',
    createdBy: 'user-1',
    createdAt: nowSec,
    updatedAt: nowSec,
  });

  await seedProjectMember({
    id: 'pm-1',
    projectId: 'project-1',
    userId: 'user-1',
    role: 'owner',
    joinedAt: nowSec,
  });

  await seedProjectMember({
    id: 'pm-2',
    projectId: 'project-1',
    userId: 'user-2',
    role: 'member',
    joinedAt: nowSec,
  });

  const res = await fetchMembers('org-1', 'project-1', '/user-2', {
    method: 'DELETE',
    headers: { 'x-test-user-id': 'user-1' },
  });

  expect(res.status).toBe(200);
});
```

**Lines: 65+**

### After: Factory Pattern

```javascript
it('should allow owner to remove member', async () => {
  const { project, org, owner, member } = await buildMemberRemovalScenario();

  const res = await fetchMembers(org.id, project.id, `/${member.id}`, {
    method: 'DELETE',
    headers: { 'x-test-user-id': owner.id },
  });

  expect(res.status).toBe(200);
});
```

**Lines: 10**

### Reduction: 85% less setup code

## Implementation Order

### Step 1: Create factory utilities
- Create `factories/utils.js`
- Write unit tests for utilities

### Step 2: Create user factory
- Create `factories/user.js`
- Test with existing test file

### Step 3: Create org factory
- Create `factories/org.js`
- Depends on user factory

### Step 4: Create project factory
- Create `factories/project.js`
- Depends on org factory

### Step 5: Create subscription factory
- Create `factories/subscription.js`

### Step 6: Create scenario factories
- Create `factories/scenarios.js`
- Combines other factories

### Step 7: Create index and exports
- Create `factories/index.js`

### Step 8: Migrate one test file (pilot)
- Convert `routes/__tests__/members.test.js`
- Verify no test regressions

### Step 9: Migrate remaining test files
- Convert other test files incrementally
- Keep seed functions for edge cases

### Step 10: Update setup.js
- Add `resetCounter()` to `beforeEach`

## Setup Integration

Update `packages/workers/src/__tests__/setup.js`:

```javascript
import { resetCounter } from './factories/utils.js';

beforeEach(async () => {
  await resetTestDatabase();
  resetCounter(); // Reset factory counters
});
```

## Test File Updates

Update test imports:

```javascript
// Before
import {
  resetTestDatabase,
  seedUser,
  seedProject,
  seedProjectMember,
  seedOrganization,
  seedOrgMember,
  json,
} from '@/__tests__/helpers.js';

// After
import { resetTestDatabase, json } from '@/__tests__/helpers.js';
import {
  buildProject,
  buildProjectWithMembers,
  buildMemberRemovalScenario,
} from '@/__tests__/factories';
```

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Lines per test setup | 30-50 | 3-5 |
| Entity creation calls | 5-8 | 1 |
| Hardcoded IDs | Many | None |
| Timestamp handling | Manual | Automatic |
| Dependency ordering | Manual | Automatic |

## Benefits Summary

1. **Readability** - Tests express intent, not setup mechanics
2. **Maintainability** - Schema changes update in one place
3. **Reliability** - No hardcoded ID collisions
4. **Speed** - Faster to write new tests
5. **Coverage** - Easier to test edge cases with scenario factories

## Appendix: Quick Reference

### Factory Cheat Sheet

```javascript
// Single entities
const user = await buildUser();
const user = await buildUser({ email: 'custom@test.com' });
const admin = await buildAdminUser();

// Org with owner
const { org, owner } = await buildOrg();
const { org, owner, members } = await buildOrgWithMembers({ memberCount: 3 });

// Project with owner
const { project, owner, org } = await buildProject();
const { project, owner, org, members } = await buildProjectWithMembers({ memberCount: 2 });

// Scenarios
const { project, owner, member } = await buildMemberRemovalScenario();
const { project, owner } = await buildLastOwnerScenario();
const { project, owner1, owner2 } = await buildMultipleOwnersScenario();
const { project, owner, nonMember } = await buildNonMemberScenario();

// Billing
const { org, subscription } = await buildOrgWithSubscription();
const { org } = await buildOrgWithExpiredSubscription();
const { org } = await buildFreeOrg();
```

### Common Patterns

```javascript
// Test with specific user as actor
const { project, org, owner } = await buildProject();
const res = await fetch(url, {
  headers: { 'x-test-user-id': owner.id },
});

// Test non-member access
const { project, org, nonMember } = await buildNonMemberScenario();
const res = await fetch(url, {
  headers: { 'x-test-user-id': nonMember.id },
});

// Test with multiple projects
const result1 = await buildProject();
const result2 = await buildProject({ org: result1.org, owner: result1.owner });
```
