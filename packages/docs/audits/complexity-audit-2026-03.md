# Codebase Complexity Audit -- March 2026

A full-codebase audit focused on identifying sources of complexity, maintenance friction, and bug-prone areas. Findings are organized by severity and area.

---

## Executive Summary

The codebase has solid architectural foundations -- clean store patterns, good package boundaries, correct SolidJS reactivity usage, and a well-structured shared package. The primary sources of complexity are:

1. **Systematic file duplication** between web and landing packages (15+ files)
2. **Large files** concentrating too many concerns (12 files over 500 lines in production code)
3. **Missing type safety** in the web package (`strict: false`, `checkJs: false`)
4. **Security gaps** in the backend (CSRF, user deletion, auth bypass)
5. **Duplicated backend patterns** (error schemas, middleware helpers, invitation logic)

---

## Part 1: Security Issues (Fix First)

### S1. User deletion destroys other people's projects

**File:** `packages/workers/src/routes/users.ts:368-405`

The `DELETE /api/users/me` handler runs:
```typescript
db.delete(projects).where(eq(projects.createdBy, userId))
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

### A1. Web/Landing file duplication (highest maintenance risk)

The React migration has created 15+ utility files that are byte-for-byte identical or near-identical across both packages:

| Category | Files |
|----------|-------|
| **Pure utilities** | `referenceParser.js`, `checklist-domain.js`, `pdfValidation.js`, `pdfUtils.js`, `errorLogger.js`, `formStatePersistence.js`, `error-utils.js/.ts` |
| **Primitives** | `db.js`, `pdfCache.js`, `avatarCache.js` |
| **Registries** | `checklist-registry/index.js`, `checklist-registry/types.js` |
| **API clients** | `google-drive.js`, `pdf-api.js`, `account-merge.js/.ts` |
| **Project sync** | `useProject/sync.js`, `useProject/outcomes.js`, `useProject/studies.js`, `useProject/reconciliation.js`, `useProject/annotations.js` |
| **Tests** | All `lib/__tests__/` files are copies |

**Why this matters:** A bug fix to `referenceParser.js` must be applied to both packages. The `.js` (web) and `.ts` (landing) versions have already started diverging (e.g., `error-utils` is 266 lines in web vs 204 in landing).

**Recommendation:** Extract framework-agnostic utilities into `@corates/shared` or a new `@corates/lib` package. These files have zero framework dependencies -- they work with plain JS/TS.

### A2. Three identical ReconciliationWithPdf components

These three files are ~95% identical (182-183 lines each):
- `reconcile-tab/ReconciliationWithPdf.jsx` (AMSTAR2)
- `reconcile-tab/rob2-reconcile/ROB2ReconciliationWithPdf.jsx`
- `reconcile-tab/robins-i-reconcile/RobinsIReconciliationWithPdf.jsx`

They share identical: store creation, presence initialization, header layout, split-screen setup, remote cursors, and PDF viewer rendering. The only differences are the title string, the reconciliation component, and the navbar component.

**Recommendation:** One parameterized `ReconciliationWithPdf` component accepting `{ title, ReconciliationComponent, NavbarComponent }`.

### A3. PDF loading logic duplicated between two wrappers

The cache-check -> cloud-download -> store-in-cache pattern (5 signals, 3 memos, 2 effects, 1 handler -- ~60 lines) is copy-pasted between:
- `components/checklist/ChecklistYjsWrapper.jsx:150-196`
- `components/project/reconcile-tab/ReconciliationWrapper.jsx:142-183`

**Recommendation:** Extract a `usePdfLoader` primitive.

### A4. `runMiddleware` helper duplicated in 5 backend files

The same function is copy-pasted into 5 files under `routes/orgs/`. This exists because OpenAPIHono cannot chain `.use()` middleware on specific openapi routes.

**Recommendation:** Extract to `lib/runMiddleware.ts`.

### A5. Error schema boilerplate duplicated in 10+ route files

Every route file defines its own Zod error schema (`OrgErrorSchema`, `ProjectErrorSchema`, `PdfErrorSchema`, etc.) with identical structure. A `schemas/common.ts` file exists but is not used for this.

**Recommendation:** Define one `ErrorResponseSchema` in `schemas/common.ts` and import everywhere.

### A6. Duplicate invitation acceptance logic

Invitation acceptance is implemented twice with largely the same logic:
- `routes/invitations.ts` (standalone `/api/invitations/accept`)
- `routes/orgs/invitations.ts` (org-scoped `POST /accept`)

Both do token lookup, email verification, org membership check, batch insert, DO sync, and notification.

**Recommendation:** Extract shared logic into a command/service function.

### A7. Sidebar resize/mobile logic duplicated

`Sidebar.jsx` and `SettingsSidebar.jsx` duplicate resize drag handling, mobile overlay mount/animate, escape key close, and route change close.

**Recommendation:** Extract a `useSidebarBehavior` primitive.

---

## Part 3: File Size Hotspots

Production files over 500 lines that should be split:

| Lines | File | Recommended split |
|-------|------|-------------------|
| 804 | `web/api/better-auth-store.js` | Core auth state / social auth / 2FA / profile methods / session management |
| 829 | `web/components/checklist/AMSTAR2Checklist.jsx` | Data-driven approach: 16 Question components share ~80% structure, extract per-question handlers to config |
| 697 | `web/components/project/reconcile-tab/rob2-reconcile/ROB2Reconciliation.jsx` | After extracting shared ReconciliationWithPdf (A2) |
| 658 | `web/components/project/reconcile-tab/robins-i-reconcile/RobinsIReconciliation.jsx` | Same as above |
| 654 | `web/components/sidebar/Sidebar.jsx` | Extract resize behavior (A7), project tree, and local checklists into sub-components |
| 619 | `web/components/billing/PricingTable.jsx` | Plan card component, feature comparison, billing toggle |
| 584 | `web/components/project/overview-tab/ReviewerAssignment.jsx` | Percentage slider, preset selector, allocation logic as utilities |
| 551 | `web/components/checklist/ChecklistYjsWrapper.jsx` | Extract usePdfLoader (A3), completion logic, annotation handling |
| 938 | `workers/routes/orgs/index.ts` | Split by resource: org CRUD, org settings, org membership |
| 931 | `workers/routes/orgs/invitations.ts` | After extracting shared invitation logic (A6) |
| 808 | `workers/routes/orgs/pdfs.ts` | PDF upload, download, metadata as separate route files |
| 554 | `workers/routes/google-drive.ts` | Extract token management/refresh into a service module |
| 715 | `workers/durable-objects/ProjectDoc.ts` | Extract RPC handlers, member sync logic into separate modules |

---

## Part 4: Type Safety Gaps

### T1. The web package has zero type checking

`packages/web/tsconfig.json` sets `strict: false` and `checkJs: false`. The web package imports from strictly-typed `@corates/shared` but gets no compile-time benefit. Bugs that would be caught in every other package slip through here.

**Impact:** This is the largest package by code volume, and the one most likely to have subtle data-shape bugs.

**Recommendation:** Incrementally enable `checkJs: true` on a per-directory basis, or convert high-value files to TypeScript (stores, primitives, API layer first).

### T2. No shared API contract types

Workers defines routes with Zod schemas, but these types are not exported. The frontend constructs API calls with `apiFetch` and manually shapes data. Any API change requires coordinating across packages by convention, not compilation.

**Recommendation:** Generate TypeScript types from the OpenAPI schema (already generated via `pnpm openapi`) and consume them in the frontend.

### T3. Database schema types locked in workers

Drizzle schema at `workers/db/schema.ts` defines all table shapes, but inferred types are never exported. Frontend code has no typed knowledge of row shapes.

### T4. Subscription tier naming inconsistency

`SUBSCRIPTION_TIERS` in `workers/config/constants.ts` uses `'free' | 'basic' | 'pro' | 'team' | 'enterprise'`. `PlanId` in `@corates/shared/plans` uses `'free' | 'starter_team' | 'team' | 'unlimited_team'`. These should be a single source of truth.

### T5. Duplicated interfaces within workers

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

### Q1. Console.log pollution in production code

`ChecklistYjsWrapper.jsx` has 7 `console.log` statements and `useProject/annotations.js` has 3 more -- clearly debug logging left in.

### Q2. Dead code

- `asyncHandler` in `middleware/errorHandler.ts` is a no-op function that does nothing
- `recents` in `Sidebar.jsx:85` is hardcoded to `() => []` with the real hook commented out
- `routes/members.ts` at the root level appears unused (not imported in `index.ts`)
- `ProjectViewV2.jsx` (2803 lines) is a mock file inflating the codebase

### Q3. Org barrel export leaks project component

`components/org/index.js:7` re-exports `ProjectView` from `@/components/project/ProjectView.jsx`. An org barrel should not export project components.

### Q4. Vitest version mismatch prevents shared test infrastructure

Workers uses `vitest@3.2.0` (pinned for `@cloudflare/vitest-pool-workers` compatibility). Everything else uses `vitest@^4.0.18`. Test utilities cannot be shared across packages.

---

## Recommended Priority Order

**Immediate (security):**
1. S1 -- Fix user deletion to not destroy shared projects
2. S2 -- Add CSRF protection to state-changing endpoints
3. S3 -- Add org-level auth to Google Drive import

**Short-term (stop the bleeding):**
4. A1 -- Extract shared utilities to prevent web/landing divergence from getting worse
5. Q1 -- Remove console.log statements
6. S4 -- Gate error detail leaking

**Medium-term (reduce complexity):**
7. A2 -- Unify ReconciliationWithPdf components
8. A3 -- Extract usePdfLoader primitive
9. A4/A5 -- Extract runMiddleware and error schemas
10. Split the largest files (better-auth-store, sidebar, AMSTAR2Checklist)

**Longer-term (structural improvements):**
11. T1 -- Incrementally enable type checking in web package
12. T2 -- Generate API types from OpenAPI schema
13. B1 -- Cache orgBilling resolution across middleware
14. B4 -- Move rate limiting to Cloudflare's native solution
15. T4 -- Unify subscription tier naming
