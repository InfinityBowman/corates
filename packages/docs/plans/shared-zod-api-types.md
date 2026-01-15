# Shared Zod API Types Plan

## Overview

Centralize API request/response schemas in `@corates/shared` to provide type-safe API contracts between the workers backend and web frontend without requiring OpenAPI client codegen.

## Current State

- Backend routes use `@hono/zod-openapi` with inline Zod schemas for validation
- Frontend makes fetch calls with manually typed responses
- No shared type definitions between packages
- Type mismatches can occur silently

## Goals

1. Single source of truth for API request/response types
2. Type-safe frontend API calls without codegen overhead
3. Runtime validation available on both client and server
4. Minimal changes to existing route handlers

## Architecture

```
@corates/shared
  src/
    api/
      index.ts           # Barrel export
      schemas/
        auth.ts          # Auth-related schemas
        billing.ts       # Billing/subscription schemas
        members.ts       # Project/org member schemas
        orgs.ts          # Organization schemas
        projects.ts      # Project schemas
        users.ts         # User schemas
      types.ts           # Inferred TypeScript types from schemas
```

## Implementation Steps

### Phase 1: Schema Infrastructure

1. Create `packages/shared/src/api/` directory structure
2. Add base schema utilities (pagination, error responses, timestamps)
3. Export from shared package index

**Base schemas to create:**

```typescript
// packages/shared/src/api/schemas/common.ts
import { z } from 'zod';

export const PaginationParamsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
    items: z.array(itemSchema),
    total: z.number(),
    page: z.number(),
    limit: z.number(),
    hasMore: z.boolean(),
  });

export const TimestampSchema = z.object({
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const IdSchema = z.string().uuid();
```

### Phase 2: Entity Schemas

Move/create schemas for core entities:

**Users:**

```typescript
// packages/shared/src/api/schemas/users.ts
export const UserSchema = z.object({
  id: IdSchema,
  email: z.string().email(),
  name: z.string().nullable(),
  image: z.string().url().nullable(),
  emailVerified: z.boolean(),
  ...TimestampSchema.shape,
});

export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  image: z.string().url().nullable().optional(),
});
```

**Organizations:**

```typescript
// packages/shared/src/api/schemas/orgs.ts
export const OrgSchema = z.object({
  id: IdSchema,
  name: z.string(),
  slug: z.string(),
  logo: z.string().url().nullable(),
  ...TimestampSchema.shape,
});

export const CreateOrgSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(/^[a-z0-9-]+$/),
});

export const OrgMemberSchema = z.object({
  id: IdSchema,
  userId: IdSchema,
  orgId: IdSchema,
  role: z.enum(['owner', 'member']),
  ...TimestampSchema.shape,
});
```

**Projects:**

```typescript
// packages/shared/src/api/schemas/projects.ts
export const ProjectSchema = z.object({
  id: IdSchema,
  orgId: IdSchema,
  name: z.string(),
  description: z.string().nullable(),
  checklistType: z.enum(['amstar2', 'robins-i']).nullable(),
  ...TimestampSchema.shape,
});

export const CreateProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  checklistType: z.enum(['amstar2', 'robins-i']).optional(),
});

export const ProjectMemberSchema = z.object({
  id: IdSchema,
  projectId: IdSchema,
  userId: IdSchema,
  role: z.enum(['owner', 'member']),
  ...TimestampSchema.shape,
});
```

### Phase 3: API Response Schemas

Create response wrappers for each endpoint:

```typescript
// packages/shared/src/api/schemas/responses.ts
export const GetUserResponseSchema = UserSchema;
export const UpdateUserResponseSchema = UserSchema;

export const ListOrgsResponseSchema = z.array(
  OrgSchema.extend({
    memberCount: z.number(),
    projectCount: z.number(),
  }),
);

export const GetOrgResponseSchema = OrgSchema.extend({
  members: z.array(
    OrgMemberSchema.extend({
      user: UserSchema.pick({ id: true, name: true, email: true, image: true }),
    }),
  ),
});

// etc.
```

### Phase 4: Backend Migration

Update route handlers to import schemas from shared:

```typescript
// Before (inline schema)
const createProjectRoute = createRoute({
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(200),
            // ...
          }),
        },
      },
    },
  },
});

// After (shared schema)
import { CreateProjectSchema, ProjectSchema } from '@corates/shared/api';

const createProjectRoute = createRoute({
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateProjectSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: ProjectSchema,
        },
      },
    },
  },
});
```

### Phase 5: Frontend API Client

Create typed fetch utilities in web package:

```typescript
// packages/web/src/lib/api/client.ts
import { z } from 'zod';

type ApiResult<T> = { ok: true; data: T } | { ok: false; error: DomainError };

export async function apiGet<T extends z.ZodTypeAny>(path: string, schema: T): Promise<ApiResult<z.infer<T>>> {
  const response = await fetch(path, { credentials: 'include' });

  if (!response.ok) {
    const error = await response.json();
    return { ok: false, error };
  }

  const data = await response.json();
  const parsed = schema.safeParse(data);

  if (!parsed.success) {
    console.error('API response validation failed:', parsed.error);
    // In dev, throw. In prod, return data anyway with warning.
  }

  return { ok: true, data: parsed.data };
}

export async function apiPost<TBody, TResponse extends z.ZodTypeAny>(
  path: string,
  body: TBody,
  responseSchema: TResponse,
): Promise<ApiResult<z.infer<TResponse>>> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  // ... similar to apiGet
}
```

**Usage in components/stores:**

```typescript
// packages/web/src/stores/projectStore.ts
import { CreateProjectSchema, ProjectSchema } from '@corates/shared/api';
import { apiPost, apiGet } from '@/lib/api/client';

export async function createProject(orgId: string, data: z.infer<typeof CreateProjectSchema>) {
  return apiPost(`/api/orgs/${orgId}/projects`, data, ProjectSchema);
}

export async function getProject(orgId: string, projectId: string) {
  return apiGet(`/api/orgs/${orgId}/projects/${projectId}`, ProjectSchema);
}
```

## Migration Order

1. **Week 1:** Schema infrastructure + common schemas
2. **Week 2:** User, org, project entity schemas
3. **Week 3:** Backend route migration (one route file at a time)
4. **Week 4:** Frontend API client + store updates

## Testing Strategy

- Unit tests for schema validation edge cases
- Integration tests verify backend/frontend type compatibility
- Add `pnpm typecheck` to CI for both packages

## Considerations

### Schema Versioning

If API changes require breaking schema changes:

- Add version suffix to schema names (`UserSchemaV2`)
- Deprecate old schemas with JSDoc comments
- Coordinate backend/frontend updates

### Optional Fields

Be explicit about nullable vs optional:

- `nullable()` = field present but can be null
- `optional()` = field may be absent
- `.nullish()` = either null or undefined

### Circular References

Some entities reference each other. Use `z.lazy()` sparingly:

```typescript
// Prefer flat schemas with IDs
export const ProjectWithMembersSchema = ProjectSchema.extend({
  members: z.array(ProjectMemberSchema),
});

// Avoid deeply nested circular refs
```

## Success Criteria

- [ ] All API request/response types defined in `@corates/shared/api`
- [ ] Backend routes import schemas from shared package
- [ ] Frontend uses typed API client with runtime validation
- [ ] Zero type assertion (`as`) in API-related code
- [ ] TypeScript errors surface on schema mismatches
