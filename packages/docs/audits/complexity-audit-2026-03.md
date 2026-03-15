# Codebase Complexity Audit -- March 2026

A full-codebase audit focused on identifying sources of complexity, maintenance friction, and bug-prone areas. Findings are organized by severity and area.

---

## Executive Summary

The codebase has solid architectural foundations -- good package boundaries, a well-structured shared package, and clean backend patterns. The SolidJS web package is being retired imminently (within the week) in favor of the React-based landing package, so frontend findings focus on the landing package and shared concerns only. The primary sources of complexity are:

1. **Framework-agnostic utilities duplicated in landing** that should be extracted to `@corates/shared` before the web package is deleted (13 files)
2. **Security gaps** in the backend (CSRF, user deletion, auth bypass)
3. **Large backend files** concentrating too many concerns
4. **Duplicated backend patterns** (error schemas, middleware helpers, invitation logic)
5. **Type safety gaps** between frontend and backend (no shared API contract)

---

## Part 1: Security Issues (Fix First)

### S1. User deletion destroys other people's projects

**File:** `packages/workers/src/routes/users.ts:368-405`

The `DELETE /api/users/me` handler runs:

```typescript
db.delete(projects).where(eq(projects.createdBy, userId));
```

This deletes every project the user originally created, even if other users are now owners or active members. A user who created a shared project and then deletes their account would destroy everyone else's work.

**Fix:** Only delete projects where the user is the sole member, or transfer ownership before deletion.

### S2. Missing CSRF protection on critical endpoints

`requireTrustedOrigin` is applied to admin routes and stop-impersonation, but not to:

- `DELETE /api/users/me` (account deletion)
- `POST /api/accounts/merge/*` (account merging)
- `DELETE /api/google-drive/disconnect`
- `POST /api/billing/checkout`

These are cookie-authenticated, state-changing operations vulnerable to cross-site request forgery.

**Fix:** Apply `requireTrustedOrigin` middleware to all state-changing endpoints.

### S3. Google Drive import bypasses org-level authorization

**File:** `packages/workers/src/routes/google-drive.ts:362-552`

The import route checks `requireProjectEdit(db, user.id, projectId)` but does not verify org membership or org write access. Compare with PDF upload which runs `requireOrgMembership()`, `requireOrgWriteAccess()`, and `requireProjectAccess()`. A user with project access but read-only org access could import files via Google Drive but not via direct upload.

**Fix:** Add `requireOrgMembership` and `requireOrgWriteAccess` checks to the Google Drive import route.

### S4. Internal error messages leak in production

**File:** `packages/workers/src/routes/orgs/index.ts:551` (and many other route files)

Every `DB_ERROR` construction passes `originalError: error.message` unconditionally -- not gated by environment. The global error handler gates stack traces, but route-level catch blocks include internal error details in all environments.

**Fix:** Gate `originalError` inclusion behind an environment check, or strip it in the global error handler before sending responses.

### S5. Unauthenticated migration endpoint

**File:** `packages/workers/src/routes/database.ts:162`

`POST /api/db/migrate` has no authentication. While it appears read-only (checks migration status), it is a POST endpoint that can be probed externally.

---

## Part 2: Architecture -- The Duplication Problem

### A1. Framework-agnostic utilities must be extracted before web package deletion

The web package is being deleted within the week. 13 framework-agnostic utility files currently live as local copies in the landing package. Once web is gone, these become the only copies with no upstream reference. They should be extracted to `@corates/shared` or a new `@corates/lib` package now.

**Immediately shareable (identical or import-path-only differences):**

| Category           | Files                                                                                                |
| ------------------ | ---------------------------------------------------------------------------------------------------- |
| **Pure utilities** | `referenceParser.js`, `pdfValidation.js`, `pdfUtils.js`, `errorLogger.js`, `formStatePersistence.js` |
| **Primitives**     | `db.js`, `pdfCache.js`, `avatarCache.js`                                                             |
| **Registries**     | `checklist-registry/types.js`                                                                        |
| **API clients**    | `google-drive.js`, `pdf-api.js`                                                                      |
| **Project sync**   | `useProject/outcomes.js`, `useProject/reconciliation.js`                                             |

**Require minor work before sharing:**

| File                          | Issue                                                                                                                                                                                                                      |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `checklist-domain.js`         | Landing has more accurate JSDoc types (`string \| null` for userId) -- use landing version                                                                                                                                 |
| `checklist-registry/index.js` | Landing already imports from `@corates/shared` (correct); web still imports from component-local files                                                                                                                     |
| `useProject/sync.js`          | Framework-specific store access (`useProjectStore.getState()` vs `projectStore`). Core sync logic (buildStudyFromYMap, etc.) is identical and extractable; store interaction stays in landing                              |
| `useProject/studies.js`       | Same store access difference. CRUD logic is identical and extractable                                                                                                                                                      |
| `useProject/annotations.js`   | Landing version is cleaner (removed debug console.logs from web). Use landing version                                                                                                                                      |
| `error-utils`                 | Most diverged file. Landing has TypeScript types, different navigate API shape (`{ to: '/signin' }` vs `('/signin')`), and different route name (`/check-email` vs `/verify-email`). Needs a navigate abstraction to share |
| `account-merge`               | Landing has TypeScript interfaces. Runtime logic identical. Use landing `.ts` version                                                                                                                                      |

### A2. `runMiddleware` helper duplicated in 5 backend files

The same function is copy-pasted into 5 files under `routes/orgs/`. This exists because OpenAPIHono cannot chain `.use()` middleware on specific openapi routes.

**Recommendation:** Extract to `lib/runMiddleware.ts`.

### ~~A3. Error schema boilerplate duplicated in 10+ route files~~ RESOLVED

All 29 route files now import `ErrorResponseSchema` from `schemas/common.ts`. No local error schema definitions remain.

### A3. Duplicate invitation acceptance logic

Invitation acceptance is implemented twice with largely the same logic:

- `routes/invitations.ts` (standalone `/api/invitations/accept`)
- `routes/orgs/invitations.ts` (org-scoped `POST /accept`)

Both do token lookup, email verification, org membership check, batch insert, DO sync, and notification.

**Recommendation:** Extract shared logic into a command/service function.

---

## Part 3: File Size Hotspots

Backend files over 500 lines that should be split:

| Lines | File                                    | Recommended split                                                    |
| ----- | --------------------------------------- | -------------------------------------------------------------------- |
| 938   | `workers/routes/orgs/index.ts`          | Split by resource: org CRUD, org settings, org membership            |
| 931   | `workers/routes/orgs/invitations.ts`    | After extracting shared invitation logic (A4)                        |
| 808   | `workers/routes/orgs/pdfs.ts`           | PDF upload, download, metadata as separate route files               |
| 733   | `workers/routes/orgs/members.ts`        | Member CRUD, role management, invitation-related members logic       |
| 715   | `workers/durable-objects/ProjectDoc.ts` | Extract RPC handlers, member sync logic into separate modules        |
| 654   | `workers/auth/config.ts`                | Configuration-heavy by nature, but plugin setup could be modularized |
| 554   | `workers/routes/google-drive.ts`        | Extract token management/refresh into a service module               |

Landing package files to watch as the migration continues:

| Lines | File                                                             | Notes                                                             |
| ----- | ---------------------------------------------------------------- | ----------------------------------------------------------------- |
| 570   | `landing/components/FeatureShowcase.tsx`                         | Marketing component, acceptable for now                           |
| 508   | `landing/components/billing/PricingTable.tsx`                    | Plan card, feature comparison, billing toggle could be split      |
| 501   | `landing/components/project/overview-tab/ReviewerAssignment.tsx` | Percentage slider, preset selector, allocation logic as utilities |

---

## Part 4: Type Safety Gaps

### T1. No shared API contract types

Workers defines routes with Zod schemas, but these types are not exported. The frontend constructs API calls with `apiFetch` and manually shapes data. Any API change requires coordinating across packages by convention, not compilation.

**Recommendation:** Generate TypeScript types from the OpenAPI schema (already generated via `pnpm openapi`) and consume them in the frontend.

### T2. Database schema types locked in workers

Drizzle schema at `workers/db/schema.ts` defines all table shapes, but inferred types are never exported. Frontend code has no typed knowledge of row shapes.

### T3. Subscription tier naming inconsistency

`SUBSCRIPTION_TIERS` in `workers/config/constants.ts` uses `'free' | 'basic' | 'pro' | 'team' | 'enterprise'`. `PlanId` in `@corates/shared/plans` uses `'free' | 'starter_team' | 'team' | 'unlimited_team'`. These should be a single source of truth.

### T4. Duplicated interfaces within workers

`MemberData` / `ProjectMeta` / `ProjectMember` are defined in both `lib/project-sync.ts` and `lib/syncWithRetry.ts` with different field sets.

---

## Part 5: Backend Correctness Issues

### B1. Triple `resolveOrgAccess` calls per request

When a route applies `requireOrgWriteAccess()`, `requireEntitlement()`, and `requireQuota()` in sequence (e.g., `routes/orgs/projects.ts:345-355`), each independently calls `resolveOrgAccess(db, orgId)`, hitting subscriptions and grants tables. None checks if the result is already set via `c.set('orgBilling', ...)`.

**Fix:** Check `c.get('orgBilling')` before re-resolving.

### B2. Billing endpoints rely on stale session state

**File:** `routes/billing/subscription.ts`

Billing routes use `resolveOrgId({ db, session, userId })` which reads `activeOrganizationId` from the session. If a user's session has a stale `activeOrganizationId` pointing to an org they've left, these endpoints may return incorrect data.

**Fix:** Use explicit org ID from URL parameters, consistent with org-scoped routes.

### B3. Fragile string-matching error handling

**File:** `routes/orgs/index.ts:583-593`

Org management routes catch errors and check `error.message?.includes('slug')` to determine error type. If the underlying error message text changes, the specific error won't surface correctly.

**Fix:** Use `isDomainError(err)` checks and typed error codes instead of string matching.

### B4. In-memory rate limiting on distributed workers

**File:** `middleware/rateLimit.ts`

The rate limiter uses a module-level `Map`. On Cloudflare Workers, each isolate gets its own map and isolates are ephemeral. Rate limiting only works per-isolate and is trivially bypassable.

**Fix:** Use Cloudflare's rate limiting API or a Durable Object for shared state.

### B5. 106 `@ts-expect-error` comments

Every OpenAPIHono route handler is preceded by `// @ts-expect-error OpenAPIHono strict return types`. This indicates the route definitions don't declare all possible error responses. A wrapper type or a base route factory could eliminate these.

---

## Part 6: Code Quality

### Q1. Dead code in workers

- `asyncHandler` in `middleware/errorHandler.ts` is a no-op function that does nothing
- `routes/members.ts` at the root level appears unused (not imported in `index.ts`)

### Q2. Vitest version mismatch prevents shared test infrastructure -- NOW UNBLOCKED

Workers pins `vitest@3.2.0` for `@cloudflare/vitest-pool-workers` compatibility. Everything else uses `vitest@^4.0.18`. However, `@cloudflare/vitest-pool-workers@0.13.0` (released March 10, 2026) now requires `vitest ^4.1.0`. Upgrading the workers package to vitest 4 + pool-workers 0.13.0 would unify versions across the monorepo and unblock shared test infrastructure.

---

## Recommended Priority Order

**Immediate (security):**

1. S1 -- Fix user deletion to not destroy shared projects
2. S2 -- Add CSRF protection to state-changing endpoints
3. S3 -- Add org-level auth to Google Drive import

**Short-term (before web package deletion):** 4. A1 -- Extract framework-agnostic utilities to `@corates/shared` before the web package is deleted and the landing copies become orphaned 5. S4 -- Gate error detail leaking in production

**Medium-term (reduce backend complexity):**
6. A2 -- Extract runMiddleware helper
7. A3 -- Unify invitation acceptance logic
8. Split the largest backend route files (orgs/index.ts, orgs/invitations.ts, orgs/pdfs.ts)
9. B1 -- Cache orgBilling resolution across middleware
10. Q2 -- Upgrade workers to vitest 4 + pool-workers 0.13.0 to unify test infrastructure

**Longer-term (structural improvements):**
11. T1 -- Generate API types from OpenAPI schema for landing package
12. T3 -- Unify subscription tier naming
13. B4 -- Move rate limiting to Cloudflare's native solution
14. B5 -- Address the 106 `@ts-expect-error` comments with a route factory pattern
