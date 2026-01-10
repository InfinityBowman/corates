# Detailed API Route Patterns

Comprehensive patterns for Hono API routes in CoRATES workers.

## Middleware Deep Dive

### Authentication Middleware

```javascript
// File: packages/workers/src/middleware/auth.js

// Attach auth to context (non-blocking)
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

// Require authentication (blocking)
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

// Get auth from context
export function getAuth(c) {
  return {
    user: c.get('user'),
    session: c.get('session'),
  };
}
```

### Organization Membership Middleware

```javascript
// File: packages/workers/src/middleware/requireOrg.js

export function requireOrgMembership(minRole) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const orgId = c.req.param('orgId');

    if (!user) {
      const error = createDomainError(AUTH_ERRORS.REQUIRED);
      return c.json(error, error.statusCode);
    }

    if (!orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'org_id_required',
      });
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);

    const membership = await db
      .select({
        id: member.id,
        role: member.role,
        orgName: organization.name,
      })
      .from(member)
      .innerJoin(organization, eq(member.organizationId, organization.id))
      .where(and(eq(member.organizationId, orgId), eq(member.userId, user.id)))
      .get();

    if (!membership) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'not_org_member',
        orgId,
      });
      return c.json(error, error.statusCode);
    }

    // Check minimum role if specified
    if (minRole && !hasMinimumOrgRole(membership.role, minRole)) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'insufficient_org_role',
        required: minRole,
      });
      return c.json(error, error.statusCode);
    }

    // Attach org context
    c.set('orgId', orgId);
    c.set('orgRole', membership.role);
    c.set('org', { id: orgId, name: membership.orgName });

    await next();
  };
}

export function getOrgContext(c) {
  return {
    orgId: c.get('orgId') || null,
    orgRole: c.get('orgRole') || null,
    org: c.get('org') || null,
  };
}
```

### Entitlement Middleware

```javascript
// File: packages/workers/src/middleware/requireEntitlement.js

export function requireEntitlement(entitlement) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);

    if (!user || !orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN);
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);
    const orgBilling = await resolveOrgAccess(db, orgId);

    if (!orgBilling.entitlements[entitlement]) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'missing_entitlement',
        entitlement,
      });
      return c.json(error, error.statusCode);
    }

    c.set('orgBilling', orgBilling);
    c.set('entitlements', orgBilling.entitlements);

    await next();
  };
}
```

### Quota Middleware

```javascript
// File: packages/workers/src/middleware/requireQuota.js

export function requireQuota(quotaKey, getUsage, requested = 1) {
  return async (c, next) => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);

    if (!user || !orgId) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN);
      return c.json(error, error.statusCode);
    }

    const db = createDb(c.env.DB);
    const orgBilling = await resolveOrgAccess(db, orgId);

    // Get current usage
    const used = await getUsage(c, user);

    // Check quota
    const limit = orgBilling.quotas[quotaKey];
    if (!isUnlimitedQuota(limit) && used + requested > limit) {
      const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
        reason: 'quota_exceeded',
        quotaKey,
        used,
        limit,
      });
      return c.json(error, error.statusCode);
    }

    c.set('orgBilling', orgBilling);
    c.set('quotas', orgBilling.quotas);

    await next();
  };
}

// Example usage function
async function getProjectCount(c, user) {
  const { orgId } = getOrgContext(c);
  const db = createDb(c.env.DB);
  const [result] = await db.select({ count: count() }).from(projects).where(eq(projects.orgId, orgId));
  return result?.count || 0;
}
```

### Validation Middleware

```javascript
// File: packages/workers/src/config/validation.js

export function validateRequest(schema) {
  return async (c, next) => {
    try {
      const body = await c.req.json();
      const result = validateBody(schema, body);

      if (!result.success) {
        return c.json(result.error, result.error.statusCode);
      }

      c.set('validatedBody', result.data);
      await next();
    } catch (error) {
      const invalidJsonError = createValidationError('body', 'VALIDATION_INVALID_INPUT', null, 'invalid_json');
      return c.json(invalidJsonError, invalidJsonError.statusCode);
    }
  };
}

function validateBody(schema, body) {
  const result = schema.safeParse(body);

  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const fieldName = firstIssue?.path[0] || 'input';
    const validationCode = mapZodErrorToValidationCode(firstIssue);

    return {
      success: false,
      error: createValidationError(fieldName, validationCode),
    };
  }

  return { success: true, data: result.data };
}
```

## Complex Database Queries

### Joins with Field Selection

```javascript
const results = await db
  .select({
    id: projects.id,
    name: projects.name,
    description: projects.description,
    role: projectMembers.role,
    memberCount: sql`(
      SELECT COUNT(*) FROM ${projectMembers}
      WHERE ${projectMembers.projectId} = ${projects.id}
    )`.as('memberCount'),
  })
  .from(projects)
  .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
  .where(eq(projectMembers.userId, user.id))
  .orderBy(desc(projects.updatedAt));
```

### Search with Multiple Conditions

```javascript
const searchPattern = `%${query.toLowerCase()}%`;

const results = await db
  .select({
    id: user.id,
    name: user.name,
    email: user.email,
  })
  .from(user)
  .where(
    or(
      like(sql`lower(${user.email})`, searchPattern),
      like(sql`lower(${user.name})`, searchPattern),
      like(sql`lower(${user.displayName})`, searchPattern),
    ),
  )
  .limit(limit);
```

### Filtering Results Post-Query

```javascript
// Get members already in project
const existingMembers = await db
  .select({ userId: projectMembers.userId })
  .from(projectMembers)
  .where(eq(projectMembers.projectId, projectId));

const existingUserIds = new Set(existingMembers.map(m => m.userId));

// Filter search results
results = results.filter(u => !existingUserIds.has(u.id));
```

### Count Queries

```javascript
const [result] = await db.select({ count: count() }).from(projects).where(eq(projects.orgId, orgId));

const projectCount = result?.count || 0;
```

### Batch Operations

```javascript
// D1 batch for pseudo-atomic operations
const projectId = crypto.randomUUID();
const memberId = crypto.randomUUID();
const now = new Date();

await db.batch([
  db.insert(projects).values({
    id: projectId,
    name: name.trim(),
    createdBy: authUser.id,
    createdAt: now,
    updatedAt: now,
  }),
  db.insert(projectMembers).values({
    id: memberId,
    projectId,
    userId: authUser.id,
    role: 'owner',
    joinedAt: now,
  }),
]);
```

### Cascade Deletes

```javascript
await db.batch([
  // Set nullable foreign keys to null
  db.update(mediaFiles).set({ uploadedBy: null }).where(eq(mediaFiles.uploadedBy, userId)),

  // Delete dependent records
  db.delete(projectMembers).where(eq(projectMembers.userId, userId)),
  db.delete(invitations).where(eq(invitations.invitedUserId, userId)),

  // Delete main record
  db.delete(user).where(eq(user.id, userId)),
]);
```

## Nested Route Composition

### Parent Route

```javascript
// File: packages/workers/src/routes/orgs/index.js
import { Hono } from 'hono';
import { requireAuth } from '@/middleware/auth.js';
import { orgProjectRoutes } from './projects.js';
import { orgMemberRoutes } from './members.js';

const orgRoutes = new Hono();

orgRoutes.use('*', requireAuth);

// Org CRUD
orgRoutes.get('/', async c => { ... });
orgRoutes.post('/', async c => { ... });
orgRoutes.get('/:orgId', async c => { ... });

// Mount nested routes
orgRoutes.route('/:orgId/projects', orgProjectRoutes);
orgRoutes.route('/:orgId/members', orgMemberRoutes);

export { orgRoutes };
```

### Child Route

```javascript
// File: packages/workers/src/routes/orgs/projects.js
import { Hono } from 'hono';
import { requireOrgMembership, getOrgContext } from '@/middleware/requireOrg.js';
import { orgProjectMemberRoutes } from './project-members.js';

const orgProjectRoutes = new Hono();

// Org membership required for all project routes
orgProjectRoutes.get('/', requireOrgMembership(), async c => {
  const { orgId } = getOrgContext(c);
  // List projects in org...
});

orgProjectRoutes.post('/', requireOrgMembership(), ..., async c => {
  const { orgId } = getOrgContext(c);
  // Create project in org...
});

// Mount deeper nested routes
orgProjectRoutes.route('/:projectId/members', orgProjectMemberRoutes);

export { orgProjectRoutes };
```

### URL Structure

```
/api/orgs                           -> orgRoutes GET /
/api/orgs/:orgId                    -> orgRoutes GET /:orgId
/api/orgs/:orgId/projects           -> orgProjectRoutes GET /
/api/orgs/:orgId/projects/:projectId/members -> orgProjectMemberRoutes
```

## Rate Limiting

### Configure Rate Limits

```javascript
// File: packages/workers/src/middleware/rateLimit.js
import { createRateLimiter } from '@/lib/rateLimit.js';

// Strict limit for public endpoints
export const contactRateLimit = createRateLimiter({
  limit: 5,
  window: 60 * 1000, // 1 minute
  keyPrefix: 'contact',
});

// Moderate limit for search
export const searchRateLimit = createRateLimiter({
  limit: 30,
  window: 60 * 1000,
  keyPrefix: 'search',
});

// Relaxed limit for authenticated APIs
export const apiRateLimit = createRateLimiter({
  limit: 100,
  window: 60 * 1000,
  keyPrefix: 'api',
});
```

### Apply Rate Limits

```javascript
import { contactRateLimit } from '@/middleware/rateLimit.js';

const contact = new Hono();
contact.use('*', contactRateLimit);

contact.post('/', async c => {
  // Handler...
});
```

## Error Handler

### Global Error Handler

```javascript
// File: packages/workers/src/middleware/errorHandler.js

export function errorHandler(err, c) {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  // Domain errors
  if (isDomainError(err)) {
    return c.json(err, err.statusCode);
  }

  // Zod validation errors
  if (isZodError(err)) {
    const error = createDomainError(SYSTEM_ERRORS.VALIDATION_ERROR, {
      message: formatZodErrors(err),
    });
    return c.json(error, error.statusCode);
  }

  // Hono HTTP exceptions
  if (err?.getResponse) {
    return err.getResponse();
  }

  // Database errors
  if (err?.message?.includes('D1_')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'database_operation',
    });
    return c.json(error, error.statusCode);
  }

  // Unique constraint violation
  if (err?.message?.includes('UNIQUE constraint failed')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'unique_constraint_violation',
    });
    return c.json(error, 409);
  }

  // Fallback
  const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR);
  return c.json(error, error.statusCode);
}
```

### Register in Main App

```javascript
// File: packages/workers/src/index.js
import { errorHandler } from './middleware/errorHandler.js';

const app = new Hono();

// ... routes ...

app.onError(errorHandler);

app.notFound(c => {
  return c.json({ error: 'Not Found' }, 404);
});

export default app;
```

## Query Parameters

### Parse and Validate

```javascript
routes.get('/search', async c => {
  const query = c.req.query('q')?.trim();
  const limit = Math.min(parseInt(c.req.query('limit') || '10', 10), 20);
  const offset = parseInt(c.req.query('offset') || '0', 10);
  const sortBy = c.req.query('sortBy') || 'createdAt';
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';

  if (!query || query.length < 2) {
    const error = createValidationError('query', 'VALIDATION_FIELD_TOO_SHORT');
    return c.json(error, error.statusCode);
  }

  // Use validated params...
});
```

### Path Parameters

```javascript
routes.get('/:id', async c => {
  const id = c.req.param('id');

  // Validate UUID format if needed
  if (!isValidUUID(id)) {
    const error = createValidationError('id', 'VALIDATION_FIELD_INVALID_FORMAT');
    return c.json(error, error.statusCode);
  }

  // Use id...
});

// Multiple path params
routes.get('/:projectId/studies/:studyId', async c => {
  const projectId = c.req.param('projectId');
  const studyId = c.req.param('studyId');
  // ...
});
```

## Response Headers

```javascript
// Rate limit headers
return c.json(data, 200, {
  'X-RateLimit-Limit': String(limit),
  'X-RateLimit-Remaining': String(remaining),
  'X-RateLimit-Reset': String(resetTime),
});

// Cache headers
return c.json(data, 200, {
  'Cache-Control': 'public, max-age=300',
});

// No content
return c.body(null, 204);
```

## File Uploads

### Handle Multipart Form Data

```javascript
import { z } from 'zod';

routes.post('/upload', async c => {
  const { user } = getAuth(c);

  const formData = await c.req.formData();
  const file = formData.get('file');

  if (!file || !(file instanceof File)) {
    const error = createValidationError('file', 'VALIDATION_FIELD_REQUIRED');
    return c.json(error, error.statusCode);
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    const error = createValidationError('file', 'VALIDATION_FIELD_INVALID_FORMAT');
    return c.json(error, error.statusCode);
  }

  // Validate file size (e.g., 5MB)
  if (file.size > 5 * 1024 * 1024) {
    const error = createValidationError('file', 'VALIDATION_FIELD_TOO_LONG');
    return c.json(error, error.statusCode);
  }

  // Process file...
  const buffer = await file.arrayBuffer();

  // Upload to R2 or process
  await c.env.BUCKET.put(`avatars/${user.id}`, buffer, {
    httpMetadata: { contentType: file.type },
  });

  return c.json({ success: true });
});
```

## External Service Integration

### Best-Effort External Calls

```javascript
routes.post('/', ..., async c => {
  // Main database operation
  await db.insert(projects).values({ ... });

  // External service sync (best-effort)
  try {
    await syncProjectToDO(c.env, projectId, { ... });
  } catch (err) {
    console.error('Failed to sync to DO:', err);
    // Continue - don't fail the request
  }

  return c.json(newProject, 201);
});
```

### Required External Calls

```javascript
routes.post('/send-email', async c => {
  const { email, subject, body } = c.get('validatedBody');

  if (!c.env.POSTMARK_SERVER_TOKEN) {
    const error = createDomainError(SYSTEM_ERRORS.SERVICE_UNAVAILABLE, {
      service: 'email',
    });
    return c.json(error, error.statusCode);
  }

  try {
    const postmark = new PostmarkClient(c.env.POSTMARK_SERVER_TOKEN);
    const response = await postmark.sendEmail({
      From: c.env.EMAIL_FROM,
      To: email,
      Subject: subject,
      TextBody: body,
    });

    if (response.ErrorCode !== 0) {
      console.error('Postmark error:', response);
      const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED);
      return c.json(error, error.statusCode);
    }

    return c.json({ success: true, messageId: response.MessageID });
  } catch (err) {
    console.error('Email exception:', err.message);
    const error = createDomainError(SYSTEM_ERRORS.EMAIL_SEND_FAILED);
    return c.json(error, error.statusCode);
  }
});
```
