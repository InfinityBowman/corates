# API Development Guide

This guide covers how to develop API routes in the CoRATES Workers backend, including validation, database operations, error handling, and middleware patterns.

## Overview

API routes in CoRATES are built with Hono, use Zod for validation, Drizzle ORM for database operations, and follow consistent patterns for authentication, authorization, and error handling.

## Route Structure

### Basic Route Pattern

```js
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import { validateRequest, projectSchemas } from '../config/validation.js';
import { createDomainError, PROJECT_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { createDb } from '../db/client.js';

const routes = new Hono();

// Apply middleware
routes.use('*', requireAuth);

// Route handler
routes.post('/', validateRequest(projectSchemas.create), async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const data = c.get('validatedBody');

  try {
    // Database operations
    const result = await db.insert(projects).values({
      id: crypto.randomUUID(),
      name: data.name,
      description: data.description,
      createdBy: user.id,
    });

    return c.json(result);
  } catch (error) {
    // Error handling
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
5. **Validation** (`validateRequest`, `validateQueryParams`) - Validate input
6. **Route handler** - Business logic

```js
routes.post(
  '/',
  requireAuth,
  requireOrgMembership(), // Check org membership
  requireProjectAccess('member'), // Check project access with min role
  requireEntitlement('project.update'),
  validateRequest(projectSchemas.update),
  async c => {
    // Handler
  },
);
```

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
import { Hono } from 'hono';
import { requireAuth, getAuth } from '../middleware/auth.js';
import {
  requireOrgMembership,
  requireProjectAccess,
  getOrgContext,
  getProjectContext,
} from '../middleware/requireOrg.js';
import { validateRequest, projectSchemas } from '../config/validation.js';
import { createDomainError, SYSTEM_ERRORS } from '@corates/shared';
import { createDb } from '../db/client.js';

const orgProjectRoutes = new Hono();

// Auth middleware for all routes
orgProjectRoutes.use('*', requireAuth);

// Create project in org
orgProjectRoutes.post(
  '/',
  requireOrgMembership(),
  requireEntitlement('project.create'),
  validateRequest(projectSchemas.create),
  async c => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const db = createDb(c.env.DB);
    const { name, description } = c.get('validatedBody');

    try {
      const projectId = crypto.randomUUID();
      await db.batch([
        db.insert(projects).values({
          id: projectId,
          name,
          description,
          orgId, // Project belongs to org
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
  },
);
```

## Request Validation

### Using validateRequest Middleware

**Always use `validateRequest` middleware for request body validation:**

```js
import { validateRequest, projectSchemas } from '../config/validation.js';

// CORRECT
routes.post('/', validateRequest(projectSchemas.create), async c => {
  const data = c.get('validatedBody'); // Already validated
  // Use validated data
});

// WRONG - Manual validation
routes.post('/', async c => {
  const body = await c.req.json();
  // Don't manually validate - use middleware
});
```

### Adding New Schemas

Add schemas to `src/config/validation.js` and reuse `commonFields`:

```js
import { z } from 'zod/v4';
import { commonFields } from '../config/validation.js';

export const mySchemas = {
  create: z.object({
    name: commonFields.nonEmptyString,
    email: commonFields.email,
    // custom fields
    age: z.number().int().positive(),
  }),

  update: z.object({
    name: z.string().min(1).optional(),
    email: commonFields.email.optional(),
  }),
};
```

### Query Parameter Validation

Use `validateQueryParams` for query strings:

```js
import { validateQueryParams } from '../config/validation.js';

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

routes.get('/', validateQueryParams(querySchema), async c => {
  const { page, limit } = c.get('validatedQuery');
  // Use validated query params
});
```

### Validation Error Handling

Validation middleware automatically creates validation errors using the shared error system:

```290:316:packages/workers/src/config/validation.js
export function validateRequest(schema) {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const result = validateBody(schema, body);

      if (!result.success) {
        // result.error is already a DomainError from createValidationError/createMultiFieldValidationError
        return c.json(result.error, result.error.statusCode);
      }

      // Attach validated data to context
      c.set('validatedBody', result.data);
      await next();
    } catch (error) {
      console.warn('Body validation error:', error.message);
      // Invalid JSON - create validation error
      const invalidJsonError = createValidationError(
        'body',
        'VALIDATION_INVALID_INPUT',
        null,
        'invalid_json',
      );
      return c.json(invalidJsonError, invalidJsonError.statusCode);
    }
  };
}
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

```35:56:packages/workers/src/middleware/auth.js
export async function requireAuth(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    if (!session?.user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode);
    }

    c.set('user', session.user);
    c.set('session', session.session);

    await next();
  } catch (error) {
    console.error('Auth verification error:', error);
    const authError = createDomainError(AUTH_ERRORS.REQUIRED);
    return c.json(authError, authError.statusCode);
  }
}
```

### Getting Authenticated User

Use `getAuth` helper after `requireAuth`:

```63:68:packages/workers/src/middleware/auth.js
export function getAuth(c) {
  return {
    user: c.get('user'),
    session: c.get('session'),
  };
}
```

```js
routes.get('/me', requireAuth, async c => {
  const { user } = getAuth(c);
  return c.json({ user });
});
```

### Optional Authentication

Use `authMiddleware` (not `requireAuth`) for routes that work with or without auth:

```13:29:packages/workers/src/middleware/auth.js
export async function authMiddleware(c, next) {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });

    c.set('user', session?.user || null);
    c.set('session', session?.session || null);
  } catch (error) {
    console.error('Auth middleware error:', error);
    c.set('user', null);
    c.set('session', null);
  }

  await next();
}
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

### GET Route

```js
routes.get('/:id', requireAuth, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const projectId = c.req.param('id');

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
routes.post('/', requireAuth, validateRequest(projectSchemas.create), async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const data = c.get('validatedBody');

  const projectId = crypto.randomUUID();

  try {
    // Batch operations for atomicity
    const batchOps = [
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
    ];

    await db.batch(batchOps);

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
routes.patch('/:id', requireAuth, validateRequest(projectSchemas.update), async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const projectId = c.req.param('id');
  const data = c.get('validatedBody');

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
routes.delete('/:id', requireAuth, async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);
  const projectId = c.req.param('id');

  // Check ownership
  const project = await db.select().from(projects).where(eq(projects.id, projectId)).get();

  if (!project) {
    const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
    return c.json(error, error.statusCode);
  }

  if (project.createdBy !== user.id) {
    const error = createDomainError(PROJECT_ERRORS.ACCESS_DENIED, { projectId });
    return c.json(error, error.statusCode);
  }

  // Delete (cascade will handle related records)
  await db.delete(projects).where(eq(projects.id, projectId));

  return c.json({ success: true }, 204);
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

- Use `validateRequest` middleware for all request bodies
- Use `validateQueryParams` for query parameters
- Use `db.batch()` for atomic operations
- Use Drizzle ORM queries (never raw SQL)
- Use `createDomainError` for all errors
- Use `requireAuth` to protect routes
- Check access permissions before operations
- Use try-catch for database operations
- Return proper HTTP status codes

### DON'T

- Don't manually validate requests (use middleware)
- Don't use raw SQL queries
- Don't skip authentication on protected routes
- Don't throw string literals
- Don't expose internal error details
- Don't forget to check permissions/access
- Don't skip batch operations for related database writes

## Related Guides

- [Organizations Guide](/guides/organizations) - For org model, routes, and middleware patterns
- [Error Handling Guide](/guides/error-handling) - For error handling patterns
- [Database Guide](/guides/database) - For database schema and patterns
- [Authentication Guide](/guides/authentication) - For auth setup and patterns
