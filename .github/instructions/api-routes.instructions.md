---
applyTo: 'packages/workers/**'
description: 'API route patterns for validation, database operations, and error handling'
---

# API Route Patterns

## Request Validation

**ALWAYS use `validateRequest` middleware** for request body validation:

```js
// CORRECT
import { validateRequest, projectSchemas } from '../config/validation.js';

projectRoutes.post('/', validateRequest(projectSchemas.create), async c => {
  const { name, description } = c.get('validatedBody');
});

// WRONG - Manual validation
projectRoutes.post('/', async c => {
  const body = await c.req.json();
  // Don't manually validate - use middleware
});
```

## Database Operations

Always create DB client from environment:

```js
import { createDb } from '../db/client.js';

async c => {
  const db = createDb(c.env.DB);
};
```

**Use `db.batch()` for atomic operations:**

```js
// CORRECT - Atomic
const batchOps = [
  db.insert(projects).values({ id, name, createdBy }),
  db.insert(projectMembers).values({ projectId: id, userId, role: 'owner' }),
];
await db.batch(batchOps);

// WRONG - Not atomic
await db.insert(projects).values({ id, name });
await db.insert(projectMembers).values({ projectId: id, userId });
```

## Error Handling

Use `@corates/shared` error helpers:

```js
import { notFound, forbidden, badRequest } from '@corates/shared';

if (!project) throw notFound('Project not found');
if (!hasAccess) throw forbidden('Access denied');
if (!isValid) throw badRequest('Invalid input');
```

## Route Organization

- Group related routes in separate files
- Use Hono router groups
- Apply middleware at group level when possible
