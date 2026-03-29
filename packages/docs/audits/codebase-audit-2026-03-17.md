# Codebase Audit - 2026-03-17

Comprehensive audit of the CoRATES monorepo covering the React frontend (`packages/landing`), Hono backend (`packages/workers`), and cross-cutting concerns (shared code, configuration, dependencies, documentation).

---

## Table of Contents

- [Critical Issues](#critical-issues)
- [Important Issues](#important-issues)
- [Documentation Discrepancies](#documentation-discrepancies)
- [Summary](#summary)

---

## Critical Issues

### C1. Rate limiter is ineffective in production (per-isolate memory)

**File:** `packages/workers/src/middleware/rateLimit.ts:8-12, 52-55`

The rate limiter uses a module-level `Map` for state and is only active in production (non-production requests bypass it entirely). However, Cloudflare Workers run in short-lived isolates that do not share memory. Each incoming request may hit a different isolate with its own empty `Map`, meaning rate limit counters are fragmented and easily circumvented. The condition:

```ts
return async (c, next) => {
  if (c.env?.ENVIRONMENT !== 'production') {
    await next();
    return;
  }
```

...skips rate limiting in development/test. In production, the limiter runs but provides near-zero protection because the state is not shared across isolates. All exported rate limiters (`authRateLimit`, `contactRateLimit`, `emailRateLimit`, `billingCheckoutRateLimit`, `billingPortalRateLimit`) are effectively useless under real traffic. Sensitive endpoints like `POST /api/contact`, billing checkout, and email flows have no meaningful rate limiting.

**Fix:** Use Cloudflare KV, Durable Objects, or Cloudflare Rate Limiting API for distributed state.

---

### C2. Raw D1 SQL bypasses Drizzle (project rule violation)

**File:** `packages/workers/src/routes/database.ts:155-158`

```ts
const tableCheck = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").first();
```

The project guidelines explicitly state "Never bypass Drizzle for database access."

**Fix:** Replace with a Drizzle query or remove if the check is unnecessary.

---

### C3. `/api/database/users` exposes user records to any authenticated user

**File:** `packages/workers/src/routes/database.ts:24, 76-102`

The route applies only `requireAuth` (any authenticated user), not an admin check. It returns user IDs, emails, usernames, given names, and email verification status for the 20 most recent users (capped by `.limit(20)` at line 91). While not the full user table, any authenticated user can enumerate PII.

```ts
dbRoutes.use('/users', requireAuth); // No admin check
```

The `/api/migrate` POST endpoint (line 154) has no authentication at all.

**Fix:** Add `requireAdmin` middleware, or restrict this endpoint to admin-only routes.

---

### C4. Google Drive `fileId` interpolated into URL without sanitization

**File:** `packages/workers/src/routes/google-drive.ts:383-386, 434-436`

```ts
const metaResponse = await fetch(
  `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size`,
```

The Zod schema only checks `z.string().min(1)` -- no character set restriction. Path traversal via `../` or URL-encoding tricks could alter the constructed URL. The existing `ssrf-protection.ts` module is not applied here.

**Fix:** Validate `fileId` against `/^[a-zA-Z0-9_-]+$/` before URL interpolation.

---

### C5. `window.location.href` navigation bypasses TanStack Router

**File:** `packages/landing/src/components/dashboard/Dashboard.tsx:61, 65, 69`

Three navigation handlers use `window.location.href` assignments, causing full page reloads and losing scroll state, query cache, and React context:

```tsx
function handleStartROBINSI() {
  window.location.href = '/checklist?type=ROBINS_I';
}
```

**Fix:** Replace with `useNavigate()` from TanStack Router.

---

### C6. `pnpm dev:front` script does not exist in root `package.json`

**Files:** `.claude/CLAUDE.md:38`, `.github/copilot-instructions.md:38`, `package.json`

Both documentation files instruct agents to run `pnpm dev:front` to start the frontend. The root `package.json` has no such script. The actual script is `pnpm dev`, which delegates to `pnpm --filter landing dev`.

**Fix:** Either add a `dev:front` script or update documentation.

---

### C7. Sentry DSN hardcoded in committed wrangler config

**File:** `packages/workers/wrangler.jsonc:82`

A full Sentry DSN is committed in the `vars` block. The production comment block correctly notes to use `wrangler secret put`. Any clone of the repo will send dev noise to the real Sentry project.

**Fix:** Move the Sentry DSN to `.dev.vars` (gitignored).

---

### C8. `SubscriptionCard` uses `subscription: any` on exported prop interface

**File:** `packages/landing/src/components/billing/SubscriptionCard.tsx:53`

The component destructures `sub.tierInfo`, `sub.status`, `sub.tier`, `sub.cancelAtPeriodEnd`, `sub.currentPeriodEnd` without any type safety. Shape changes from the subscription API will silently produce `undefined`.

**Fix:** Define a proper interface and share it with the `useSubscription` hook.

---

## Important Issues

### I1. `useOAuthError` suppressed exhaustive-deps hides stale closure

**File:** `packages/landing/src/hooks/useOAuthError.ts:37`

The `useEffect` captures `location.pathname` from TanStack Router's `useLocation()` via closure but uses `[]` deps. The URL cleanup at lines 27 and 35 uses this captured value. While unlikely to manifest in practice (pathname is stable on mount), the suppressed lint rule hides a genuine dependency. Using `window.location.pathname` directly inside `cleanupUrl` would remove the closure dependency entirely.

**Fix:** Use `window.location.pathname` directly inside the effect instead of the router's location object.

---

### I2. Quota enforcement bypassable via standalone invitation endpoint

**Files:** `packages/workers/src/routes/invitations.ts:218-259`, `packages/workers/src/routes/orgs/invitations.ts:754-832`

Two endpoints accept invitation tokens:

- `POST /api/invitations/accept` (no quota check)
- `POST /api/orgs/:orgId/projects/:projectId/invitations/accept` (has quota check)

Accepting via the standalone route bypasses collaborator quota enforcement entirely.

**Fix:** Add `checkCollaboratorQuota` to the standalone invitation accept endpoint.

---

### I3. Response schema mismatch in admin analytics endpoint

**File:** `packages/workers/src/routes/admin/database.ts:115, 851`

The OpenAPI schema declares `userDisplayName`, but the handler returns `userGivenName`. Consumers relying on the contract receive `undefined`.

**Fix:** Align the schema field name with the handler response.

---

### I4. Duplicate invitation creation logic in three files

**Files:**

- `packages/workers/src/routes/members.ts:394-502`
- `packages/workers/src/routes/orgs/members.ts:659-773`
- `packages/workers/src/routes/orgs/invitations.ts:438-558`

The standalone version does not set `grantOrgMembership` or `orgRole`, meaning invitees accepted via that path miss org membership. Maintenance hazard with three copies of subtly different logic.

**Fix:** Extract shared invitation logic into a service function.

---

### I5. `createRouteErrorHandler` leaks error messages in production

**File:** `packages/workers/src/middleware/errorHandler.ts:93-107`

The global `errorHandler` correctly gates `originalError` behind a production check, but `createRouteErrorHandler` always includes `err.message`, potentially exposing table names, column names, etc.

**Fix:** Gate `originalError` behind an environment check.

---

### I6. Localhost CORS pattern active in all environments

**File:** `packages/workers/src/config/origins.ts:8-12`

```ts
/^http:\/\/localhost:\d+$/,  // Any localhost port
```

This pattern is not gated to non-production environments, meaning production accepts CORS requests from any localhost origin.

**Fix:** Restrict localhost patterns to non-production environments.

---

### I7. N+1 query pattern in `generateUniqueFileName`

**File:** `packages/workers/src/routes/orgs/pdfs.ts:376-404`

Each iteration of the dedup loop issues an independent DB query (up to 1,000 serial queries in degenerate cases).

**Fix:** Fetch all matching filenames in a single `like` query and compute the counter in memory.

---

### I8. `CONTACT_EMAIL` env variable accessed via unsafe double cast

**File:** `packages/workers/src/routes/contact.ts:167`

```ts
const contactEmail = (env as unknown as Record<string, string | undefined>).CONTACT_EMAIL ?? 'contact@corates.org';
```

Not declared in the `Env` type. The cast silences TypeScript without fixing the underlying issue.

**Fix:** Add `CONTACT_EMAIL` to the environment type declaration.

---

### I9. Inconsistent icon library -- `react-icons` and `lucide-react` mixed

102+ files use `lucide-react`, 22 files use `react-icons`. Some files import both (e.g., `AppNavbar.tsx` imports `FiMenu` from `react-icons/fi` and `ChevronDownIcon` from `lucide-react`).

**Fix:** Standardize to `lucide-react` across the entire React app.

---

### I10. `CHECKLIST_STATUS` duplicated between shared and landing

**Files:** `packages/landing/src/constants/checklist-status.ts`, `packages/shared/src/checklists/status.ts`

Near-exact copy. 12 files in landing import the local copy. If values diverge, the frontend silently uses stale logic.

**Fix:** Delete the local copy and update 12 import sites to use `@corates/shared`.

---

### I12. Module-level auth cache in `landing/src/lib/auth.ts` never invalidates

**File:** `packages/landing/src/lib/auth.ts`

A module-level `cachedAuth` variable deduplicates session requests but is never cleared. After signout, the marketing Navbar still shows the cached session until full page reload.

**Fix:** Use `useAuthStore` instead of the standalone cache.

---

### I13. `AuthProvider` useEffect captures stale `session.refetch` reference

**File:** `packages/landing/src/components/auth/AuthProvider.tsx:76-84`

Mount-only `useEffect` closes over the initial `session.refetch` reference with exhaustive-deps disabled. If the hook returns a new reference on hydration, the stale one is used.

**Fix:** Use a `useRef` for the refetch callback.

---

### I14. Index-based keys used on dynamic-capable lists

**Files:**

- `packages/landing/src/components/Audience.tsx:44`
- `packages/landing/src/components/settings/PlansSettings.tsx:173`
- `packages/landing/src/components/HowItWorks.tsx:50`
- `packages/landing/src/components/FeatureShowcase.tsx:513, 609`

**Fix:** Use stable identifiers (title, id) as keys.

---

### I15. `PlansSettings` mount effect captures stale `useCallback` closures

**File:** `packages/landing/src/components/settings/PlansSettings.tsx:96-98`

`processPendingPlan` depends on `[navigate, refetch]`, but the calling `useEffect` has `[]` deps with the lint rule suppressed.

**Fix:** Use a `useRef` for the pending plan processor or move logic to a router loader.

---

### I16. Widespread `as any` casts in checklist components

**Files:**

- `packages/landing/src/components/checklist/ROB2Checklist/DomainSection.tsx:32`
- `packages/landing/src/components/checklist/ROBINSIChecklist/DomainSection.tsx:34`
- `packages/landing/src/stores/localChecklistsStore.ts:103, 117`

**Fix:** Add index signatures or union types to checklist registries; type the Dexie database properly.

---

### I17. `renderSidebarContent` is a plain function, not a component

**File:** `packages/landing/src/components/layout/Sidebar.tsx:168`

Defined as a bare function inside the component body, called as `{renderSidebarContent()}`. Adding hooks inside it would cause React to throw. Same pattern in `SettingsSidebar.tsx:97`.

**Fix:** Extract to a proper `SidebarContent` component.

---

### I18. `NotificationsSettings` toggles are non-functional stubs

**File:** `packages/landing/src/components/settings/NotificationsSettings.tsx:11-13`

All toggles reset to `false` on every mount. The `darkMode` switch is disabled. Users who toggle settings see no effect on reload.

**Fix:** Either persist via store/API or remove the page until functional.

---

---

### I20. `vitest` pinned without comment in workers

**File:** `packages/workers/package.json:58`

Workers pins `"vitest": "4.1.0"` (no caret) while all other packages use `^4.x`. No comment explains why.

**Fix:** Add a comment explaining the pin or unpin it.

---

### I21. `getStatusStyle` (Tailwind UI logic) exported from framework-agnostic shared package

**File:** `packages/shared/src/checklists/status.ts:101`

Returns Tailwind class strings from a shared package. The file acknowledges this may not belong here.

**Fix:** Move `getStatusStyle` to a landing-side utility.

---

### I22. `BillingSettings` mount effect with stale `refetch` closure

**File:** `packages/landing/src/components/settings/BillingSettings.tsx:69-85`

The checkout redirect handler at lines 69-85 calls `refetch()` (line 73) and `usageQuery.refetch()` (line 74) inside a `useEffect` with `[]` deps. Both references are captured from closures that may change identity. Same stale-closure pattern as I13 and I15.

**Fix:** Use `useRef` for refetch callbacks or move to a router loader.

---

### I23. `ActivityFeed` uses non-unique composite key

**File:** `packages/landing/src/components/dashboard/ActivityFeed.tsx:72`

```tsx
key={`${activity.title}-${activity.timestamp}`}
```

Projects with the same name and timestamp produce key collisions.

**Fix:** Pass and use `project.id` as the key.

---

## Documentation Discrepancies

### D1. CLAUDE.md injected context still references SolidJS

The on-disk `.claude/CLAUDE.md` has been updated to describe a React/TanStack Start application. However, the version injected into agent sessions still references SolidJS patterns (`createStore`, `createMemo`, `@ark-ui/solid`, `solid-icons`, "never destructure SolidJS props"). Agents receiving the stale context will apply SolidJS patterns to the React codebase.

**Fix:** Ensure caching mechanisms serve the updated CLAUDE.md.

---

### D2. `STATUS.md` lists non-existent `@corates/ui` package

**File:** `packages/docs/STATUS.md:93`

Lists `@corates/ui` as a complete shared package. No such package exists in the workspace. UI components live in `packages/landing/src/components/ui/` as shadcn/ui wrappers.

**Fix:** Remove the `@corates/ui` entry from STATUS.md.

---

### D3. `isEditable` type signature differs between shared and local copy

The shared version accepts `ChecklistStatus | string`; the landing copy accepts only `string`. Migration to the shared import will introduce type errors for callers passing optional status fields.

**Fix:** Reconcile types during the deduplication (I10).

---

## Summary

| Severity      | Count | Key Themes                                                                                                                      |
| ------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------- |
| Critical      | 8     | Ineffective rate limiting, raw SQL, user data exposure, URL injection, missing scripts, untyped API boundary                    |
| Important     | 23    | Stale closures, quota bypass, duplicate logic, error leakage, icon inconsistency, code duplication, `as any` casts, legacy code |
| Documentation | 3     | Stale SolidJS references, phantom package, type mismatches                                                                      |

### Top 10 highest-impact fixes (in priority order)

1. **Rate limiter** (C1) -- production rate limiting is ineffective due to per-isolate memory
2. **User endpoint access control** (C3) -- any authenticated user can enumerate user PII
3. **Invitation quota bypass** (I2) -- collaborator limits can be circumvented
4. **Google Drive fileId sanitization** (C4) -- potential URL manipulation
5. **createRouteErrorHandler leaks** (I5) -- internal details exposed in production
6. **Localhost CORS in production** (I6) -- overly permissive origin matching
7. **`window.location.href` navigation** (C5) -- degrades UX, breaks SPA model
8. **Duplicate invitation logic** (I4) -- behavioral inconsistencies across three files
9. **Icon library standardization** (I9) -- unnecessary bundle weight from two icon libraries
10. **Checklist status deduplication** (I10) -- drift risk between shared and local copies
