# Zod OpenAPI Hono Migration Plan

## Overview

This plan outlines the incremental migration from plain Hono with manual Zod validation to `@hono/zod-openapi`. The migration will be done route-by-route to ensure tests continue to pass and minimize risk.

## Current State

- **Framework**: Hono v4.11.3 with Zod v4.3.5
- **Validation**: Centralized in `packages/workers/src/config/validation.js` using `validateRequest()` and `validateQueryParams()` middleware
- **OpenAPI**: Manually maintained via `scripts/generate-openapi.mjs` parsing route files
- **Testing**: Vitest with `@cloudflare/vitest-pool-workers`, 29+ test files
- **Route Files**: 16+ route files organized under `src/routes/`

## Goals

1. Auto-generate OpenAPI spec from route definitions (single source of truth)
2. Type-safe request/response validation using `c.req.valid()`
3. Maintain existing error format via `defaultHook`
4. Keep tests passing throughout migration
5. Gradual migration - old and new patterns can coexist

## Migration Phases

---

### Phase 1: Setup and Infrastructure

**Estimated files changed**: 3-4

#### 1.1 Install Dependencies

```bash
pnpm add @hono/zod-openapi --filter @corates/workers
```

Note: This package re-exports Zod with OpenAPI extensions. We'll need to update imports gradually.

#### 1.2 Create OpenAPI App Factory

Create `packages/workers/src/lib/openapi.js`:

```javascript
import { OpenAPIHono } from '@hono/zod-openapi';
import { createValidationError, createMultiFieldValidationError } from '@corates/shared';

/**
 * Creates an OpenAPIHono app with standardized error handling
 * that matches existing validation error format
 */
export function createOpenAPIApp() {
  return new OpenAPIHono({
    defaultHook: (result, c) => {
      if (!result.success) {
        // Map to existing error format for backwards compatibility
        const issues = result.error.issues;

        if (issues.length === 1) {
          const issue = issues[0];
          const field = issue.path.join('.') || 'root';
          const error = createValidationError(
            field,
            mapZodErrorToValidationCode(issue),
            undefined,
            issue.code
          );
          return c.json(error, error.statusCode);
        }

        const validationErrors = issues.map(issue => ({
          field: issue.path.join('.') || 'root',
          code: mapZodErrorToValidationCode(issue),
          message: issue.message,
          zodCode: issue.code,
        }));

        const error = createMultiFieldValidationError(validationErrors);
        return c.json(error, error.statusCode);
      }
    },
  });
}

// Re-use existing mapping logic
function mapZodErrorToValidationCode(issue) {
  const kind = issue.code;
  switch (kind) {
    case 'too_small':
      if (issue.type === 'string' && issue.minimum === 1) {
        return 'VALIDATION_FIELD_REQUIRED';
      }
      return 'VALIDATION_FIELD_TOO_SHORT';
    case 'too_big':
      return 'VALIDATION_FIELD_TOO_LONG';
    case 'invalid_string':
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    case 'invalid_type':
      return 'VALIDATION_FIELD_INVALID_FORMAT';
    default:
      return 'VALIDATION_FAILED';
  }
}
```

#### 1.3 Create Shared Response Schemas

Create `packages/workers/src/config/openapi-schemas.js`:

```javascript
import { z } from '@hono/zod-openapi';

// Common error response schema
export const ErrorResponseSchema = z.object({
  code: z.string().openapi({ example: 'VALIDATION_FIELD_REQUIRED' }),
  message: z.string().openapi({ example: 'Field is required' }),
  statusCode: z.number().openapi({ example: 400 }),
  field: z.string().optional().openapi({ example: 'name' }),
  details: z.any().optional(),
}).openapi('ErrorResponse');

// Success response for mutations
export const SuccessResponseSchema = z.object({
  success: z.literal(true),
}).openapi('SuccessResponse');

// Pagination metadata
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  hasMore: z.boolean(),
  total: z.number().optional(),
}).openapi('Pagination');
```

#### 1.4 Update Documentation Endpoint

Update `packages/workers/src/docs.js` to serve auto-generated OpenAPI spec:

```javascript
// Add endpoint to serve generated OpenAPI JSON
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'CoRATES API',
    version: '1.0.0',
    description: 'API for CoRATES research collaboration platform',
  },
  servers: [
    { url: 'https://api.corates.org', description: 'Production' },
    { url: 'http://localhost:8787', description: 'Development' },
  ],
});
```

#### 1.5 Tests for This Phase

- [ ] Verify `createOpenAPIApp()` returns valid Hono instance
- [ ] Verify error format matches existing `createValidationError` output
- [ ] Verify `/api/openapi.json` returns valid OpenAPI 3.1 spec

---

### Phase 2: Pilot Migration - Contact Route

**Target file**: `packages/workers/src/routes/contact.js`

**Why this route?**
- Simple, single endpoint (POST /api/contact)
- No auth middleware dependencies
- Has existing test coverage
- Low risk for pilot

#### 2.1 Current Implementation

```javascript
// Current pattern in contact.js
app.post('/', validateRequest(contactSchema), async (c) => {
  const { email, message } = c.get('validatedBody');
  // ...
});
```

#### 2.2 Migrated Implementation

```javascript
import { createRoute, z } from '@hono/zod-openapi';
import { createOpenAPIApp } from '@/lib/openapi.js';
import { ErrorResponseSchema } from '@/config/openapi-schemas.js';

const contactRoutes = createOpenAPIApp();

// Define schemas with OpenAPI metadata
const ContactRequestSchema = z.object({
  email: z.string().email().openapi({
    example: 'user@example.com',
    description: 'Contact email address'
  }),
  name: z.string().min(1).max(100).openapi({
    example: 'John Doe',
    description: 'Contact name'
  }),
  message: z.string().min(10).max(5000).openapi({
    example: 'I have a question about...',
    description: 'Message content'
  }),
}).openapi('ContactRequest');

const ContactResponseSchema = z.object({
  success: z.literal(true),
  messageId: z.string().optional(),
}).openapi('ContactResponse');

// Define route with full OpenAPI spec
const submitContactRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Contact'],
  summary: 'Submit contact form',
  description: 'Submit a contact form message',
  request: {
    body: {
      content: {
        'application/json': {
          schema: ContactRequestSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ContactResponseSchema,
        },
      },
      description: 'Message sent successfully',
    },
    400: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Validation error',
    },
    429: {
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
      description: 'Rate limited',
    },
  },
});

// Register route with handler
contactRoutes.openapi(submitContactRoute, async (c) => {
  // Body is validated and typed
  const { email, name, message } = c.req.valid('json');

  // Existing implementation...
});

export { contactRoutes };
```

#### 2.3 Test Updates

Update `packages/workers/src/routes/__tests__/contact.test.js`:

- [ ] Verify 200 response on valid input (should work unchanged)
- [ ] Verify 400 response format matches existing error structure
- [ ] Add test for OpenAPI route metadata availability

#### 2.4 Verification Checklist

- [ ] `pnpm test --filter @corates/workers` passes
- [ ] Contact form works in development
- [ ] Error responses match existing format exactly
- [ ] OpenAPI spec includes new route definition

---

### Phase 3: User Routes Migration

**Target file**: `packages/workers/src/routes/users.js`

**Endpoints**:
- `GET /api/users/search` - Search users (query params)
- `GET /api/users/:id` - Get user by ID (path params)

This phase tests query parameter and path parameter validation.

#### 3.1 Schema Definitions

```javascript
import { z } from '@hono/zod-openapi';

// Path parameters
const UserIdParamSchema = z.object({
  id: z.string().min(1).openapi({
    param: { name: 'id', in: 'path' },
    example: 'user_abc123',
  }),
});

// Query parameters
const UserSearchQuerySchema = z.object({
  q: z.string().min(2).openapi({
    param: { name: 'q', in: 'query' },
    example: 'john',
    description: 'Search query (min 2 chars)',
  }),
  projectId: z.string().uuid().optional().openapi({
    param: { name: 'projectId', in: 'query' },
    description: 'Filter by project membership',
  }),
  limit: z.string().optional().transform(v => Math.min(Math.max(1, parseInt(v || '10')), 20)).openapi({
    param: { name: 'limit', in: 'query' },
    example: '10',
  }),
});

// Response schemas
const UserSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  displayName: z.string().nullable(),
  image: z.string().nullable(),
}).openapi('User');

const UserSearchResponseSchema = z.array(UserSchema).openapi('UserSearchResponse');
```

#### 3.2 Route Definitions

```javascript
const searchUsersRoute = createRoute({
  method: 'get',
  path: '/search',
  tags: ['Users'],
  summary: 'Search users',
  security: [{ cookieAuth: [] }],
  middleware: [requireAuth],
  request: {
    query: UserSearchQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: UserSearchResponseSchema } },
      description: 'Search results',
    },
    401: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Unauthorized',
    },
  },
});

userRoutes.openapi(searchUsersRoute, async (c) => {
  const { q, projectId, limit } = c.req.valid('query');
  // ...existing implementation
});
```

#### 3.3 Tests to Update

- [ ] `packages/workers/src/routes/__tests__/users.test.js`
- [ ] Verify query param validation (q too short)
- [ ] Verify auth middleware still works with new pattern

---

### Phase 4: Project Routes Migration (Core CRUD)

**Target files**:
- `packages/workers/src/routes/orgs/projects.js`
- `packages/workers/src/routes/orgs/index.js`

This is the most complex migration - tests project creation, update, delete with:
- Path parameters (orgId, projectId)
- Body validation
- Multiple middleware (auth, org membership, entitlements, quotas)
- Response schemas

#### 4.1 Schema Definitions

```javascript
// Path parameters
const OrgProjectParamsSchema = z.object({
  orgId: z.string().uuid().openapi({
    param: { name: 'orgId', in: 'path' },
    example: 'org_abc123',
  }),
  projectId: z.string().uuid().optional().openapi({
    param: { name: 'projectId', in: 'path' },
    example: 'proj_xyz789',
  }),
});

// Existing schemas enhanced with OpenAPI metadata
const CreateProjectSchema = z.object({
  name: z.string().min(1).max(255).transform(v => v.trim()).openapi({
    example: 'My Research Project',
    description: 'Project name (1-255 chars)',
  }),
  description: z.string().max(2000).optional().transform(v => v?.trim() || null).openapi({
    example: 'A systematic review of...',
    description: 'Optional project description',
  }),
}).openapi('CreateProjectRequest');

const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  orgId: z.string().uuid(),
  role: z.enum(['owner', 'member']),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
}).openapi('Project');
```

#### 4.2 Middleware Integration

The key challenge is integrating existing middleware with `createRoute`:

```javascript
const createProjectRoute = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create a new project',
  security: [{ cookieAuth: [] }],
  // Middleware chain defined here
  middleware: [
    requireOrgMembership(),
    requireOrgWriteAccess(),
    requireEntitlement('project.create'),
    requireQuota('projects.max', getProjectCount, 1),
  ],
  request: {
    params: OrgProjectParamsSchema.pick({ orgId: true }),
    body: {
      content: { 'application/json': { schema: CreateProjectSchema } },
      required: true,
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ProjectSchema } },
      description: 'Project created',
    },
    400: { /* validation error */ },
    401: { /* unauthorized */ },
    403: { /* forbidden - not org member or no write access */ },
    429: { /* quota exceeded */ },
  },
});
```

#### 4.3 Tests to Update

- [ ] `packages/workers/src/routes/__tests__/projects.test.js` (847 lines)
- [ ] Verify all CRUD operations work
- [ ] Verify middleware chain execution order
- [ ] Verify error responses match existing format

---

### Phase 5: Member Routes Migration

**Target file**: `packages/workers/src/routes/orgs/members.js`

Endpoints:
- `GET /api/orgs/:orgId/projects/:projectId/members` - List members
- `POST /api/orgs/:orgId/projects/:projectId/members` - Add member
- `PUT /api/orgs/:orgId/projects/:projectId/members/:userId` - Update role
- `DELETE /api/orgs/:orgId/projects/:projectId/members/:userId` - Remove member

---

### Phase 6: Invitation Routes Migration

**Target file**: `packages/workers/src/routes/orgs/invitations.js`

Endpoints:
- `GET /api/orgs/:orgId/projects/:projectId/invitations` - List invitations
- `POST /api/orgs/:orgId/projects/:projectId/invitations` - Create invitation
- `DELETE /api/orgs/:orgId/projects/:projectId/invitations/:id` - Revoke invitation
- `POST /api/invitations/accept` - Accept invitation (public)

---

### Phase 7: Billing Routes Migration

**Target file**: `packages/workers/src/routes/billing/index.js` and sub-routes

Complex routes with Stripe integration:
- Subscription management
- Checkout sessions
- Portal sessions
- Webhooks (special handling - raw body needed)

**Note**: Webhook routes may need to remain as plain Hono routes due to raw body requirements.

---

### Phase 8: Admin Routes Migration

**Target file**: `packages/workers/src/routes/admin/index.js`

Admin-only routes with strict access control:
- User management
- Storage management
- Impersonation

---

### Phase 9: Remaining Routes

- `packages/workers/src/routes/email.js`
- `packages/workers/src/routes/avatars.js`
- `packages/workers/src/routes/google-drive.js`
- `packages/workers/src/routes/account-merge.js`
- `packages/workers/src/routes/database.js`
- `packages/workers/src/routes/orgs/pdfs.js`

---

### Phase 10: Main App Integration

**Target file**: `packages/workers/src/index.js`

1. Convert main app to `OpenAPIHono`
2. Mount all migrated routes
3. Configure OpenAPI documentation endpoint
4. Remove legacy OpenAPI generation script

```javascript
import { OpenAPIHono } from '@hono/zod-openapi';

const app = new OpenAPIHono();

// ... mount routes ...

// OpenAPI JSON endpoint
app.doc('/api/openapi.json', {
  openapi: '3.1.0',
  info: {
    title: 'CoRATES API',
    version: '1.0.0',
  },
  servers: [
    { url: 'https://api.corates.org', description: 'Production' },
  ],
});

// Swagger UI (development only)
app.get('/docs', swaggerUI({ url: '/api/openapi.json' }));
```

---

### Phase 11: Cleanup

1. Remove `packages/workers/scripts/generate-openapi.mjs`
2. Remove `packages/workers/api-docs.yaml`
3. Update `packages/workers/openapi.json` to be auto-generated
4. Remove old `validateRequest` / `validateQueryParams` middleware (or deprecate)
5. Update imports across all files to use `@hono/zod-openapi` z

---

## Testing Strategy

### Per-Phase Testing

After each phase:

1. Run full test suite: `pnpm test --filter @corates/workers`
2. Run affected tests in watch mode during development
3. Manual verification of affected endpoints
4. Verify OpenAPI spec generation

### Regression Testing Checklist

- [ ] All existing tests pass without modification (where possible)
- [ ] Error response format unchanged
- [ ] Auth middleware works correctly
- [ ] Rate limiting works correctly
- [ ] CORS headers unchanged
- [ ] WebSocket endpoints unaffected

### New Tests to Add

- [ ] OpenAPI spec validation test
- [ ] Schema consistency tests (request/response match)
- [ ] Middleware chain order tests

---

## Rollback Strategy

Each phase can be rolled back independently:

1. Routes use either old pattern or new pattern
2. Main app can mount both `Hono` and `OpenAPIHono` routes
3. Keep `validateRequest` middleware until full migration complete
4. Git tags at end of each phase for easy rollback

---

## Timeline Estimate

| Phase | Description | Complexity | Files |
|-------|-------------|------------|-------|
| 1 | Setup & Infrastructure | Low | 3-4 |
| 2 | Contact Route (Pilot) | Low | 2 |
| 3 | User Routes | Medium | 2 |
| 4 | Project Routes | High | 3 |
| 5 | Member Routes | Medium | 2 |
| 6 | Invitation Routes | Medium | 2 |
| 7 | Billing Routes | High | 6 |
| 8 | Admin Routes | Medium | 3 |
| 9 | Remaining Routes | Medium | 6 |
| 10 | Main App Integration | Medium | 2 |
| 11 | Cleanup | Low | 4 |

---

## Dependencies

```json
{
  "@hono/zod-openapi": "^0.x"
}
```

**Zod v4 Compatibility**: Confirmed. `@hono/zod-openapi` has `"zod": "^4.0.0"` as a peer dependency, which matches our existing `zod: ^4.3.5`. No version conflicts or import changes needed.

---

## Open Questions

1. ~~**Zod version compatibility**~~: Confirmed - `@hono/zod-openapi` supports Zod v4.
2. **Webhook handling**: Stripe webhooks need raw body - can this work with OpenAPIHono?
3. **Auth route integration**: Better Auth routes are separate - do they need migration?
4. **TypeScript support**: Current codebase is JS - consider adding JSDoc types for better DX.

---

## Success Criteria

- [ ] All 29+ test files pass
- [ ] OpenAPI spec auto-generated and valid
- [ ] Error responses match existing format
- [ ] No breaking changes to API consumers
- [ ] Documentation available at `/docs`
- [ ] Manual OpenAPI files removed
