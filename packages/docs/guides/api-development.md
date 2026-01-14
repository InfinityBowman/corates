# API Development Guide

This guide covers how to develop API routes in the CoRATES Workers backend, including validation, database operations, error handling, and middleware patterns.

## Overview

API routes in CoRATES are built with **OpenAPIHono** (Hono with OpenAPI/Zod integration), using Zod for both validation and OpenAPI schema generation, Drizzle ORM for database operations, and consistent patterns for authentication, authorization, and error handling.

## Route Structure

### OpenAPIHono Pattern

All routes now use `OpenAPIHono` with `createRoute` for type-safe request/response schemas:

```js
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { createDomainError, createValidationError, PROJECT_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { createDb } from '@/db/client.js';

const routes = new OpenAPIHono({
  // Default validation error handler
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const fieldName = String(field).charAt(0).toUpperCase() + String(field).slice(1);

      let message = firstIssue?.message || 'Validation failed';
      const isMissing =
        firstIssue?.received === 'undefined' || message.includes('received undefined') || message.includes('Required');

      if (isMissing) {
        message = `${fieldName} is required`;
      }

      const error = createValidationError(String(field), VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
      error.message = message;
      return c.json(error, 400);
    }
  },
});

// Apply auth middleware to all routes
routes.use('*', requireAuth);

// Define request/response schemas
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: 'My Project' }),
    description: z.string().max(500).optional().openapi({ example: 'Project description' }),
  })
  .openapi('CreateProjectRequest');

const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    role: z.string(),
    createdAt: z.string().or(z.date()),
  })
  .openapi('Project');

const ErrorSchema = z
  .object({
    code: z.string(),
    message: z.string(),
    statusCode: z.number(),
    details: z.record(z.unknown()).optional(),
  })
  .openapi('ProjectError');

// Define route with OpenAPI spec
const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create project',
  description: 'Create a new project',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProjectRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project created',
    },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Validation error',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database error',
    },
  },
});

// Implement route handler
routes.openapi(createProjectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const data = c.req.valid('json'); // Type-safe validated data

  try {
    const result = await db.insert(projects).values({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      createdBy: user.id,
    });

    return c.json(result, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { routes as projectRoutes };
```

### Middleware Chain Order

Order matters when applying middleware:

1. **Authentication** (`requireAuth`) - Verify user is logged in
2. **Organization membership** (`requireOrgMembership`) - Check org access and role
3. **Project access** (`requireProjectAccess`) - Check project access and role
4. **Authorization** (`requireEntitlement`, `requireQuota`) - Check subscription permissions
5. **Route handler** - Business logic (validation handled by OpenAPIHono)

```js
// Note: Middleware applied via routes.use() or in route definition
routes.use('*', requireAuth);

// For org-scoped routes
orgProjectRoutes.post(
  '/',
  requireOrgMembership(),
  requireProjectAccess('member'),
  requireEntitlement('project.update'),
  async c => {
    // Handler - request body already validated by OpenAPIHono
    const data = c.req.valid('json');
  },
);
```

## Command Pattern

For complex write operations, we use the **command pattern** to separate business logic from HTTP routing. Commands are pure functions that encapsulate domain operations, making them testable, reusable, and framework-agnostic.

### When to Use Commands

Use commands for operations that:

- Modify state (create, update, delete)
- Have complex business logic (validation, notifications, syncing)
- Need to be reusable across multiple routes or contexts
- Require multiple database operations or side effects

Keep simple read operations (GET endpoints) in route handlers.

### Command Function Signature

All commands follow a consistent signature:

```js
/**
 * @param {Object} env - Cloudflare environment bindings
 * @param {Object} actor - User performing the action
 * @param {Object} params - Operation parameters
 * @returns {Promise<Object>} Result object
 * @throws {DomainError} On business rule violations
 */
export async function commandName(env, actor, params) {
  // Implementation
}
```

- **env**: Cloudflare environment (DB, Durable Objects, R2, etc.)
- **actor**: The authenticated user performing the action (from `getAuth(c).user`)
- **params**: Operation-specific parameters (validated by route before calling)
- **Returns**: Plain object with operation results
- **Throws**: Domain errors for business rule violations (not HTTP errors)

### Directory Structure

Commands are organized by domain in `packages/workers/src/commands/`:

```
commands/
  lib/                    # Shared utilities
    doSync.js            # DO sync helpers
    notifications.js     # User notification helpers
    index.js
  projects/
    createProject.js
    updateProject.js
    deleteProject.js
    index.js
  members/
    addMember.js
    updateMemberRole.js
    removeMember.js
    index.js
  index.js               # Re-exports all commands
```

### Creating a Command

```js
// commands/projects/createProject.js

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
 */

import { createDb } from '@/db/client.js';
import { projects, projectMembers } from '@/db/schema.js';
import { insertWithQuotaCheck } from '@/lib/quotaTransaction.js';
import { syncProjectToDO } from '@/commands/lib/doSync.js';

export async function createProject(env, actor, { orgId, name, description }) {
  const db = createDb(env.DB);

  const projectId = crypto.randomUUID();
  const now = new Date();
  const trimmedName = name.trim();

  // Business logic: quota check and atomic insert
  const quotaResult = await insertWithQuotaCheck(db, {
    orgId,
    quotaKey: 'projects.max',
    countTable: projects,
    countColumn: projects.orgId,
    insertStatements: [
      db.insert(projects).values({
        id: projectId,
        name: trimmedName,
        description: description?.trim() || null,
        orgId,
        createdBy: actor.id,
        createdAt: now,
        updatedAt: now,
      }),
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId,
        userId: actor.id,
        role: 'owner',
        joinedAt: now,
      }),
    ],
  });

  if (!quotaResult.success) {
    throw quotaResult.error; // DomainError
  }

  // Side effect: sync to Durable Object
  try {
    await syncProjectToDO(env, projectId, { name: trimmedName, orgId }, [
      { userId: actor.id, role: 'owner', joinedAt: now.getTime() },
    ]);
  } catch (err) {
    console.error('Failed to sync project to DO:', err);
  }

  return {
    project: {
      id: projectId,
      name: trimmedName,
      orgId,
      createdBy: actor.id,
      role: 'owner',
      createdAt: now,
    },
  };
}
```

### Using Commands in Routes

Routes handle HTTP concerns (validation, auth, response formatting) and delegate to commands:

```js
import { createProject } from '@/commands/projects/index.js';
import { isDomainError, createDomainError, SYSTEM_ERRORS } from '@corates/shared';

orgProjectRoutes.openapi(createProjectRoute, async c => {
  // 1. Run middleware (auth, membership, entitlements)
  const membershipResponse = await runMiddleware(requireOrgMembership(), c);
  if (membershipResponse) return membershipResponse;

  // 2. Get context from middleware
  const { user: authUser } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const body = c.req.valid('json'); // Already validated by OpenAPIHono

  // 3. Call command
  try {
    const { project } = await createProject(c.env, authUser, {
      orgId,
      name: body.name,
      description: body.description,
    });

    return c.json(project, 201);
  } catch (error) {
    // 4. Handle domain errors
    if (isDomainError(error)) {
      return c.json(error, error.statusCode);
    }

    // 5. Wrap unexpected errors
    console.error('Error creating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_TRANSACTION_FAILED, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

### Shared Utilities

Commands use shared utilities from `@/commands/lib/`:

#### DO Sync (`doSync.js`)

```js
import {
  syncProjectToDO, // Sync project metadata and members
  syncMemberToDO, // Sync member changes (add/update/remove)
  disconnectAllFromProject, // Disconnect all users from ProjectDoc DO
  cleanupProjectStorage, // Clean up R2 storage for a project
} from '@/commands/lib/doSync.js';

// Sync member addition
await syncMemberToDO(env, projectId, 'add', {
  userId: user.id,
  role: 'member',
  joinedAt: Date.now(),
});

// Sync member role update
await syncMemberToDO(env, projectId, 'update', { userId, role: 'owner' });

// Sync member removal
await syncMemberToDO(env, projectId, 'remove', { userId });
```

#### Notifications (`notifications.js`)

```js
import {
  notifyUser, // Send notification to single user
  notifyUsers, // Send notification to multiple users
  NotificationTypes, // Type constants
} from '@/commands/lib/notifications.js';

// Notify single user
await notifyUser(env, userId, {
  type: NotificationTypes.PROJECT_MEMBERSHIP_ADDED,
  projectId,
  projectName: 'My Project',
  role: 'member',
});

// Notify multiple users (with exclusion)
const userIds = members.map(m => m.userId);
await notifyUsers(
  env,
  userIds,
  {
    type: NotificationTypes.PROJECT_DELETED,
    projectId,
    projectName: 'Deleted Project',
  },
  excludeUserId, // Don't notify this user (e.g., the actor)
);
```

#### Notification Types

```js
export const NotificationTypes = {
  PROJECT_DELETED: 'project-deleted',
  PROJECT_MEMBERSHIP_ADDED: 'project-membership-added',
  PROJECT_MEMBERSHIP_UPDATED: 'project-membership-updated',
  PROJECT_MEMBERSHIP_REMOVED: 'project-membership-removed',
};
```

### Error Handling in Commands

Commands throw domain errors for business rule violations:

```js
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

export async function removeMember(env, actor, { projectId, userId }) {
  // Check if member exists
  const member = await db.select()...;
  if (!member) {
    throw createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId, userId });
  }

  // Check last owner constraint
  if (member.role === 'owner' && ownerCount <= 1) {
    throw createDomainError(PROJECT_ERRORS.LAST_OWNER, { projectId });
  }

  // ... perform operation
}
```

Routes catch these errors and convert to HTTP responses:

```js
try {
  const result = await removeMember(c.env, authUser, params);
  return c.json(result);
} catch (error) {
  if (isDomainError(error)) {
    return c.json(error, error.statusCode);
  }
  // Handle unexpected errors...
}
```

### Testing Commands

Commands can be unit tested without HTTP context:

```js
import { describe, it, expect, vi } from 'vitest';
import { createProject } from '../createProject.js';

describe('createProject', () => {
  it('should create project and return result', async () => {
    const mockEnv = createMockEnv();
    const actor = { id: 'user-1', name: 'Test User' };

    const { project } = await createProject(mockEnv, actor, {
      orgId: 'org-1',
      name: 'Test Project',
    });

    expect(project.name).toBe('Test Project');
    expect(project.createdBy).toBe('user-1');
  });

  it('should throw QUOTA_EXCEEDED when at limit', async () => {
    const mockEnv = createMockEnvAtQuotaLimit();
    const actor = { id: 'user-1' };

    await expect(createProject(mockEnv, actor, { orgId: 'org-1', name: 'Project' })).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    });
  });
});
```

### Best Practices

**DO:**

- Keep commands focused on a single operation
- Use JSDoc comments to document parameters and errors
- Import shared utilities from `@/commands/lib/`
- Throw domain errors for business rule violations
- Wrap side effects (DO sync, notifications) in try-catch
- Return plain objects (not HTTP responses)

**DON'T:**

- Access Hono context (`c`) in commands
- Return HTTP status codes or Response objects
- Catch and suppress errors silently
- Put HTTP routing logic in commands
- Skip documentation for public command functions

## Organization-Scoped Routes

All project routes are now scoped under organizations. See the [Organizations Guide](/guides/organizations) for complete details.

### Route Structure

```text
/api/orgs/:orgId/projects/:projectId/...
```

### Org Membership Middleware

Use `requireOrgMembership` to verify org access:

```js
import { requireOrgMembership, getOrgContext } from '../middleware/requireOrg.js';

// Any org member
orgRoutes.get('/', requireOrgMembership(), async c => {
  const { orgId, orgRole, org } = getOrgContext(c);
  // ...
});

// Minimum role required
orgRoutes.put('/:orgId', requireOrgMembership('admin'), async c => {
  // Only org admins and owners
});
```

### Project Access Middleware

Use `requireProjectAccess` after `requireOrgMembership`:

```js
import { requireOrgMembership, requireProjectAccess, getProjectContext } from '../middleware/requireOrg.js';

// Any project member
projectRoutes.get('/:projectId', requireOrgMembership(), requireProjectAccess(), async c => {
  const { projectId, projectRole, project } = getProjectContext(c);
  // ...
});

// Minimum role required
projectRoutes.delete('/:projectId', requireOrgMembership(), requireProjectAccess('owner'), async c => {
  // Only project owners
});
```

### Org-Scoped Route Example

```js
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '@/middleware/requireOrg.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { createDomainError, createValidationError, SYSTEM_ERRORS, VALIDATION_ERRORS } from '@corates/shared';
import { createDb } from '@/db/client.js';

const orgProjectRoutes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const field = firstIssue?.path?.[0] || 'input';
      const error = createValidationError(String(field), VALIDATION_ERRORS.FIELD_REQUIRED.code, null);
      return c.json(error, 400);
    }
  },
});

// Auth middleware for all routes
orgProjectRoutes.use('*', requireAuth);

// Request schema
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).openapi({ example: 'My Project' }),
    description: z.string().optional(),
  })
  .openapi('CreateProjectRequest');

// Route definition
const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create project in org',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      /* ... */
    },
    500: {
      /* ... */
    },
  },
});

// Route implementation with middleware
orgProjectRoutes.openapi(createProjectRoute, requireOrgMembership(), requireEntitlement('project.create'), async c => {
  const { user } = getAuth(c);
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const { name, description } = c.req.valid('json');

  try {
    const projectId = crypto.randomUUID();
    await db.batch([
      db.insert(projects).values({
        id: projectId,
        name,
        description,
        orgId,
        createdBy: user.id,
      }),
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId,
        userId: user.id,
        role: 'owner',
      }),
    ]);

    return c.json({ id: projectId, name, orgId }, 201);
  } catch (error) {
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

## Request Validation

### OpenAPIHono Validation

**Request validation is built into OpenAPIHono via Zod schemas.** The `defaultHook` handles validation errors automatically.

```js
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';

const routes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) {
      // Handle validation errors
      const error = createValidationError(/* ... */);
      return c.json(error, 400);
    }
  },
});

// Define schema with OpenAPI metadata
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: 'My Project' }),
    email: z.string().email().openapi({ example: 'user@example.com' }),
    age: z.number().int().positive().optional(),
  })
  .openapi('CreateProjectRequest');

// Use in route definition
const createRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: { 'application/json': { schema: CreateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    /* ... */
  },
});

// Access validated data in handler
routes.openapi(createRoute, async c => {
  const data = c.req.valid('json'); // Type-safe validated data
  // Use data.name, data.email, etc.
});
```

### Query Parameter Validation

Define query parameters in the route schema:

```js
const listProjectsRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: z.object({
      page: z.coerce.number().int().positive().optional().default(1),
      limit: z.coerce.number().int().positive().max(100).optional().default(20),
      search: z.string().optional(),
    }),
  },
  responses: {
    /* ... */
  },
});

routes.openapi(listProjectsRoute, async c => {
  const { page, limit, search } = c.req.valid('query');
  // Use validated query params
});
```

### Path Parameter Validation

Define path parameters in the route:

```js
const getProjectRoute = createRoute({
  method: 'get',
  path: '/{projectId}',
  request: {
    params: z.object({
      projectId: z.string().min(1),
    }),
  },
  responses: {
    /* ... */
  },
});

routes.openapi(getProjectRoute, async c => {
  const { projectId } = c.req.valid('param');
});
```

## Database Operations

### Database Client

Always create DB client from environment:

```js
import { createDb } from '../db/client.js';

async c => {
  const db = createDb(c.env.DB);
  // Use db
};
```

### Batch Operations for Atomicity

**Use `db.batch()` for related operations that must be atomic:**

```js
// CORRECT - Atomic operations
const batchOps = [
  db.insert(projects).values({ id, name, createdBy }),
  db.insert(projectMembers).values({ projectId: id, userId, role: 'owner' }),
];
await db.batch(batchOps);

// WRONG - Not atomic
await db.insert(projects).values({ id, name });
await db.insert(projectMembers).values({ projectId: id, userId });
```

Use batch when operations must succeed or fail together. Single independent operations don't need batch.

### Drizzle Query Patterns

Always use Drizzle ORM - never raw SQL:

```js
// CORRECT
import { eq, and, count } from 'drizzle-orm';

const result = await db
  .select()
  .from(projects)
  .where(and(eq(projects.id, projectId), eq(projects.createdBy, userId)))
  .get();

// WRONG
const result = await db.prepare('SELECT * FROM projects WHERE id = ?').bind(projectId).first();
```

### Common Query Patterns

```js
// Get single record
const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

// Get multiple records
const allProjects = await db.select().from(projects).where(eq(projects.createdBy, userId)).all();

// Count records
const projectCount = await db.select({ count: count() }).from(projects).where(eq(projects.createdBy, userId)).get();

// Update record
await db.update(projects).set({ name: newName, updatedAt: new Date() }).where(eq(projects.id, projectId));

// Delete record
await db.delete(projects).where(eq(projects.id, projectId));

// Join query
const projectWithMembers = await db
  .select({
    project: projects,
    member: projectMembers,
  })
  .from(projects)
  .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
  .where(eq(projects.id, projectId))
  .all();
```

## Error Handling

### Creating Domain Errors

**Always use `createDomainError` from `@corates/shared`:**

```js
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

// CORRECT
if (!project) {
  const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
  return c.json(error, error.statusCode);
}

// WRONG
if (!project) {
  return c.json({ error: 'Project not found' }, 404);
}
```

### Error Constants

Use predefined error constants from `@corates/shared`:

- `PROJECT_ERRORS.*` - Project-related errors
- `AUTH_ERRORS.*` - Authentication/authorization errors
- `VALIDATION_ERRORS.*` - Validation errors (automatically created by middleware)
- `SYSTEM_ERRORS.*` - System/database errors
- `USER_ERRORS.*` - User-related errors

### Database Errors

Wrap database operations in try-catch and return domain errors:

```js
try {
  const result = await db.select()...
} catch (error) {
  console.error('Error fetching project:', error);
  const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
    operation: 'fetch_project',
    originalError: error.message,
  });
  return c.json(dbError, dbError.statusCode);
}
```

### Never Throw String Literals

```js
// WRONG
throw 'Something went wrong';

// CORRECT
throw new Error('Something went wrong');
// Or better: return domain error in API route
```

## Authentication

### requireAuth Middleware

Use `requireAuth` to protect routes:

```js
import { requireAuth, getAuth } from '@/middleware/auth.js';

// In route file
routes.use('*', requireAuth);

// Or per-route
routes.get('/protected', requireAuth, async c => {
  const { user } = getAuth(c);
  // User is authenticated
});
```

### Getting Authenticated User

Use `getAuth` helper after `requireAuth`:

```js
import { getAuth } from '@/middleware/auth.js';

routes.get('/me', async c => {
  const { user, session } = getAuth(c);
  return c.json({ user });
});
```

### Optional Authentication

Use `authMiddleware` (not `requireAuth`) for routes that work with or without auth:

```js
import { authMiddleware } from '@/middleware/auth.js';

routes.use('*', authMiddleware);

routes.get('/public', async c => {
  const { user } = getAuth(c);
  if (user) {
    // Authenticated user
  } else {
    // Anonymous user
  }
});
```

## Authorization

### Entitlements

Check user entitlements (subscription-based permissions):

```js
import { requireEntitlement } from '../middleware/entitlements.js';

routes.post('/', requireAuth, requireEntitlement('project.create'), validateRequest(projectSchemas.create), async c => {
  // User has entitlement, proceed
});
```

### Quotas

Check user quotas (usage limits):

```js
import { requireQuota } from '../middleware/entitlements.js';

async function getProjectCount(userId) {
  const db = createDb(c.env.DB);
  // Return current count
}

routes.post(
  '/',
  requireAuth,
  requireQuota('projects.max', getProjectCount, 1),
  validateRequest(projectSchemas.create),
  async c => {
    // User has quota, proceed
  },
);
```

## Route Examples

### GET Route with OpenAPIHono

```js
// Response schema
const ProjectSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    description: z.string().nullable(),
  })
  .openapi('Project');

// Route definition
const getProjectRoute = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Projects'],
  summary: 'Get project by ID',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project found',
    },
    404: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Project not found',
    },
  },
});

// Handler
routes.openapi(getProjectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const { id: projectId } = c.req.valid('param');

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!project) {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
    return c.json(error, error.statusCode);
  }

  // Check access
  const member = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
    .get();

  if (!member) {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode);
  }

  return c.json(project);
});
```

### POST Route with Validation

```js
const CreateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).openapi({ example: 'My Project' }),
    description: z.string().max(500).optional(),
  })
  .openapi('CreateProjectRequest');

const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create project',
  security: [{ cookieAuth: [] }],
  request: {
    body: {
      content: { 'application/json': { schema: CreateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    201: { content: { 'application/json': { schema: ProjectSchema } }, description: 'Created' },
    400: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Validation error',
    },
    500: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Database error',
    },
  },
});

routes.openapi(createProjectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const data = c.req.valid('json'); // Validated data

  const projectId = crypto.randomUUID();

  try {
    // Batch operations for atomicity
    await db.batch([
      db.insert(projects).values({
        id: projectId,
        name: data.name,
        description: data.description,
        createdBy: user.id,
      }),
      db.insert(projectMembers).values({
        id: crypto.randomUUID(),
        projectId,
        userId: user.id,
        role: 'owner',
      }),
    ]);

    const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();
    return c.json(project, 201);
  } catch (error) {
    console.error('Error creating project:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_project',
      originalError: error.message,
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

### PATCH Route

```js
const UpdateProjectRequestSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).optional(),
  })
  .openapi('UpdateProjectRequest');

const updateProjectRoute = createRoute({
  method: 'patch',
  path: '/{id}',
  tags: ['Projects'],
  summary: 'Update project',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      content: { 'application/json': { schema: UpdateProjectRequestSchema } },
      required: true,
    },
  },
  responses: {
    200: { content: { 'application/json': { schema: ProjectSchema } }, description: 'Updated' },
    403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Access denied' },
  },
});

routes.openapi(updateProjectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const { id: projectId } = c.req.valid('param');
  const data = c.req.valid('json');

  // Check access and ownership
  const member = await db
    .select()
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, user.id)))
    .get();

  if (!member || member.role !== 'owner') {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode);
  }

  // Build update object (only include provided fields)
  const updates = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;

  await db
    .update(projects)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  const updated = await db.select().from(projects).where(eq(projects.id, projectId)).get();
  return c.json(updated);
});
```

### DELETE Route

```js
const DeleteSuccessSchema = z
  .object({
    success: z.literal(true),
    deleted: z.string(),
  })
  .openapi('DeleteSuccess');

const deleteProjectRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Projects'],
  summary: 'Delete project',
  security: [{ cookieAuth: [] }],
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      content: { 'application/json': { schema: DeleteSuccessSchema } },
      description: 'Deleted',
    },
    404: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Not found' },
    403: { content: { 'application/json': { schema: ErrorSchema } }, description: 'Access denied' },
  },
});

routes.openapi(deleteProjectRoute, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const { id: projectId } = c.req.valid('param');

  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!project) {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
    return c.json(error, error.statusCode);
  }

  if (project.createdBy !== user.id) {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode);
  }

  await db.delete(projects).where(eq(projects.id, projectId));
  return c.json({ success: true, deleted: projectId });
});
```

## Project Invitations

The invitation system allows project owners to invite users who don't have accounts yet. Invitations use a combined flow that ensures org membership before project membership.

### Creating Invitations

When adding a member via `POST /api/orgs/{orgId}/projects/{projectId}/members`, if the user doesn't exist and an email is provided:

1. Check for existing pending invitation for the email/project
2. If pending invitation exists: resend it (update role, extend expiration)
3. If invitation already accepted: return `PROJECT_INVITATION_ALREADY_ACCEPTED` error
4. If no invitation exists: create new invitation with 7-day expiration

```js
// Example: Creating invitation when user doesn't exist
if (!userToAdd && email) {
  const existingInvitation = await db
    .select()
    .from(projectInvitations)
    .where(and(eq(projectInvitations.projectId, projectId), eq(projectInvitations.email, email.toLowerCase())))
    .get();

  if (existingInvitation && !existingInvitation.acceptedAt) {
    // Resend existing invitation
    await db
      .update(projectInvitations)
      .set({
        role,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      })
      .where(eq(projectInvitations.id, existingInvitation.id));
  } else {
    // Create new invitation
    const token = crypto.randomUUID();
    await db.insert(projectInvitations).values({
      id: crypto.randomUUID(),
      projectId,
      email: email.toLowerCase(),
      role,
      token,
      invitedBy: authUser.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
    });
  }
}
```

### Magic Link Generation

Invitations use Better Auth's magic link system. The magic link URL is generated using Better Auth's API with a custom `sendMagicLink` hook to capture the URL without sending email:

```js
import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { drizzle } from 'drizzle-orm/d1';

// Create temporary auth instance with custom hook
const tempAuth = betterAuth({
  database: drizzleAdapter(db, { provider: 'sqlite', schema }),
  baseURL: authBaseUrl,
  secret: authSecret,
  plugins: [
    magicLink({
      sendMagicLink: async ({ url }) => {
        // Capture URL instead of sending email
        capturedMagicLinkUrl = url;
      },
      expiresIn: 60 * MAGIC_LINK_EXPIRY_MINUTES,
    }),
  ],
});

// Generate magic link
await tempAuth.api.signInMagicLink({
  body: {
    email: email.toLowerCase(),
    callbackURL: `${appUrl}/complete-profile?invitation=${token}`,
    newUserCallbackURL: `${appUrl}/complete-profile?invitation=${token}`,
  },
  headers: new Headers(),
});
```

### Sending Invitation Emails

Invitation emails are sent via the EMAIL_QUEUE Durable Object:

```js
import { getProjectInvitationEmailHtml, getProjectInvitationEmailText } from '../auth/emailTemplates.js';
import { escapeHtml } from '../lib/escapeHtml.js';

const emailHtml = getProjectInvitationEmailHtml({
  projectName: escapeHtml(project.name),
  inviterName: escapeHtml(inviter.displayName || inviter.name),
  invitationUrl: magicLinkUrl,
  role,
});

const queueId = c.env.EMAIL_QUEUE.idFromName('default');
const queue = c.env.EMAIL_QUEUE.get(queueId);
await queue.fetch(
  new Request('https://internal/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: email,
      subject: `You're Invited to "${escapeHtml(project.name)}" - CoRATES`,
      html: emailHtml,
      text: getProjectInvitationEmailText({ ... }),
    }),
  }),
);
```

### Accepting Invitations

The invitation acceptance endpoint (`POST /api/invitations/accept`) validates:

1. Token exists and is valid
2. Invitation hasn't expired
3. Invitation hasn't been accepted
4. Authenticated user's email matches invitation email (case-insensitive, trimmed)

```js
// Email normalization for security
const normalizedUserEmail = (currentUser.email || '').trim().toLowerCase();
const normalizedInvitationEmail = (invitation.email || '').trim().toLowerCase();

if (normalizedUserEmail !== normalizedInvitationEmail) {
  const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
    reason: 'email_mismatch',
  });
  return c.json(error, error.statusCode);
}
```

### Syncing to Durable Objects

After accepting an invitation or adding a member, sync the change to the ProjectDoc Durable Object:

```js
import { syncMemberToDO } from '../lib/project-sync.js';

await syncMemberToDO(c.env, projectId, 'add', {
  userId: authUser.id,
  role: invitation.role,
  joinedAt: nowDate.getTime(),
  name: currentUser.name,
  email: currentUser.email,
  displayName: currentUser.displayName,
  image: currentUser.image,
});
```

The `syncMemberToDO` utility centralizes Durable Object synchronization and handles errors gracefully.

### Error Handling

Common invitation errors:

- `VALIDATION_FIELD_INVALID_FORMAT` - Invalid or expired token
- `PROJECT_MEMBER_ALREADY_EXISTS` - Invitation already accepted
- `PROJECT_INVITATION_ALREADY_ACCEPTED` - Trying to resend an accepted invitation
- `AUTH_FORBIDDEN` - Email mismatch (security check)
- `SYSTEM_DB_ERROR` - Database operation failed

Always use `createDomainError` with appropriate error codes from `@corates/shared`.

## Best Practices

### DO

- Use `OpenAPIHono` with `createRoute` for all routes
- Define Zod schemas with `.openapi()` for documentation
- Use `c.req.valid('json')` for validated request bodies
- Use `db.batch()` for atomic operations
- Use Drizzle ORM queries (never raw SQL)
- Use `createDomainError` for all errors
- Use `requireAuth` to protect routes
- Check access permissions before operations
- Use try-catch for database operations
- Return proper HTTP status codes
- Include OpenAPI tags, summary, and description
- Use the command pattern for complex write operations
- Keep route handlers thin (delegate to commands)

### DON'T

- Don't use plain `Hono` - use `OpenAPIHono` instead
- Don't use `validateRequest` middleware - use OpenAPIHono schemas
- Don't use raw SQL queries
- Don't skip authentication on protected routes
- Don't throw string literals
- Don't expose internal error details
- Don't forget to check permissions/access
- Don't skip batch operations for related database writes
- Don't put business logic directly in route handlers (use commands)
- Don't access Hono context in command functions

## Related Guides

- [Organizations Guide](/guides/organizations) - For org model, routes, and middleware patterns
- [Error Handling Guide](/guides/error-handling) - For error handling patterns
- [Database Guide](/guides/database) - For database schema and patterns
- [Authentication Guide](/guides/authentication) - For auth setup and patterns
