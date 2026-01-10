---
name: API Route
description: This skill should be used when the user asks to "create an API route", "add an endpoint", "build a backend route", "create an API endpoint", "add a Hono route", or mentions creating REST endpoints, API handlers, or backend routes. Provides Hono API patterns for CoRATES workers.
---

# API Route Creation

Create Hono API routes following CoRATES workers patterns.

## Core Principles

1. **Middleware composition** - Chain auth, permissions, validation middleware
2. **Domain errors** - Use createDomainError from @corates/shared
3. **Zod validation** - Define schemas centrally in config/validation.js
4. **Drizzle ORM** - All database operations through Drizzle
5. **Context isolation** - Attach data to Hono context, read via getters

## Quick Reference

### File Location

```
packages/workers/src/
  routes/
    [feature].js           # Standalone routes
    [feature]/
      index.js             # Route composition
      [subroute].js        # Nested routes
  config/
    validation.js          # Zod schemas
  middleware/
    auth.js                # Authentication
    requireOrg.js          # Org membership
```

### Basic Route Template

```javascript
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { createDb } from '@/db/client.js';
import { items } from '@/db/schema.js';
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { validateRequest } from '@/config/validation.js';
import { createDomainError, ITEM_ERRORS, SYSTEM_ERRORS } from '@corates/shared';
import { itemSchemas } from '@/config/validation.js';

const itemRoutes = new Hono();

// Apply auth to all routes
itemRoutes.use('*', requireAuth);

// GET - List items
itemRoutes.get('/', async c => {
  const { user } = getAuth(c);
  const db = createDb(c.env.DB);

  try {
    const results = await db
      .select()
      .from(items)
      .where(eq(items.userId, user.id));

    return c.json(results);
  } catch (error) {
    console.error('Error fetching items:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_items',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

// POST - Create item
itemRoutes.post('/', validateRequest(itemSchemas.create), async c => {
  const { user } = getAuth(c);
  const { name, description } = c.get('validatedBody');
  const db = createDb(c.env.DB);

  try {
    const id = crypto.randomUUID();
    const now = new Date();

    await db.insert(items).values({
      id,
      name,
      description,
      userId: user.id,
      createdAt: now,
    });

    return c.json({ id, name, description }, 201);
  } catch (error) {
    console.error('Error creating item:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'create_item',
    });
    return c.json(dbError, dbError.statusCode);
  }
});

export { itemRoutes };
```

## Middleware Chain

Apply middleware in order of specificity:

```javascript
import { requireAuth, getAuth } from '@/middleware/auth.js';
import { requireOrgMembership, getOrgContext } from '@/middleware/requireOrg.js';
import { requireOrgWriteAccess } from '@/middleware/requireOrgWriteAccess.js';
import { requireEntitlement } from '@/middleware/requireEntitlement.js';
import { requireQuota } from '@/middleware/requireQuota.js';
import { validateRequest } from '@/config/validation.js';

// Full middleware chain for protected route
routes.post(
  '/',
  requireOrgMembership(),           // Check org membership
  requireOrgWriteAccess(),          // Check write permission
  requireEntitlement('feature.x'),  // Check feature access
  requireQuota('items.max', getItemCount, 1),  // Check quota
  validateRequest(schema),          // Validate body
  async c => {
    const { user } = getAuth(c);
    const { orgId } = getOrgContext(c);
    const data = c.get('validatedBody');
    // Handler code...
  },
);
```

### Context Getters

```javascript
// Authentication
const { user, session } = getAuth(c);

// Organization context (after requireOrgMembership)
const { orgId, orgRole, org } = getOrgContext(c);

// Validated request body (after validateRequest)
const data = c.get('validatedBody');

// Billing/entitlements (after requireEntitlement)
const entitlements = c.get('entitlements');
const quotas = c.get('quotas');
```

## Zod Validation

### Define Schemas

Add to `packages/workers/src/config/validation.js`:

```javascript
export const itemSchemas = {
  create: z.object({
    name: z
      .string()
      .min(1, 'Name is required')
      .max(255)
      .transform(val => val.trim()),
    description: z
      .string()
      .max(2000)
      .optional()
      .transform(val => val?.trim() || null),
  }),

  update: z.object({
    name: z.string().min(1).max(255).optional(),
    description: z.string().max(2000).optional(),
  }),
};
```

### Common Patterns

```javascript
// Required string with trim
name: z.string().min(1).max(255).transform(val => val.trim()),

// Optional with null fallback
description: z.string().max(2000).optional().transform(val => val?.trim() || null),

// Email
email: z.string().email('Invalid email'),

// UUID
id: z.string().uuid(),

// Enum
role: z.enum(['owner', 'admin', 'member', 'viewer']),

// Boolean with default
active: z.boolean().optional().default(true),
```

## Error Handling

### Domain Errors

```javascript
import { createDomainError, PROJECT_ERRORS, AUTH_ERRORS, SYSTEM_ERRORS } from '@corates/shared';

// Not found
const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
return c.json(error, error.statusCode);

// Forbidden with reason
const error = createDomainError(AUTH_ERRORS.FORBIDDEN, {
  reason: 'insufficient_role',
  required: 'admin',
});
return c.json(error, error.statusCode);

// Database error
const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
  operation: 'create_item',
  originalError: error.message,
});
return c.json(dbError, dbError.statusCode);
```

### Try-Catch Pattern

```javascript
routes.get('/:id', async c => {
  const { user } = getAuth(c);
  const id = c.req.param('id');
  const db = createDb(c.env.DB);

  try {
    const result = await db
      .select()
      .from(items)
      .where(and(eq(items.id, id), eq(items.userId, user.id)))
      .get();

    if (!result) {
      const error = createDomainError(ITEM_ERRORS.NOT_FOUND, { id });
      return c.json(error, error.statusCode);
    }

    return c.json(result);
  } catch (error) {
    console.error('Error fetching item:', error);
    const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'fetch_item',
    });
    return c.json(dbError, dbError.statusCode);
  }
});
```

## Database Operations

### Query Patterns

```javascript
import { createDb } from '@/db/client.js';
import { eq, and, or, like, desc, sql } from 'drizzle-orm';

const db = createDb(c.env.DB);

// Select with join
const results = await db
  .select({
    id: projects.id,
    name: projects.name,
    role: projectMembers.role,
  })
  .from(projects)
  .innerJoin(projectMembers, eq(projects.id, projectMembers.projectId))
  .where(eq(projectMembers.userId, user.id))
  .orderBy(desc(projects.updatedAt));

// Single record
const item = await db
  .select()
  .from(items)
  .where(eq(items.id, id))
  .get();

// Insert
await db.insert(items).values({ id, name, createdAt: now });

// Update
await db.update(items)
  .set({ name, updatedAt: now })
  .where(eq(items.id, id));

// Delete
await db.delete(items).where(eq(items.id, id));

// Batch for atomic operations
await db.batch([
  db.insert(projects).values({ ... }),
  db.insert(projectMembers).values({ ... }),
]);
```

## Response Patterns

```javascript
// Success with data
return c.json(result);

// Created (201)
return c.json(newItem, 201);

// Success flag
return c.json({ success: true, id: itemId });

// Array response
return c.json(results);

// Error response
return c.json(error, error.statusCode);
```

## Route Registration

### Mount in Main App

```javascript
// packages/workers/src/index.js
import { itemRoutes } from './routes/items.js';

app.route('/api/items', itemRoutes);
```

### Nested Routes

```javascript
// In parent route file
import { subRoutes } from './subroute.js';

parentRoutes.route('/:parentId/children', subRoutes);

// Creates: /api/parent/:parentId/children/...
```

## Creation Checklist

When creating an API route:

1. Create route file in `packages/workers/src/routes/`
2. Define Zod schemas in `config/validation.js`
3. Apply appropriate middleware chain
4. Use context getters for auth/org/validated data
5. Use Drizzle for all database operations
6. Return domain errors with proper status codes
7. Register route in `index.js`

## Additional Resources

### Reference Files

For detailed patterns:
- **`references/patterns.md`** - Middleware details, complex queries, nested routes
- **`references/examples.md`** - Real route examples from the codebase

### Example Files

Working templates in `examples/`:
- **`ExampleRoutes.js`** - Complete CRUD route template
