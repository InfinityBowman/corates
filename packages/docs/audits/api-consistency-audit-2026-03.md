# API Consistency Audit -- March 2026

A thorough audit of the CoRATES API covering URL design, response shapes, validation, middleware, auth, and error handling across all 128 endpoints.

---

## Executive Summary

The API has strong fundamentals -- consistent kebab-case URLs, proper CRUD method mapping, well-structured org-scoped resource hierarchy, and solid Zod validation coverage. The most impactful inconsistencies are:

1. **No standard response envelope** -- success responses use 5+ different shapes
2. **No pagination on user-facing list endpoints** -- only admin routes paginate
3. **Mixed error formats** -- domain errors, raw `{ error: string }`, and rate limit responses all differ
4. **Several endpoints where auth or validation is bypassed**
5. **Google Drive import orphans R2 files on DB failure** (unlike PDF upload which cleans up)

---

## Part 1: URL Design and HTTP Methods

### What's Good

- **Plural nouns everywhere**: `orgs`, `projects`, `members`, `invitations`, `pdfs`, `users`, `sessions`, `grants`, `subscriptions`, `invoices`
- **Consistent kebab-case** in all URL segments, camelCase for query params
- **Standard CRUD mapping**: GET=read, POST=create, PUT=update, DELETE=remove
- **Clean nested hierarchy**: `/api/orgs/:orgId/projects/:projectId/members/:userId`
- **128 total endpoints** across health, auth, users, orgs, billing, admin, and integrations

### HTTP Method Issues

| Endpoint | Issue |
|----------|-------|
| `POST /api/db/migrate` | Read-only status check uses POST. Should be GET. |
| `DELETE /api/accounts/merge/cancel` | DELETE with JSON body (`mergeToken`). Many clients/proxies don't support bodies on DELETE. Should be `POST .../cancel` or `DELETE .../merge/:mergeToken`. |

### Verb-Style Paths

These use action verbs instead of nouns. Not wrong per se, but inconsistent with the REST style used elsewhere:

| Endpoint | Suggestion |
|----------|------------|
| `POST /api/users/sync-profile` | `POST /api/users/me/sync` |
| `DELETE /api/google-drive/disconnect` | `DELETE /api/google-drive/connection` |
| `POST /api/orgs/:orgId/set-active` | `PUT /api/orgs/:orgId/active` |
| `POST /api/billing/trial/start` | `POST /api/billing/trials` |
| `GET /api/billing/validate-plan-change` | `GET /api/billing/plan-changes/validate` |
| `POST /api/billing/validate-coupon` | Arguably fine (keeps code out of URL/logs) |
| `POST /api/admin/stop-impersonation` | Action endpoint, acceptable for admin tooling |
| `POST /api/admin/users/:userId/ban` | `PUT /api/admin/users/:userId/ban` with `{ banned: true/false }` |

### Duplicate/Overlapping Routes

| Route A | Route B | Issue |
|---------|---------|-------|
| `GET /api/billing/members` | `GET /api/orgs/:orgId/members` | Same data, different resolution (session vs explicit orgId) |
| `POST /api/invitations/accept` | `POST /api/orgs/:orgId/.../invitations/accept` | Same logic implemented twice |
| `GET /api/db/users` | `GET /api/admin/users` | Legacy debug route duplicates admin |
| `POST /api/admin/orgs/:orgId/grants` | `POST /api/admin/orgs/:orgId/grant-trial` | Convenience endpoints duplicate generic grants with hardcoded types |

### Dead Code

`routes/members.ts` (726 lines) defines member routes but is **never mounted** in `index.ts`. This is legacy code from before org-scoped routes were created.

### Deep Nesting

PDF routes have 4 levels: `/api/orgs/:orgId/projects/:projectId/studies/:studyId/pdfs/:fileName`. The `orgId` is used only for auth -- the PDF is stored by `projectId/studyId`. A flatter path would reduce URL length but lose the self-documenting hierarchy.

---

## Part 2: Response Shapes

### The Core Problem: No Standard Envelope

Success responses use at least 5 incompatible patterns:

**Pattern A -- Bare array** (most user-facing lists):
```json
[{ "id": "...", "name": "..." }, ...]
```
Used by: `GET /users/search`, `GET /users/me/projects`, `GET /:projectId/members`, `GET /orgs`, `GET /orgs/:orgId/projects`

**Pattern B -- Wrapped list** (admin routes, some others):
```json
{ "users": [...], "pagination": { "page": 1, "limit": 20, "total": 100 } }
```
Used by: `GET /admin/users`, `GET /admin/orgs`, `GET /admin/projects`, `GET /.../pdfs` (as `{ pdfs: [...] }`)

**Pattern C -- `{ success: true, ... }`** (most mutations):
```json
{ "success": true, "message": "...", "orgId": "..." }
```
Used by: `DELETE /users/me`, `POST /users/sync-profile`, `PUT /orgs/:orgId`, `DELETE /orgs/:orgId`, most admin mutations

**Pattern D -- Raw entity** (single-item reads and some creates):
```json
{ "id": "...", "name": "...", "role": "member" }
```
Used by: `GET /orgs/:orgId`, `POST /orgs/:orgId/projects`, `GET /orgs/:orgId/projects/:projectId`

**Pattern E -- Mixed shapes from the same endpoint**:
`POST /:projectId/members` returns EITHER `{ success: true, invitation: true, message, email }` (invitation created) OR a raw member object `{ userId, name, email }` (user added directly). The client must inspect the shape to determine which path was taken.

**Recommendation**: Adopt a standard envelope. At minimum:
- Lists: `{ data: [...], pagination?: { ... } }`
- Single items: `{ data: { ... } }`
- Mutations: `{ data: { ... } }` or `{ success: true, data: { ... } }`

### Pagination

Three different approaches exist:

| Style | Where Used | Shape |
|-------|-----------|-------|
| Offset/limit with metadata | Admin routes | `{ items, pagination: { page, limit, total, totalPages } }` |
| Cursor-based | Admin storage | `{ documents, limit, nextCursor, truncated }` |
| None | All user-facing list endpoints | Bare array, unbounded |

**User-facing routes have no pagination at all.** As data grows, this will become a performance problem. Affected: user projects, org projects, project members, project invitations, study PDFs.

### HTTP Status Codes

**Correct usage**: 201 for org/project/member/grant creation, 401 for unauthenticated, 403 for unauthorized, 404 for not found, 503 for service unavailable.

**Issues**:

| Endpoint | Returns | Should Return |
|----------|---------|---------------|
| `POST /avatar` | 200 | 201 (created) |
| `POST /google-drive/import` | 200 | 201 (created) |
| `POST /.../pdfs` (upload) | 200 | 201 (created) |
| Admin billing "not found" | 400 (`VALIDATION_ERRORS.FIELD_INVALID_FORMAT`) | 404 |
| `GET /orgs/:orgId` (org not found) | 403 (`AUTH_ERRORS.FORBIDDEN`) | 404 |

No endpoint returns 204. All DELETE operations return 200 with a JSON body. This is a deliberate and common choice.

---

## Part 3: Error Handling

### Error Response Shapes

**Domain errors** (the standard): Created via `createDomainError()` from `@corates/shared`. Shape: `{ code, message, statusCode, details, timestamp }`.

**OpenAPI `ErrorResponseSchema`**: Defines `{ code, message, statusCode, details? }` -- missing the `timestamp` field that runtime errors always include. The OpenAPI docs are inaccurate.

**Non-standard error formats in production code**:

| Location | Format | Issue |
|----------|--------|-------|
| Dev routes (`dev-routes.ts`) | `{ error: string }` | Different shape entirely |
| PDF proxy (`index.ts:165-279`) | `{ error: string, code?: string }` | Custom codes like `SSRF_BLOCKED` |
| Stop impersonation (`index.ts:129`) | `{ error: string }` | Raw error string |
| Rate limiter (`rateLimit.ts:75`) | `{ error: string, retryAfter: number }` | No domain error structure |

### Inconsistent "Not Found" Error Codes

| Route | Error Used | Correct? |
|-------|-----------|----------|
| Project routes | `PROJECT_ERRORS.NOT_FOUND` | Yes |
| User routes | `USER_ERRORS.NOT_FOUND` | Yes |
| Admin billing | `VALIDATION_ERRORS.FIELD_INVALID_FORMAT` | No -- semantically wrong for "not found" |
| Org routes | `AUTH_ERRORS.FORBIDDEN` with `reason: 'org_not_found'` | No -- 403 for a 404 condition |

### Google Drive Import Orphans Files

When the `mediaFiles` DB insert fails after a successful R2 upload (`google-drive.ts:517-519`), the handler logs the error but returns success. This creates orphaned R2 objects with no database record.

Compare with `orgs/pdfs.ts:643-656` which properly deletes the R2 object on DB insert failure. The inconsistency means R2 storage can grow with unreferenced files.

---

## Part 4: Validation and Middleware

### Validation Coverage

All route files use `OpenAPIHono` with `createRoute` and Zod schemas, with one intentional exception: `billing/webhooks.ts` uses plain Hono because Stripe webhook verification replaces schema validation.

**Shared validation hook** (`lib/honoValidationHook.ts`) is used consistently as `defaultHook` across all routes except:

| File | Issue |
|------|-------|
| `contact.ts` | Duplicates validation hook logic inline (90% identical, minor behavioral differences) |
| `health.ts` | No hook needed (no input) |
| `database.ts` | No hook (utility route) |
| `dev-routes.ts` | No hook (dev-only) |

### Validation Bypasses

| Route | Issue |
|-------|-------|
| Admin ban (`admin/users.ts:806-812`) | Reads body via `c.req.json()` instead of `c.req.valid('json')`, bypassing Zod validation despite having a schema defined |
| Dev import (`dev-routes.ts:349`) | Reads body via `c.req.json()` with no schema defined |
| PDF upload (`orgs/pdfs.ts`) | No `request.body` in `createRoute` definition -- manual validation in handler (magic bytes, size, filename). Thorough but undocumented in OpenAPI |

### Middleware Chain Patterns

The middleware application is consistent:
- Public routes: no auth middleware
- Authenticated routes: `requireAuth` via `use('*')`
- Org-scoped routes: `requireAuth` via `use('*')` + `runMiddleware(requireOrgMembership())` per handler
- Admin routes: `requireAdmin` + `requireTrustedOrigin` via `use('*')`

### Query Parameter Coercion

Admin routes parse pagination params manually (`parseInt(query.page || '1', 10)`) while user search uses Zod's `z.coerce.number()`. Both work, but the manual approach is more verbose and error-prone.

---

## Part 5: Authentication and Authorization

### Auth Coverage

Every route that should require auth does, with two exceptions:
1. `POST /api/db/migrate` -- no auth, reveals database schema existence
2. `POST /api/admin/stop-impersonation` -- no explicit `requireAuth` (relies on Better Auth handler internally rejecting unauthenticated requests)

### Authorization Gaps

| Route | Issue |
|-------|-------|
| Google Drive import | Uses `requireProjectEdit()` but skips `requireOrgWriteAccess()`. User in read-only org with project membership could import files. |
| Billing endpoints | Use `resolveOrgId()` from session's `activeOrganizationId` rather than explicit URL parameter. Stale session could reference an org the user left. |

### CSRF Protection

`requireTrustedOrigin` is applied only to admin routes. Other state-changing routes rely on CORS + JSON content-type requirement as implicit CSRF protection. This works because `application/json` triggers CORS preflight, but it's not defense-in-depth.

### Rate Limiting Coverage

| Protected | Not Protected |
|-----------|---------------|
| Contact form (5/15min) | PDF upload |
| User search (30/1min) | Google Drive import |
| Billing checkout (10/15min) | Avatar upload |
| Billing portal (20/15min) | Account deletion |
| Account merge (3-5/15min) | All admin routes |

Rate limiting uses in-memory `Map` -- per-isolate on Cloudflare Workers, making it ineffective against distributed attacks.

---

## Recommended Priority Order

**High priority -- affects correctness and client development:**
1. Standardize response envelope (bare arrays vs wrapped lists vs `{ success }` is the biggest source of frontend friction)
2. Fix Google Drive import to check `requireOrgWriteAccess()` and clean up R2 on DB failure
3. Add `timestamp` to `ErrorResponseSchema` to match runtime error shape
4. Fix admin billing routes using wrong error codes for "not found" (400 -> 404)
5. Fix `GET /orgs/:orgId` returning 403 when org not found (should be 404)

**Medium priority -- consistency and correctness:**
6. Add pagination to user-facing list endpoints (projects, members, invitations)
7. Use `c.req.valid('json')` in admin ban route instead of `c.req.json()`
8. Replace contact route's inline validation hook with shared `validationHook`
9. Return 201 for creation endpoints (avatar upload, PDF upload, Google Drive import)
10. Standardize error format for PDF proxy, rate limiter, and stop-impersonation

**Low priority -- cleanup and polish:**
11. Remove dead `routes/members.ts` (726 lines, never mounted)
12. Consolidate duplicate invitation acceptance endpoints
13. Consolidate `GET /api/billing/members` with `GET /api/orgs/:orgId/members`
14. Use `z.coerce.number()` for admin pagination params instead of manual `parseInt`
15. Add `requireAuth` to `POST /api/db/migrate` or remove it
