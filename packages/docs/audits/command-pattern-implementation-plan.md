# Command Pattern Implementation Plan

## Overview

Extract business logic from route handlers into reusable command functions. This improves testability, reusability, and separation of concerns.

## Current State Analysis

### Problems Identified

1. **Route handlers are too large** - `addMemberRoute` is 200+ lines, `createProjectRoute` is 100+ lines
2. **Business logic mixed with HTTP concerns** - Validation, DB ops, DO sync, notifications all in handlers
3. **Duplicated patterns** - Error handling, DO sync calls, notification sending repeated across routes
4. **Hard to test** - Must mock HTTP context to test business logic
5. **Hard to reuse** - Cannot call project creation from cron jobs, admin scripts, or other contexts

### Current Pattern (Example: Create Project)

```
Route Handler
  - Run middleware (auth, org, entitlement, quota)
  - Validate input
  - Generate IDs
  - Insert project + member (with quota check)
  - Fetch creator details
  - Sync to Durable Object
  - Return response
```

All 80+ lines in a single handler.

## Target Architecture

```
packages/workers/src/
  commands/           # Business logic (NEW)
    projects/
      createProject.js
      updateProject.js
      deleteProject.js
    members/
      addMember.js
      updateMemberRole.js
      removeMember.js
      inviteMember.js
    index.js          # Re-exports
  routes/             # Thin HTTP handlers (existing, refactored)
  lib/                # Shared utilities (existing)
```

## Command Function Design

### Signature Pattern

```javascript
/**
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the action (from auth)
 * @param {Object} params - Command-specific parameters
 * @returns {Promise<Object>} Result object
 * @throws {DomainError} On validation or business rule failures
 */
export async function commandName(env, actor, params) {
  // Implementation
}
```

### Key Principles

1. **No HTTP context** - Commands receive plain objects, not Hono context
2. **Throws domain errors** - Let route handler catch and format response
3. **Returns plain objects** - Not Response objects
4. **Single responsibility** - One command per operation
5. **Explicit dependencies** - Pass env, not c.env

## Implementation Steps

### Phase 1: Project Commands

#### 1.1 Create `createProject` Command

**File**: `packages/workers/src/commands/projects/createProject.js`

**Extract from**: `packages/workers/src/routes/orgs/projects.js` lines 360-480

**Responsibilities**:
- Validate quota (via insertWithQuotaCheck)
- Create project record
- Create owner membership
- Sync to Durable Object

**Interface**:
```javascript
export async function createProject(env, actor, { orgId, name, description }) {
  // Returns: { project, membership }
}
```

**Route handler after**:
```javascript
orgProjectRoutes.openapi(createProjectRoute, async c => {
  // Middleware unchanged
  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const body = c.req.valid('json');

  const { project } = await createProject(c.env, user, {
    orgId,
    name: body.name,
    description: body.description,
  });

  return c.json(project, 201);
});
```

#### 1.2 Create `updateProject` Command

**File**: `packages/workers/src/commands/projects/updateProject.js`

**Extract from**: `packages/workers/src/routes/orgs/projects.js` lines 528-575

**Responsibilities**:
- Update project record
- Sync changes to Durable Object

**Interface**:
```javascript
export async function updateProject(env, actor, { projectId, name, description }) {
  // Returns: { projectId, updated: true }
}
```

#### 1.3 Create `deleteProject` Command

**File**: `packages/workers/src/commands/projects/deleteProject.js`

**Extract from**: `packages/workers/src/routes/orgs/projects.js` lines 577-684

**Responsibilities**:
- Disconnect all users from ProjectDoc DO
- Clean up R2 storage (PDFs)
- Delete project record (cascades to members)
- Send notifications to members

**Interface**:
```javascript
export async function deleteProject(env, actor, { projectId }) {
  // Returns: { deleted: projectId, notifiedCount: number }
}
```

### Phase 2: Member Commands

#### 2.1 Create `addMember` Command

**File**: `packages/workers/src/commands/members/addMember.js`

**Extract from**: `packages/workers/src/routes/members.js` lines 339-665

**Split into two commands** (this handler does too much):

1. `addMember` - Add existing user to project
2. `inviteMember` - Send invitation to non-user

**addMember Interface**:
```javascript
export async function addMember(env, actor, { projectId, userId, role }) {
  // Returns: { member: { userId, role, joinedAt, ... } }
}
```

#### 2.2 Create `inviteMember` Command

**File**: `packages/workers/src/commands/members/inviteMember.js`

**Responsibilities**:
- Create/update invitation record
- Generate magic link
- Queue invitation email

**Interface**:
```javascript
export async function inviteMember(env, actor, { projectId, email, role }) {
  // Returns: { invitation: true, email }
}
```

#### 2.3 Create `updateMemberRole` Command

**File**: `packages/workers/src/commands/members/updateMemberRole.js`

**Extract from**: `packages/workers/src/routes/members.js` lines 667-731

**Responsibilities**:
- Validate not demoting last owner
- Update role
- Sync to DO

**Interface**:
```javascript
export async function updateMemberRole(env, actor, { projectId, userId, role }) {
  // Returns: { userId, role }
}
```

#### 2.4 Create `removeMember` Command

**File**: `packages/workers/src/commands/members/removeMember.js`

**Extract from**: `packages/workers/src/routes/members.js` lines 733-834

**Responsibilities**:
- Validate not removing last owner
- Delete membership
- Sync to DO
- Send notification (if not self-removal)

**Interface**:
```javascript
export async function removeMember(env, actor, { projectId, userId, isSelfRemoval }) {
  // Returns: { removed: userId }
}
```

### Phase 3: Shared Utilities

#### 3.1 Create DO Sync Helper

**File**: `packages/workers/src/commands/lib/doSync.js`

Consolidate DO sync logic used across commands:

```javascript
export async function syncProjectMeta(env, projectId, meta) { ... }
export async function syncProjectMember(env, projectId, action, member) { ... }
export async function disconnectAllFromProject(env, projectId) { ... }
```

#### 3.2 Create Notification Helper

**File**: `packages/workers/src/commands/lib/notifications.js`

Consolidate notification sending:

```javascript
export async function notifyUser(env, userId, notification) { ... }
export async function notifyProjectMembers(env, projectId, notification, excludeUserId) { ... }
```

### Phase 4: Additional Commands (Lower Priority)

Based on route complexity, these would also benefit from extraction:

| Route File | Handler | Complexity | Priority |
|------------|---------|------------|----------|
| `billing/checkout.js` | createCheckoutSession | High | Medium |
| `billing/grants.js` | createGrant | Medium | Low |
| `orgs/invitations.js` | acceptInvitation | High | Medium |
| `google-drive.js` | importFromDrive | High | Medium |
| `account-merge.js` | mergeAccounts | High | High |

## Testing Strategy

### Command Unit Tests

Each command gets its own test file:

```javascript
// packages/workers/src/commands/projects/__tests__/createProject.test.js

describe('createProject', () => {
  test('creates project with owner membership', async () => {
    const env = await setupTestEnv();
    const user = await buildUser(env.DB);
    const org = await buildOrg(env.DB, { ownerId: user.id });

    const result = await createProject(env, user, {
      orgId: org.id,
      name: 'Test Project',
      description: 'Test description',
    });

    expect(result.project.name).toBe('Test Project');
    expect(result.project.orgId).toBe(org.id);

    // Verify membership created
    const membership = await getProjectMembership(env.DB, result.project.id, user.id);
    expect(membership.role).toBe('owner');
  });

  test('throws when quota exceeded', async () => {
    const env = await setupTestEnv();
    const user = await buildUser(env.DB);
    const org = await buildOrg(env.DB, { ownerId: user.id, projectQuota: 0 });

    await expect(
      createProject(env, user, { orgId: org.id, name: 'Test' })
    ).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });

  test('syncs to Durable Object', async () => {
    // Test DO sync was called with correct data
  });
});
```

### Route Integration Tests

Keep existing route tests, but they become simpler since business logic is tested in command tests:

```javascript
// packages/workers/src/routes/__tests__/projects.test.js

describe('POST /api/orgs/:orgId/projects', () => {
  test('returns 201 with project data', async () => {
    // Test HTTP layer only
  });

  test('returns 403 when not org member', async () => {
    // Test middleware
  });

  test('returns 400 on invalid input', async () => {
    // Test validation
  });
});
```

## File Structure After Implementation

```
packages/workers/src/
  commands/
    projects/
      createProject.js
      updateProject.js
      deleteProject.js
      __tests__/
        createProject.test.js
        updateProject.test.js
        deleteProject.test.js
      index.js
    members/
      addMember.js
      inviteMember.js
      updateMemberRole.js
      removeMember.js
      __tests__/
        addMember.test.js
        inviteMember.test.js
        updateMemberRole.test.js
        removeMember.test.js
      index.js
    lib/
      doSync.js
      notifications.js
      __tests__/
        doSync.test.js
        notifications.test.js
    index.js
  routes/
    ... (existing, refactored to use commands)
```

## Implementation Order

### Step 1: Create directory structure
- Create `commands/` directory
- Create subdirectories for `projects/`, `members/`, `lib/`

### Step 2: Extract `createProject` (pilot)
- Implement command
- Write tests
- Refactor route handler
- Verify no regressions

### Step 3: Extract remaining project commands
- `updateProject`
- `deleteProject`

### Step 4: Extract member commands
- `addMember`
- `inviteMember` (split from addMember)
- `updateMemberRole`
- `removeMember`

### Step 5: Consolidate shared utilities
- `doSync.js`
- `notifications.js`

### Step 6: Documentation
- Update API development guide
- Add command pattern section to docs

## Success Metrics

1. **Route handlers under 30 lines** - Focus on HTTP concerns only
2. **Command functions under 50 lines** - Single responsibility
3. **Test coverage for commands** - Each command has unit tests
4. **Reusable** - Commands can be called from routes, tests, scripts

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking changes during refactor | Implement one command at a time, run full test suite |
| Performance regression | Commands are pure functions, no additional overhead |
| Team adoption | Document pattern, provide examples |
| Over-engineering | Only extract complex handlers (50+ lines) |

## Open Questions

1. **Transaction handling** - Should commands manage their own transactions, or should callers wrap in transactions?
   - Recommendation: Commands manage own transactions for atomic operations

2. **Error types** - Should commands throw domain errors or return result objects?
   - Recommendation: Throw domain errors, route handlers catch and format

3. **Logging** - Should commands log, or leave to route handlers?
   - Recommendation: Commands log business events, routes log HTTP events

## Appendix: Example Full Implementation

### createProject.js

```javascript
/**
 * Create a new project within an organization
 *
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User creating the project
 * @param {Object} params - Creation parameters
 * @param {string} params.orgId - Organization ID
 * @param {string} params.name - Project name
 * @param {string} [params.description] - Project description
 * @returns {Promise<{ project: Object }>}
 * @throws {DomainError} QUOTA_EXCEEDED if org at project limit
 * @throws {DomainError} DB_TRANSACTION_FAILED on database error
 */
export async function createProject(env, actor, { orgId, name, description }) {
  const db = createDb(env.DB);

  const projectId = crypto.randomUUID();
  const memberId = crypto.randomUUID();
  const now = new Date();

  const insertStatements = [
    db.insert(projects).values({
      id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      orgId,
      createdBy: actor.id,
      createdAt: now,
      updatedAt: now,
    }),
    db.insert(projectMembers).values({
      id: memberId,
      projectId,
      userId: actor.id,
      role: 'owner',
      joinedAt: now,
    }),
  ];

  const result = await insertWithQuotaCheck(db, {
    orgId,
    quotaKey: 'projects.max',
    countTable: projects,
    countColumn: projects.orgId,
    insertStatements,
  });

  if (!result.success) {
    throw result.error;
  }

  // Fetch creator details for DO sync
  const creator = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      displayName: user.displayName,
      image: user.image,
    })
    .from(user)
    .where(eq(user.id, actor.id))
    .get();

  // Sync to Durable Object (non-blocking)
  try {
    await syncProjectToDO(
      env,
      projectId,
      {
        name: name.trim(),
        description: description?.trim() || null,
        orgId,
        createdAt: now.getTime(),
        updatedAt: now.getTime(),
      },
      [
        {
          userId: actor.id,
          role: 'owner',
          joinedAt: now.getTime(),
          name: creator?.name || null,
          email: creator?.email || null,
          displayName: creator?.displayName || null,
          image: creator?.image || null,
        },
      ],
    );
  } catch (err) {
    console.error('Failed to sync project to DO:', err);
  }

  return {
    project: {
      id: projectId,
      name: name.trim(),
      description: description?.trim() || null,
      orgId,
      createdBy: actor.id,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    },
  };
}
```

### Refactored Route Handler

```javascript
orgProjectRoutes.openapi(createProjectRoute, async c => {
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  const writeAccessResponse = await runMiddleware(requireOrgWriteAccess(), c);
  if (writeAccessResponse) return writeAccessResponse;

  const entitlementResponse = await runMiddleware(requireEntitlement('project.create'), c);
  if (entitlementResponse) return entitlementResponse;

  const quotaResponse = await runMiddleware(requireQuota('projects.max', getProjectCount, 1), c);
  if (quotaResponse) return quotaResponse;

  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const body = c.req.valid('json');

  try {
    const { project } = await createProject(c.env, user, {
      orgId,
      name: body.name,
      description: body.description,
    });

    return c.json(project, 201);
  } catch (error) {
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }
    console.error('Error creating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

Route handler goes from 120 lines to 35 lines.
