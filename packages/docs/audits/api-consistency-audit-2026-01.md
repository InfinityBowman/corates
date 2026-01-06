# API Consistency Audit

**Date**: 2026-01-06
**Scope**: All Hono API routes in `packages/workers/src`
**Focus Areas**: Endpoint naming, response shapes, error formats, pagination patterns

## Executive Summary

This audit reviews API consistency across 100+ endpoints in the CoRATES Hono backend. The API demonstrates **strong consistency** in error handling and domain modeling, with **good patterns** in response shapes and endpoint naming. Several areas for improvement have been identified around pagination standardization and response shape consistency.

**Overall Grade**: B+ (Good consistency with room for standardization)

## 1. Endpoint Naming Conventions

### Strengths

**Consistent RESTful patterns:**

- Resource-based naming: `/api/orgs`, `/api/users`, `/api/projects`
- Standard HTTP verbs aligned with CRUD operations
- Hierarchical nesting for related resources: `/api/orgs/:orgId/projects/:projectId/members`
- Plural nouns for collections: `/orgs`, `/projects`, `/members`

**Clear org-scoped architecture:**

- All project-related operations properly scoped under org: `/api/orgs/:orgId/projects/...`
- Consistent parameter naming: `:orgId`, `:projectId`, `:userId`, `:memberId`

### Issues Identified

#### Issue 1.1: Inconsistent Action Endpoints

**Severity**: Low
**Location**: Multiple routes

**Problem**: Action endpoints use different naming patterns:

```
POST /api/orgs/:orgId/set-active           (kebab-case with verb prefix)
POST /api/orgs/:orgId/projects/:projectId/leave  (single verb)
POST /api/billing/trial/start              (resource/action pattern)
POST /api/orgs/:orgId/projects/:projectId/invitations/:invId/resend  (verb suffix)
```

**Impact**: Developer confusion about which pattern to use for new action endpoints

**Recommendation**: Standardize on one pattern. Prefer: `POST /resource/:id/actions/action-name`

```
# Consistent pattern:
POST /api/orgs/:orgId/actions/set-active
POST /api/projects/:projectId/actions/leave
POST /api/billing/trial/actions/start
POST /api/invitations/:invId/actions/resend
```

#### Issue 1.2: PDF Route Nesting Inconsistency

**Severity**: Low
**Location**: `packages/workers/src/routes/orgs/projects.js:406`

**Problem**: PDF routes are nested under a non-existent `studies` resource:

```javascript
// Current:
orgProjectRoutes.route('/:projectId/studies/:studyId/pdfs', orgPdfRoutes);

// Actual usage:
GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs
```

The `studies` resource doesn't have its own CRUD operations but is required in the path. This suggests either:

1. Studies should be a first-class resource with CRUD endpoints
2. PDFs should be directly under projects

**Recommendation**:

- If studies are a concept in the domain model, add study CRUD endpoints
- Otherwise, simplify to `/api/orgs/:orgId/projects/:projectId/pdfs` and store studyId as metadata

#### Issue 1.3: Inconsistent ID Parameter Naming

**Severity**: Very Low
**Location**: Multiple routes

**Problem**: Some routes use different ID parameter names for the same resource type:

```javascript
// Admin routes use :userId
DELETE /api/admin/users/:userId

// But member removal uses :memberId even though it's also a userId
DELETE /api/orgs/:orgId/members/:memberId
DELETE /api/orgs/:orgId/projects/:projectId/members/:userId  // Uses :userId here!
```

**Recommendation**: Standardize to use the actual resource type. For org/project members, consider:

- `:memberId` for membership records
- `:userId` when directly referencing users

## 2. Response Shapes

### Strengths

**Consistent success patterns:**

- Creation operations return `201` status with created resource
- Most operations return full resource objects
- Success flags used consistently: `{ success: true, ... }`

**Well-structured data:**

- Timestamp consistency (mostly using Date objects, some using Unix timestamps)
- Nested data follows logical hierarchies

### Issues Identified

#### Issue 2.1: Inconsistent Success Response Shapes

**Severity**: Medium
**Location**: Multiple routes

**Problem**: Different patterns for successful operations:

**Pattern A: Full resource return**

```javascript
// orgs/projects.js:181-192
return c.json(
  {
    id: projectId,
    name: name.trim(),
    description: description?.trim() || null,
    orgId,
    role: 'owner',
    createdAt: now,
    updatedAt: now,
  },
  201,
);
```

**Pattern B: Success flag with partial data**

```javascript
// orgs/index.js:157
return c.json({ success: true, orgId, ...result });

// orgs/index.js:190
return c.json({ success: true, deleted: orgId });

// orgs/projects.js:281
return c.json({ success: true, projectId });
```

**Pattern C: Delegated response (no wrapping)**

```javascript
// orgs/index.js:33
return c.json(result); // Raw Better Auth response
```

**Impact**: Frontend code must handle different response shapes for similar operations

**Recommendation**: Standardize on one pattern:

**For GET operations** (queries): Return resource or array directly

```javascript
return c.json(resource);
return c.json(resources);
```

**For POST/PUT operations** (mutations): Return full resource

```javascript
return c.json(createdResource, 201);
return c.json(updatedResource);
```

**For DELETE operations**: Return confirmation with resource ID

```javascript
return c.json({ success: true, deleted: resourceId });
```

**For custom actions**: Return action-specific result

```javascript
return c.json({ success: true, actionResult: ... });
```

#### Issue 2.2: Inconsistent Timestamp Formats

**Severity**: Medium
**Location**: Multiple routes

**Problem**: Mix of Date objects and Unix timestamps:

```javascript
// Date objects (most routes)
createdAt: now,  // Date object
updatedAt: now,  // Date object

// Unix timestamps (billing routes)
currentPeriodEnd: Math.floor(date.getTime() / 1000),  // Unix timestamp (seconds)
expiresAt: Math.floor(expiresAt.getTime() / 1000),   // Unix timestamp (seconds)

// Millisecond timestamps (Durable Object sync)
createdAt: now.getTime(),  // Unix timestamp (milliseconds)
updatedAt: now.getTime(),  // Unix timestamp (milliseconds)
```

**Impact**:

- Frontend must handle multiple date formats
- Potential confusion between seconds and milliseconds
- JSON serialization of Date objects varies by client

**Recommendation**: Standardize to **ISO 8601 strings** for all API responses:

```javascript
// Consistent pattern:
{
  createdAt: now.toISOString(),      // "2026-01-06T12:34:56.789Z"
  updatedAt: now.toISOString(),      // "2026-01-06T12:34:56.789Z"
  expiresAt: expiresAt.toISOString() // "2026-01-20T12:34:56.789Z"
}
```

Benefits:

- Universally parseable
- Timezone-aware
- Human-readable
- Consistent precision

#### Issue 2.3: Inconsistent Metadata Augmentation

**Severity**: Low
**Location**: Multiple routes

**Problem**: Some endpoints add extra metadata, others don't:

```javascript
// orgs/index.js:119-122 - Adds projectCount
return c.json({
  ...result,
  projectCount: projectCount?.count || 0,
});

// orgs/projects.js:232-235 - Adds role
return c.json({
  ...result,
  role: projectRole,
});

// orgs/index.js:33 - Returns raw result
return c.json(result);
```

**Recommendation**: Document which endpoints add computed fields and maintain consistency. Consider a standardized `meta` object for computed/derived fields:

```javascript
return c.json({
  ...resource,
  meta: {
    projectCount: count,
    userRole: role,
    computedAt: new Date().toISOString(),
  },
});
```

#### Issue 2.4: Mixed Data Wrapping in Lists

**Severity**: Low
**Location**: admin/users.js:175-183

**Problem**: List endpoints inconsistently wrap data:

**Pattern A: Wrapped with pagination**

```javascript
// admin/users.js:175-183
return c.json({
  users: usersWithProviders,
  pagination: {
    page,
    limit,
    total: totalResult?.count || 0,
    totalPages: Math.ceil((totalResult?.count || 0) / limit),
  },
});
```

**Pattern B: Direct array return**

```javascript
// orgs/projects.js:61
return c.json(results); // Array of projects
```

**Pattern C: Wrapped without pagination**

```javascript
// billing/index.js:151-154
return c.json({
  members: result.members || [],
  count: result.members?.length || 0,
});
```

**Recommendation**: Use wrapped format consistently for all lists:

```javascript
// For paginated lists:
{
  data: [...],
  pagination: { page, limit, total, totalPages }
}

// For non-paginated lists:
{
  data: [...],
  count: number
}

// Or use top-level array for simple cases (if no metadata needed)
[...]
```

## 3. Error Formats

### Strengths

**Excellent error consistency:**

- Centralized error creation via `createDomainError()` from `@corates/shared`
- Consistent error structure with domain-specific error codes
- Proper HTTP status codes
- Rich error context with field/operation details

**Standardized error domains:**

```javascript
AUTH_ERRORS;
USER_ERRORS;
PROJECT_ERRORS;
FILE_ERRORS;
VALIDATION_ERRORS;
SYSTEM_ERRORS;
```

**Consistent error handling pattern:**

```javascript
try {
  // operation
} catch (error) {
  console.error('Context message:', error);
  const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
    operation: 'operation_name',
    originalError: error.message,
  });
  return c.json(dbError, dbError.statusCode);
}
```

### Issues Identified

#### Issue 3.1: String-Based Error Reasons vs Error Codes

**Severity**: Low
**Location**: Multiple routes

**Problem**: Mix of error reason patterns:

```javascript
// Pattern A: Structured error with reason
createDomainError(AUTH_ERRORS.FORBIDDEN, {
  reason: 'org_not_found', // Snake_case string
  orgId,
});

// Pattern B: Field-based validation error
createDomainError(VALIDATION_ERRORS.INVALID_INPUT, {
  field: 'targetPlan',
  value: targetPlan,
});

// Pattern C: String message override
createDomainError(
  SYSTEM_ERRORS.INTERNAL_ERROR,
  {
    operation: 'create_checkout_session',
    originalError: error.message,
  },
  'Custom message string',
); // Third parameter
```

**Observation**: This is actually quite good - different error types use appropriate patterns. However, documentation would help clarify when to use each pattern.

**Recommendation**: Document error patterns in API guide:

- Auth/permission errors: Use `reason` field with snake_case identifier
- Validation errors: Use `field` and `value` fields
- System errors: Use `operation` and `originalError` fields
- Custom messages: Use third parameter sparingly

#### Issue 3.2: Inconsistent Error Message Checking

**Severity**: Low
**Location**: Multiple catch blocks

**Problem**: Error detection via string matching is fragile:

```javascript
// orgs/index.js:74-78
if (error.message?.includes('slug')) {
  const slugError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
    reason: 'slug_taken',
  });
  return c.json(slugError, slugError.statusCode);
}

// orgs/index.js:264-268
if (error.message?.includes('already') || error.message?.includes('member')) {
  const memberError = createDomainError(AUTH_ERRORS.FORBIDDEN, {
    reason: 'already_member',
  });
  return c.json(memberError, memberError.statusError);
}
```

**Impact**: Brittle error handling that depends on error message text

**Recommendation**:

1. Prefer error codes/types over string matching
2. If using Better Auth, check their error structure for typed errors
3. Consider wrapping Better Auth calls with typed error translation:

```javascript
try {
  const result = await auth.api.createOrganization(...);
  return c.json(result, 201);
} catch (error) {
  // Translate Better Auth errors to domain errors
  if (error.code === 'SLUG_TAKEN') {
    return c.json(createDomainError(AUTH_ERRORS.FORBIDDEN, {
      reason: 'slug_taken'
    }), 403);
  }
  // Generic fallback
  return c.json(createDomainError(SYSTEM_ERRORS.DB_ERROR, {
    operation: 'create_organization',
    originalError: error.message
  }), 500);
}
```

### Positive Observations

**Excellent practices:**

- All errors return JSON (no plain text error responses)
- Errors include operation context
- Console logging for debugging while returning user-friendly errors
- Rate limiting with descriptive error responses
- CSRF protection with clear error messages

## 4. Pagination Patterns

### Current State

**Only one paginated endpoint found:**

```javascript
// admin/users.js:84-92
GET /api/admin/users
Query params:
  - page: page number (default 1)
  - limit: results per page (default 20, max 100)
  - search: search by email or name
  - sort: field to sort by (default createdAt)  // Not implemented
  - order: asc or desc (default desc)          // Not implemented

Response:
{
  users: [...],
  pagination: {
    page: 1,
    limit: 20,
    total: 150,
    totalPages: 8
  }
}
```

**Non-paginated list endpoints:**

- `GET /api/orgs` - Returns all user's orgs (typically small)
- `GET /api/orgs/:orgId/projects` - Returns all user's projects in org
- `GET /api/orgs/:orgId/members` - Returns all org members
- `GET /api/orgs/:orgId/projects/:projectId/members` - Returns all project members
- `GET /api/orgs/:orgId/projects/:projectId/pdfs` - Returns all PDFs

### Issues Identified

#### Issue 4.1: No Pagination for Potentially Large Lists

**Severity**: Medium
**Location**: Multiple list endpoints

**Problem**: Several endpoints could return large result sets without pagination:

- **PDFs per project**: Could grow to hundreds/thousands
- **Org members**: Could grow to hundreds in enterprise orgs
- **Project members**: Could grow to dozens/hundreds

**Impact**:

- Performance degradation with large datasets
- High memory usage in browser
- Slow initial page loads

**Recommendation**: Implement cursor-based pagination for list endpoints that could grow large:

```javascript
// Query params:
?cursor=<opaque_token>&limit=50

// Response:
{
  data: [...],
  pagination: {
    nextCursor: "eyJpZCI6IjEyMyIsInRzIjoxNjc....",  // Opaque cursor
    hasMore: true,
    limit: 50
  }
}
```

**Priority targets:**

1. `GET /api/orgs/:orgId/projects/:projectId/pdfs` (HIGH - can grow very large)
2. `GET /api/orgs/:orgId/members` (MEDIUM - orgs can be large)
3. `GET /api/orgs/:orgId/projects` (LOW - users typically have <20 projects)

#### Issue 4.2: Inconsistent Pagination Implementation

**Severity**: Low
**Location**: admin/users.js:84-92

**Problem**: Pagination query params are documented but not all are implemented:

```javascript
const page = Math.max(1, parseInt(c.req.query('page') || '1', 10));
const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') || '20', 10)));
const search = c.req.query('search')?.trim();
const offset = (page - 1) * limit;

// sort and order params are mentioned in comments but not used
// Query is hardcoded to: orderBy(desc(user.createdAt))
```

**Recommendation**: Either implement the sort/order params or remove from documentation

#### Issue 4.3: No Standard Pagination Helper

**Severity**: Low
**Location**: N/A (missing)

**Problem**: Pagination logic is implemented inline rather than through a reusable utility

**Recommendation**: Create pagination helpers:

```javascript
// lib/pagination.js
export function parsePaginationParams(c, defaults = {}) {
  return {
    page: Math.max(1, parseInt(c.req.query('page') || defaults.page || '1', 10)),
    limit: Math.min(
      defaults.maxLimit || 100,
      Math.max(1, parseInt(c.req.query('limit') || defaults.limit || '20', 10))
    ),
    offset: function() { return (this.page - 1) * this.limit; }
  };
}

export function createPaginationResponse(data, total, params) {
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.ceil(total / params.limit),
      hasNext: params.page * params.limit < total,
      hasPrev: params.page > 1
    }
  };
}

// Usage:
const pagination = parsePaginationParams(c, { limit: 20, maxLimit: 100 });
const users = await db.select()...limit(pagination.limit).offset(pagination.offset());
const [{ count: total }] = await db.select({ count: count() })...;
return c.json(createPaginationResponse(users, total, pagination));
```

## 5. Additional Observations

### Positive Patterns

**Rate Limiting:**

- Properly implemented on sensitive endpoints
- Descriptive rate limit identifiers: `searchRateLimit`, `billingCheckoutRateLimit`
- Applied at route level for clarity

**Middleware Organization:**

- Clear separation of concerns: auth, CSRF, quota, entitlement
- Composable middleware chains
- Context helpers: `getAuth(c)`, `getOrgContext(c)`, `getProjectContext(c)`

**Validation:**

- Zod schemas for request validation
- `validateRequest()` middleware for consistent validation
- Proper error responses for validation failures

**Legacy Migration:**

- Deprecated routes return 410 Gone with helpful migration messages
- Webhook redirect endpoint provides clear guidance

**Observability:**

- Structured logging via `createLogger()`
- Stripe webhook ledger for audit trail
- Request ID tracking

### Areas for Improvement

#### Improvement 5.1: OpenAPI/Swagger Documentation

**Current**: No machine-readable API schema
**Recommendation**: Generate OpenAPI 3.0 spec from routes

Benefits:

- Auto-generated client SDKs
- Interactive API documentation
- Contract testing
- Type safety for frontend

Tools:

- `@hono/zod-openapi` - Generate OpenAPI from Zod schemas
- Swagger UI integration

#### Improvement 5.2: Response Type Definitions

**Current**: Responses are not typed
**Recommendation**: Export TypeScript interfaces for all response shapes

```typescript
// types/api-responses.ts
export interface ProjectResponse {
  id: string;
  name: string;
  description: string | null;
  orgId: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}
```

#### Improvement 5.3: Versioning Strategy

**Current**: No API versioning
**Recommendation**: Plan for future versioning

Options:

1. URL versioning: `/api/v1/orgs`, `/api/v2/orgs`
2. Header versioning: `Accept: application/vnd.corates.v1+json`
3. Query param: `/api/orgs?v=1`

Recommendation: Start with URL versioning when breaking changes are needed

#### Improvement 5.4: Consistent Field Naming

**Current**: Mix of camelCase and snake_case
**Observation**: Generally good - JavaScript/JSON uses camelCase consistently

Minor inconsistencies:

- Error `reason` fields use snake_case (acceptable)
- Database fields follow DB conventions
- API responses use camelCase

**Status**: No action needed, current approach is reasonable

## Summary of Issues by Severity

### High Severity

None identified. The API is well-structured.

### Medium Severity

1. **Issue 2.1**: Inconsistent success response shapes
2. **Issue 2.2**: Inconsistent timestamp formats
3. **Issue 4.1**: No pagination for potentially large lists

### Low Severity

1. **Issue 1.1**: Inconsistent action endpoint naming
2. **Issue 1.2**: PDF route nesting inconsistency
3. **Issue 1.3**: Inconsistent ID parameter naming
4. **Issue 2.3**: Inconsistent metadata augmentation
5. **Issue 2.4**: Mixed data wrapping in lists
6. **Issue 3.2**: Error message string matching fragility
7. **Issue 4.2**: Incomplete pagination implementation
8. **Issue 4.3**: No standard pagination helper

### Very Low Severity

None that weren't already categorized.

## Recommendations Priority

### P0 (Critical - Do Soon)

1. **Standardize timestamp formats** to ISO 8601 strings across all endpoints
2. **Add pagination** to PDF list endpoint (highest risk of large datasets)

### P1 (Important - Plan For)

1. **Standardize success response shapes** across all mutation endpoints
2. **Create pagination helpers** for reusable pagination logic
3. **Document error patterns** in API development guide

### P2 (Nice to Have - Future)

1. **Standardize action endpoint naming** convention
2. **Review PDF/study nesting** and align with domain model
3. **Add OpenAPI documentation** generation
4. **Create TypeScript response types** for all endpoints
5. **Plan API versioning strategy** for future breaking changes

## Conclusion

The CoRATES API demonstrates **strong overall consistency**, particularly in:

- Error handling and domain modeling
- RESTful resource naming
- Middleware architecture
- Security patterns (auth, CSRF, rate limiting)

The main areas for improvement are:

- Response shape standardization
- Timestamp format consistency
- Pagination for scalability

These are relatively minor issues that can be addressed incrementally without breaking existing clients. The API is production-ready and well-architected, with clear patterns that developers can follow.

**Action Items:**

1. Create API development guide documenting current patterns
2. Implement P0 recommendations in next sprint
3. Plan P1 recommendations for Q1 2026
4. Consider P2 recommendations for H1 2026

## Appendix: Route Inventory

### Public Routes (No Auth)

- `POST /api/contact` - Contact form submission
- `POST /api/email/send` - Email sending (rate limited)
- `POST /api/billing/webhook` - Stripe webhook (deprecated)
- `POST /api/billing/purchases/webhook` - Stripe webhook for purchases
- `GET /health` - Health check
- `GET /healthz` - Liveness probe

### Authenticated Routes

**Organizations:**

- `GET /api/orgs` - List user's orgs
- `POST /api/orgs` - Create org
- `GET /api/orgs/:orgId` - Get org details
- `PUT /api/orgs/:orgId` - Update org (admin+)
- `DELETE /api/orgs/:orgId` - Delete org (owner)
- `GET /api/orgs/:orgId/members` - List members
- `POST /api/orgs/:orgId/members` - Add member (admin+)
- `PUT /api/orgs/:orgId/members/:memberId` - Update member role (admin+)
- `DELETE /api/orgs/:orgId/members/:memberId` - Remove member (admin+ or self)
- `POST /api/orgs/:orgId/set-active` - Set active org

**Projects (Org-scoped):**

- `GET /api/orgs/:orgId/projects` - List projects
- `POST /api/orgs/:orgId/projects` - Create project
- `GET /api/orgs/:orgId/projects/:projectId` - Get project
- `PUT /api/orgs/:orgId/projects/:projectId` - Update project
- `DELETE /api/orgs/:orgId/projects/:projectId` - Delete project (owner)
- `POST /api/orgs/:orgId/projects/:projectId/leave` - Leave project

**Project Members:**

- `GET /api/orgs/:orgId/projects/:projectId/members` - List members
- `POST /api/orgs/:orgId/projects/:projectId/members` - Add member (owner)
- `PUT /api/orgs/:orgId/projects/:projectId/members/:userId` - Update role (owner)
- `DELETE /api/orgs/:orgId/projects/:projectId/members/:userId` - Remove (owner or self)

**Project Invitations:**

- `GET /api/orgs/:orgId/projects/:projectId/invitations` - List invitations
- `POST /api/orgs/:orgId/projects/:projectId/invitations` - Send invitation (owner)
- `DELETE /api/orgs/:orgId/projects/:projectId/invitations/:invId` - Cancel (owner)
- `POST /api/orgs/:orgId/projects/:projectId/invitations/:invId/resend` - Resend (owner)
- `POST /api/orgs/:orgId/projects/:projectId/invitations/accept/:token` - Accept

**PDFs:**

- `GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs` - List PDFs
- `POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs` - Upload PDF
- `GET /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:pdfId` - Get PDF
- `PUT /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:pdfId` - Update PDF
- `DELETE /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:pdfId` - Delete PDF
- `POST /api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:pdfId/duplicates` - Find duplicates

**Users:**

- `GET /api/users/search` - Search users (rate limited)
- `GET /api/users/:userId` - Get user profile
- `PUT /api/users/:userId` - Update user
- `DELETE /api/users/:userId` - Delete user
- `POST /api/users/avatar` - Upload avatar
- `DELETE /api/users/avatar` - Delete avatar

**Billing (Org-scoped):**

- `GET /api/billing/subscription` - Get subscription status
- `GET /api/billing/members` - Get org members count
- `GET /api/billing/validate-plan-change` - Validate plan change
- `POST /api/billing/checkout` - Create Stripe checkout (owner)
- `POST /api/billing/portal` - Create Stripe portal (owner)
- `POST /api/billing/single-project/checkout` - Buy single project (owner)
- `POST /api/billing/trial/start` - Start trial (owner)

**Google Drive:**

- `GET /api/google-drive/status` - Connection status
- `GET /api/google-drive/picker-token` - Get picker token
- `POST /api/google-drive/import` - Import files

**Account Management:**

- `POST /api/accounts/merge/initiate` - Start merge
- `POST /api/accounts/merge/verify` - Verify merge
- `POST /api/accounts/merge/complete` - Complete merge

### Admin Routes (Admin Role Required)

**User Management:**

- `GET /api/admin/stats` - Dashboard stats
- `GET /api/admin/users` - List all users (paginated)
- `GET /api/admin/users/:userId` - Get user details
- `POST /api/admin/users/:userId/ban` - Ban user
- `POST /api/admin/users/:userId/unban` - Unban user
- `POST /api/admin/users/:userId/impersonate` - Impersonate user
- `DELETE /api/admin/users/:userId` - Delete user
- `DELETE /api/admin/users/:userId/sessions` - Revoke sessions

**Storage Management:**

- `GET /api/admin/storage/usage` - R2 usage stats
- `GET /api/admin/storage/files` - List R2 files
- `DELETE /api/admin/storage/files/:fileKey` - Delete R2 file
- `POST /api/admin/storage/cleanup` - Cleanup orphans

**Billing Management:**

- `GET /api/admin/billing/subscriptions` - List subscriptions
- `GET /api/admin/billing/orgs/:orgId/subscription` - Get org subscription
- `POST /api/admin/billing/orgs/:orgId/subscription/cancel` - Cancel subscription
- `POST /api/admin/billing/grants` - Create grant

**Billing Observability:**

- `GET /api/admin/billing/observability/ledger` - Webhook ledger
- `GET /api/admin/billing/observability/grants` - List grants

**Database Management:**

- `GET /api/admin/database/tables` - List tables
- `GET /api/admin/database/tables/:tableName/schema` - Table schema
- `GET /api/admin/database/tables/:tableName/data` - Table data
- `GET /api/admin/database/analytics/pdfs-by-org` - PDF analytics
- `GET /api/admin/database/analytics/pdfs-by-user` - PDF analytics
- `GET /api/admin/database/analytics/pdfs-by-project` - PDF analytics
- `GET /api/admin/database/analytics/users-by-org` - User analytics

**Organization Management:**

- `GET /api/admin/orgs` - List all orgs
- `GET /api/admin/orgs/:orgId` - Get org details

### WebSocket Routes

- `GET /api/project-doc/:projectId` - ProjectDoc Durable Object
- `GET /api/sessions/:sessionId` - UserSession Durable Object

### Development Only

- `GET /api/db/users` - List users (dev)
- `POST /api/db/users` - Create test user (dev)
- `POST /api/db/migrate` - Run migrations (dev)
- `GET /docs` - API documentation (dev)

**Total Endpoints**: 100+
