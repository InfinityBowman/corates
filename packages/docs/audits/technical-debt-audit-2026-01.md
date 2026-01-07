# CoRATES Technical Debt Audit Report

**Date:** January 6, 2026 (Updated: January 2026)
**Auditor:** Claude Sonnet 4.5
**Codebase Version:** Git commit 99879e30 (branch: 234-payment-edge-cases)
**Last Updated:** Branch 236-fetch-wrapper-abstraction
**Scope:** Maintainability, code quality, technical debt

---

## Executive Summary

This technical debt audit examined 397 source files across the CoRATES codebase, identifying patterns of duplication, deprecated code, magic numbers, organizational issues, and missing abstractions. The codebase shows **good overall structure** with intentional organization, but has accumulated **moderate technical debt** that should be addressed to maintain long-term maintainability.

### Overall Rating: **GOOD** (with areas for improvement)

**Recent Progress:**

- C3 API Client Abstraction - COMPLETED (apiFetch wrapper)
- Pattern 4 Fetch Error Handling - RESOLVED
- User-friendly error messages - IMPLEMENTED

**Codebase Statistics:**

- **Total Source Files:** 397 (JS/JSX/TS/TSX)
- **Test Files:** 72 (18% test coverage by file count)
- **TODO/FIXME Comments:** 3 actionable items
- **Deprecated Functions:** 4 (properly marked)
- **Console Statements:** 20+ files (many intentional logging)

**Key Strengths:**

- ✅ Well-organized monorepo structure
- ✅ Consistent use of barrel exports (`index.js`)
- ✅ Centralized validation with Zod schemas
- ✅ Intentional middleware composition
- ✅ Deprecated code properly marked with alternatives

**Critical Issues:**

- ⚠️ **Magic numbers scattered throughout** - Need constants file
- ✅ **~~Duplicated error handling patterns~~** - Resolved with `apiFetch` wrapper
- ⚠️ **Inconsistent import paths** - Mix of relative (`../../../`) and aliases (`@/`)
- ⚠️ **Deprecated functions not removed** - Dead code kept for "compatibility"
- ⚠️ **Missing utility abstractions** - Repeated patterns for common operations

---

## Table of Contents

1. [TODO/FIXME/HACK Comments](#todofix mehack-comments)
2. [Deprecated Code](#deprecated-code)
3. [Duplicated Patterns](#duplicated-patterns)
4. [Magic Numbers & Hardcoded Values](#magic-numbers--hardcoded-values)
5. [Code Organization Issues](#code-organization-issues)
6. [Missing Abstractions](#missing-abstractions)
7. [Unused Code](#unused-code)
8. [Naming Inconsistencies](#naming-inconsistencies)
9. [Recommendations](#recommendations)

---

## TODO/FIXME/HACK Comments

### Active TODOs Requiring Action

#### T1: Error Monitoring Integration ⚠️

**Location:** [web/src/components/ErrorBoundary.jsx:115](packages/web/src/components/ErrorBoundary.jsx:115)

```javascript
// TODO: Send to error monitoring service (e.g., Sentry, LogRocket)
```

**Issue:** Errors caught by ErrorBoundary are not sent to monitoring service.

**Impact:**

- Production errors invisible to team
- No proactive error detection
- User issues go unreported

**Recommendation:**

```javascript
import * as Sentry from '@sentry/solidjs';

// In ErrorBoundary
resetError={() => {
  Sentry.captureException(error());
  setError(null);
}}
```

**Priority:** High
**Effort:** 2-3 hours (Sentry setup + integration)

---

#### T2: Password Change Not Implemented - COMPLETED

**Location:** [web/src/components/profile/SettingsPage.jsx](packages/web/src/components/profile/SettingsPage.jsx)

**Status:** Implemented in branch 238-ai-agent-readiness

**Solution:**

- Wired up `changePassword()` from Better Auth store
- Added `StrengthIndicator` component for real-time password validation
- Validates password requirements before submission
- Shows user-friendly error messages via `handleError`

**Priority:** ~~High~~ DONE
**Effort:** ~~1-2 hours~~ Completed

---

#### T3: Contact Page FAQ Section ℹ️

**Location:** [landing/src/routes/contact.jsx:111](packages/landing/src/routes/contact.jsx:111)

```jsx
{
  /* TODO FAQ */
}
```

**Issue:** Placeholder for FAQ section on contact page.

**Impact:** Low - Nice-to-have feature

**Priority:** Low
**Effort:** 2-4 hours (content + design)

---

### Non-Actionable TODOs (False Positives)

**"todo" tab/folder references:** 30+ occurrences

- These are legitimate feature names, not TODO comments
- Examples: `TodoTab.jsx`, `todo-tab/`, `getTodoChecklists()`
- ✅ **No action needed**

**Spanish translation "todo":** 2 occurrences in PDF viewer

- `applyAll: 'Aplicar todo'` - Spanish for "Apply all"
- ✅ **No action needed**

---

## Deprecated Code

### D1: Deprecated Billing Checkout Endpoint ⚠️ **REMOVE**

**Location:** [workers/src/routes/billing/index.js:223-225](packages/workers/src/routes/billing/index.js:223)

```javascript
/**
 * POST /api/billing/checkout
 * This endpoint is deprecated - use Better Auth Stripe client plugin directly
 */
billingRoutes.post('/checkout', billingCheckoutRateLimit, requireAuth, async c => {
  // ... 60+ lines of code still here
});
```

**Issue:**

- Endpoint marked deprecated but fully functional
- Increases maintenance burden
- Confuses developers about which API to use

**Usage Check:**

```bash
# Search for calls to /api/billing/checkout
grep -r "'/api/billing/checkout'" packages/web/src
# Result: 0 matches (not used in frontend)
```

**Recommendation:** **DELETE** the entire endpoint

**Priority:** Medium
**Effort:** 30 minutes (delete + verify tests pass)

---

### D2: Deprecated Admin Store Functions ⚠️ **REMOVE**

**Location:** [web/src/stores/adminStore.js:213-232](packages/web/src/stores/adminStore.js:213)

```javascript
/**
 * @deprecated Billing is now org-scoped, not user-scoped.
 */
async function grantAccess(_userId, _options = {}) {
  throw new Error(
    'User-level subscription management is deprecated. ' +
      'Billing is now org-scoped. Use /admin/orgs/:orgId to manage subscriptions.',
  );
}

/**
 * @deprecated Billing is now org-scoped, not user-scoped.
 */
async function revokeAccess(_userId) {
  throw new Error(/* same message */);
}
```

**Issue:**

- Functions throw errors immediately (completely non-functional)
- Not exported from module
- Never called (would crash if called)

**Recommendation:** **DELETE** both functions

**Priority:** Low (not exported, no risk)
**Effort:** 5 minutes

---

## Duplicated Patterns

### Pattern 1: Database Connection Boilerplate 🔴 **HIGH DUPLICATION**

**Occurrences:** 50+ files

**Pattern:**

```javascript
// Repeated in every route file
const db = createDb(c.env.DB);
```

**Examples:**

- [workers/src/routes/projects.js](packages/workers/src/routes/projects.js)
- [workers/src/routes/members.js](packages/workers/src/routes/members.js)
- [workers/src/routes/orgs/projects.js](packages/workers/src/routes/orgs/projects.js)
- ... 47+ more

**Issue:**

- Same boilerplate in every route handler
- If `createDb` signature changes, must update everywhere

**Recommendation:** Create middleware or context helper

```javascript
// New middleware: packages/workers/src/middleware/db.js
export function withDb(c, next) {
  c.db = createDb(c.env.DB);
  return next();
}

// Apply globally in index.js
app.use('*', withDb);

// In route handlers
async c => {
  const db = c.db; // ✅ No boilerplate
};
```

**Priority:** Medium
**Effort:** 2-3 hours (create middleware + refactor)
**Impact:** Cleaner code, easier to modify DB logic

---

### Pattern 2: Durable Object Sync Calls 🔴 **HIGH DUPLICATION**

**Occurrences:** 10+ files

**Pattern:**

```javascript
await syncMemberToDO(c.env, projectId, 'add', {
  userId: member.userId,
  role: member.role,
  name: member.name,
  // ... same structure everywhere
});
```

**Examples:**

- [workers/src/routes/invitations.js:244](packages/workers/src/routes/invitations.js:244)
- [workers/src/routes/members.js:416](packages/workers/src/routes/members.js:416)
- [workers/src/routes/orgs/members.js:204](packages/workers/src/routes/orgs/members.js:204)
- [workers/src/routes/admin/users.js:510](packages/workers/src/routes/admin/users.js:510)
- ... 6+ more

**Issue:**

- Same function called with same data structure in many places
- Action strings (`'add'`, `'remove'`, `'update'`) are magic strings

**Recommendation:**

```javascript
// Create enum for actions
export const SyncAction = {
  ADD: 'add',
  REMOVE: 'remove',
  UPDATE: 'update',
};

// Create typed helper
export async function syncProjectMember(env, projectId, action, memberData) {
  if (!Object.values(SyncAction).includes(action)) {
    throw new Error(`Invalid sync action: ${action}`);
  }
  return syncMemberToDO(env, projectId, action, memberData);
}
```

**Priority:** Low
**Effort:** 1-2 hours
**Impact:** Type safety, prevents typos

---

### Pattern 3: Error Response Creation 🟡 **MEDIUM DUPLICATION**

**Occurrences:** 30+ files

**Pattern:**

```javascript
try {
  // ... operation
} catch (err) {
  console.error('Error creating project:', err);
  return c.json({ error: 'Failed to create project' }, 500);
}
```

**Examples:**

- [workers/src/routes/projects.js](packages/workers/src/routes/projects.js)
- [workers/src/routes/members.js](packages/workers/src/routes/members.js)
- [workers/src/routes/billing/index.js](packages/workers/src/routes/billing/index.js)
- ... 27+ more

**Issue:**

- Mix of `console.error` and structured logging
- Inconsistent error messages (some generic, some detailed)
- No correlation IDs

**Recommendation:** Use domain error abstraction (already exists!)

```javascript
// Already have createDomainError in errors module
import { createDomainError } from '@corates/shared/errors';

// Standardize usage
try {
  // ... operation
} catch (err) {
  const error = createDomainError('PROJECT_CREATION_FAILED', {
    cause: err,
    context: { orgId, userId },
  });
  logger.error(error);
  return c.json({ error: error.message }, error.statusCode);
}
```

**Priority:** Medium
**Effort:** 4-6 hours (refactor across files)
**Impact:** Consistent error handling, better debugging

---

### Pattern 4: Fetch Error Handling in Frontend ✅ **COMPLETED**

**Status:** Resolved with `apiFetch` wrapper in `packages/web/src/lib/apiFetch.js`

**Solution Implemented:**

- Created centralized `apiFetch` wrapper with standardized error handling
- All API files now use `apiFetch.get()`, `apiFetch.post()`, etc.
- User-friendly error messages via `error-utils.js` with `USER_FRIENDLY_MESSAGES` mapping
- Automatic retry with exponential backoff (opt-in)
- Consistent toast notifications and error state management

**Files Updated:**

- `packages/web/src/lib/apiFetch.js` - Main wrapper
- `packages/web/src/lib/error-utils.js` - User-friendly error messages
- `packages/web/src/api/billing.js` - Migrated to apiFetch
- `packages/web/src/api/pdf-api.js` - Migrated to apiFetch
- `packages/web/src/api/account-merge.js` - Migrated to apiFetch
- ... all API files migrated

**Previous Recommendation:** ~~Create API client wrapper~~

```javascript
// packages/web/src/lib/apiClient.js
export async function apiCall(endpoint, options = {}) {
  const { method = 'GET', body, ...rest } = options;

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...(body && { body: JSON.stringify(body) }),
    ...rest,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Usage
import { apiCall } from '@lib/apiClient';

export async function uploadPdf(orgId, projectId, studyId, file) {
  return apiCall(`/api/orgs/${orgId}/projects/${projectId}/studies/${studyId}/pdfs`, {
    method: 'POST',
    body: formData, // Handle FormData vs JSON
  });
}
```

**Priority:** High
**Effort:** 3-4 hours
**Impact:** Reduces duplication, easier to add retry logic, auth refresh, etc.

---

### Pattern 5: Query Parameter Building 🟡 **MEDIUM DUPLICATION**

**Occurrences:** 8+ files

**Pattern:**

```javascript
const params = new URLSearchParams();
if (search) params.set('search', search);
if (cursor) params.set('cursor', cursor);
if (limit) params.set('limit', limit.toString());
const queryString = params.toString() ? `?${params.toString()}` : '';
```

**Recommendation:** Create utility

```javascript
// packages/web/src/lib/urlUtils.js
export function buildQueryString(params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  return queryString ? `?${queryString}` : '';
}

// Usage
const url = `/api/storage${buildQueryString({ search, cursor, limit })}`;
```

**Priority:** Low
**Effort:** 1 hour
**Impact:** Cleaner, more maintainable

---

## Magic Numbers & Hardcoded Values

### Category 1: Time Durations ⚠️ **NEEDS CONSTANTS**

**Pattern:** Time values scattered across files without constants

| Value            | Location                                                                      | Purpose                  | Should Be Constant          |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------ | --------------------------- |
| `60000`          | [middleware/rateLimit.js:13](packages/workers/src/middleware/rateLimit.js:13) | Cleanup interval (1 min) | ✅ `CLEANUP_INTERVAL_MS`    |
| `5000`           | [docs.js:104](packages/workers/src/docs.js:104)                               | Auth check interval      | ✅ `AUTH_CHECK_INTERVAL_MS` |
| `60 * 1000`      | [routes/google-drive.js:85](packages/workers/src/routes/google-drive.js:85)   | Buffer time              | ✅ `TOKEN_BUFFER_MS`        |
| `10 * 60 * 1000` | [auth/emailTemplates.js:100](packages/workers/src/auth/emailTemplates.js:100) | Magic link expiry        | ✅ Already constant!        |
| `30000`          | [useOnlineStatus.js:5](packages/web/src/primitives/useOnlineStatus.js)        | Ping interval            | ✅ `KEEPALIVE_INTERVAL_MS`  |

**Recommendation:** Create constants file

```javascript
// packages/workers/src/config/constants.js
export const TIME_CONSTANTS = {
  ONE_MINUTE_MS: 60 * 1000,
  FIVE_SECONDS_MS: 5 * 1000,
  ONE_HOUR_MS: 60 * 60 * 1000,
  ONE_DAY_MS: 24 * 60 * 60 * 1000,
};

export const RATE_LIMIT = {
  CLEANUP_INTERVAL_MS: TIME_CONSTANTS.ONE_MINUTE_MS,
  AUTH_WINDOW_MS: 15 * TIME_CONSTANTS.ONE_MINUTE_MS,
  EMAIL_WINDOW_MS: TIME_CONSTANTS.ONE_HOUR_MS,
};
```

**Priority:** Medium
**Effort:** 2-3 hours (create constants + refactor)

---

### Category 2: Size Limits ⚠️ **INCONSISTENT**

| Value              | Location                                                               | Purpose            | Issue           |
| ------------------ | ---------------------------------------------------------------------- | ------------------ | --------------- |
| `50 * 1024 * 1024` | [google-drive.js:310](packages/workers/src/routes/google-drive.js:310) | 50MB max file size | ✅ Has comment  |
| `10000`            | [admin/storage.js:69](packages/workers/src/routes/admin/storage.js:69) | Processing cap     | ⚠️ No comment   |
| `50`               | [adminStore.js:237](packages/web/src/stores/adminStore.js:237)         | Pagination limit   | ⚠️ Magic number |

**Recommendation:**

```javascript
// packages/shared/src/limits.js
export const FILE_LIMITS = {
  MAX_PDF_SIZE_BYTES: 50 * 1024 * 1024, // 50MB
  MAX_UPLOAD_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
};

export const PAGINATION = {
  DEFAULT_LIMIT: 50,
  MAX_LIMIT: 100,
};

export const PROCESSING = {
  MAX_BATCH_SIZE: 10000,
  CONCURRENT_UPLOADS: 5,
};
```

**Priority:** Medium
**Effort:** 2 hours

---

### Category 3: WebSocket Close Codes ✅ **GOOD**

**Location:** [durable-objects/ProjectDoc.js:591, 621](packages/workers/src/durable-objects/ProjectDoc.js)

```javascript
const closeCode = 1008; // Policy Violation
const closeCode = 1000; // Normal closure
```

**Status:** ✅ **Acceptable**

- WebSocket close codes are standard
- Comments explain meaning
- Could be extracted to enum but low priority

---

### Category 4: String Patterns (Format Codes) ℹ️ **INFORMATIONAL**

**Pattern:** `XXXX-XXXX-XXXX` placeholders for codes

**Occurrences:**

- [account-merge.js:83](packages/workers/src/routes/account-merge.js:83) - Account merge code format
- [TwoFactorVerify.jsx:91](packages/web/src/components/auth/TwoFactorVerify.jsx:91) - Backup code placeholder
- [AccountProviderCard.jsx:21](packages/web/src/components/profile/AccountProviderCard.jsx:21) - Account ID masking

**Status:** ✅ **Acceptable**

- These are display formats, not business logic
- Consistent pattern across codebase

---

## Code Organization Issues

### Issue 1: Inconsistent Import Paths 🔴 **HIGH SEVERITY**

**Problem:** Mix of relative paths and aliases throughout codebase

**Examples:**

**Workers (Relative Paths):**

```javascript
import { syncMemberToDO } from '../lib/project-sync.js';
import { syncMemberToDO } from '../../lib/project-sync.js';
import { syncMemberToDO } from '../../../lib/project-sync.js'; // ⚠️ Deep nesting
```

**Web (Mixed):**

```javascript
import useProject from '@/primitives/useProject/index.js'; // ✅ Alias
import { useBetterAuth } from '@api/better-auth-store.js'; // ✅ Alias
import '../../../styles/something.css'; // ⚠️ Relative
```

**Issue:**

- Hard to refactor file structure
- Difficult to find import sources
- Inconsistent team conventions

**Recommendation:** Standardize on aliases

```javascript
// tsconfig.json / jsconfig.json (already configured for web)
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@lib/*": ["./src/lib/*"],
      "@api/*": ["./src/api/*"],
      "@components/*": ["./src/components/*"]
    }
  }
}

// Workers should add similar aliases
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@routes/*": ["./src/routes/*"],
      "@middleware/*": ["./src/middleware/*"],
      "@lib/*": ["./src/lib/*"]
    }
  }
}
```

**Priority:** High
**Effort:** 4-6 hours (configure + refactor imports)
**Impact:** Much easier refactoring, clearer imports

---

### Issue 2: Barrel Export Overuse 🟡 **MINOR ISSUE**

**Pattern:** Many `index.js` files that only re-export

**Examples:**

```javascript
// packages/web/src/components/project/todo-tab/index.js
export { default as TodoStudyRow } from './TodoStudyRow.jsx';
export { default as ToDoTab } from './ToDoTab.jsx';

// packages/web/src/components/billing/index.js
export { BillingPage } from './BillingPage.jsx';
export { InvoicesList } from './InvoicesList.jsx';
// ... 5 more exports
```

**Issue:**

- Adds indirection without clear benefit
- Most files only have 1-2 exports
- Increases bundle size slightly (re-exports entire modules)

**When Barrels Are Good:**

- Public API of a package (library exports)
- Many small utilities in one folder
- Intentional abstraction boundary

**When to Avoid:**

- Single component folders
- Components only used internally

**Recommendation:**

- Keep barrel exports for major boundaries (e.g., `components/billing/index.js`)
- Remove for single-component folders (e.g., `todo-tab/index.js`)
- Direct imports are clearer:

  ```javascript
  // Instead of
  import { ToDoTab } from './todo-tab';

  // Use
  import ToDoTab from './todo-tab/ToDoTab.jsx';
  ```

**Priority:** Low
**Effort:** 1-2 hours
**Impact:** Slightly clearer imports, minimal bundle size improvement

---

### Issue 3: Test File Placement Inconsistency 🟡 **MINOR ISSUE**

**Current Structure:**

```
packages/workers/src/
  routes/
    __tests__/
      members.test.js      ✅ Colocated with route folder
      users.test.js
    billing/
      __tests__/
        index.test.js      ✅ Nested with feature
        purchase-webhook.test.js
  middleware/
    __tests__/
      requireOrg.test.js   ✅ Colocated
```

**Status:** ✅ **Actually Good**

- Tests colocated with source
- Easy to find tests for a file
- Follows modern best practices

**Observation:** This is not an issue - well-organized!

---

## Missing Abstractions

### Abstraction 1: API Error Handler Middleware 🔴 **MISSING**

**Current State:** Every route has custom error handling

**Pattern Repeated 50+ Times:**

```javascript
try {
  // ... operation
} catch (err) {
  console.error('Error:', err);
  return c.json({ error: 'Something failed' }, 500);
}
```

**Recommendation:** Centralized error handling middleware

```javascript
// packages/workers/src/middleware/errorHandler.js
export async function errorHandler(c, next) {
  try {
    await next();
  } catch (err) {
    // Log error with context
    logger.error('Request failed', {
      path: c.req.path,
      method: c.req.method,
      userId: c.get('user')?.id,
      error: err.message,
      stack: err.stack,
    });

    // Handle domain errors
    if (err.code && err.statusCode) {
      return c.json({ error: err.message, code: err.code }, err.statusCode);
    }

    // Generic 500 for unknown errors
    return c.json({ error: 'Internal server error' }, 500);
  }
}

// Apply globally
app.use('*', errorHandler);
app.use('*', withDb); // DB middleware can now throw, will be caught
```

**Priority:** High
**Effort:** 3-4 hours (create middleware + remove try-catch from routes)
**Impact:** Much cleaner route handlers, consistent error handling

---

### Abstraction 2: Permission Checker Utility 🟡 **MISSING**

**Current State:** Permission checks scattered in middleware and routes

**Pattern:**

```javascript
// In various files
if (membership.role !== 'owner') {
  return c.json({ error: 'Only owners can...' }, 403);
}

if (!['owner', 'admin'].includes(membership.role)) {
  return c.json({ error: 'Insufficient permissions' }, 403);
}
```

**Recommendation:** Permission utility

```javascript
// packages/workers/src/lib/permissions.js
export const OrgRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
};

export const ProjectRole = {
  OWNER: 'owner',
  MEMBER: 'member',
};

export function hasOrgPermission(userRole, requiredRole) {
  const hierarchy = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MEMBER];
  const userLevel = hierarchy.indexOf(userRole);
  const requiredLevel = hierarchy.indexOf(requiredRole);
  return userLevel !== -1 && userLevel <= requiredLevel;
}

// Usage
if (!hasOrgPermission(membership.role, OrgRole.ADMIN)) {
  return c.json({ error: 'Admin access required' }, 403);
}
```

**Priority:** Medium
**Effort:** 2-3 hours
**Impact:** Clearer permission logic, easier to modify hierarchy

---

### Abstraction 3: Query Builder Helpers 🟡 **MISSING**

**Current State:** Common query patterns repeated

**Pattern:**

```javascript
// Repeated pattern: "get first row or return error"
const [project] = await db.select().from(projects).where(eq(projects.id, projectId)).limit(1);

if (!project) {
  const error = createDomainError('PROJECT_NOT_FOUND', { projectId });
  return c.json({ error: error.message }, error.statusCode);
}
```

**Recommendation:** Query helpers

```javascript
// packages/workers/src/lib/queryHelpers.js
export async function findOneOrThrow(query, errorCode, context) {
  const [result] = await query.limit(1);
  if (!result) {
    throw createDomainError(errorCode, context);
  }
  return result;
}

export async function findMany(query, { offset = 0, limit = 50 } = {}) {
  return query.offset(offset).limit(limit);
}

// Usage
const project = await findOneOrThrow(
  db.select().from(projects).where(eq(projects.id, projectId)),
  'PROJECT_NOT_FOUND',
  { projectId },
);
```

**Priority:** Low
**Effort:** 2-3 hours
**Impact:** Slightly cleaner queries, consistent error handling

---

### Abstraction 4: Form Validation Hook 🟡 **MISSING**

**Current State:** Form validation logic duplicated across components

**Pattern:**

```javascript
// In CreateProjectForm.jsx, CreateOrgPage.jsx, etc.
const [errors, setErrors] = createSignal({});
const [isSubmitting, setIsSubmitting] = createSignal(false);

const handleSubmit = async e => {
  e.preventDefault();
  setIsSubmitting(true);

  // Validation
  const newErrors = {};
  if (!form.name) newErrors.name = 'Name is required';
  if (form.name.length > 255) newErrors.name = 'Name too long';

  if (Object.keys(newErrors).length > 0) {
    setErrors(newErrors);
    setIsSubmitting(false);
    return;
  }

  try {
    await submitForm();
  } catch (err) {
    setErrors({ submit: err.message });
  } finally {
    setIsSubmitting(false);
  }
};
```

**Recommendation:** Create form hook

```javascript
// packages/web/src/primitives/useForm.js
export function useForm(schema, onSubmit) {
  const [values, setValues] = createSignal({});
  const [errors, setErrors] = createSignal({});
  const [isSubmitting, setIsSubmitting] = createSignal(false);

  const handleSubmit = async e => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors({});

    // Zod validation
    const result = schema.safeParse(values());
    if (!result.success) {
      const fieldErrors = {};
      result.error.issues.forEach(issue => {
        fieldErrors[issue.path[0]] = issue.message;
      });
      setErrors(fieldErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      await onSubmit(result.data);
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return { values, setValues, errors, isSubmitting, handleSubmit };
}

// Usage
const form = useForm(createOrgSchema, async data => {
  await createOrg(data);
  navigate('/orgs');
});
```

**Priority:** Medium
**Effort:** 3-4 hours (create hook + refactor forms)
**Impact:** Consistent validation, less boilerplate

---

## Unused Code

### Unused Exports Analysis

**Methodology:**

1. Search for all `export` statements
2. Grep for imports of each export
3. Identify exports with 0 imports

**Note:** Background agent task still running, preliminary findings:

#### Potentially Unused 1: `grantAccess` / `revokeAccess` in adminStore ✅

**Location:** [web/src/stores/adminStore.js:217-232](packages/web/src/stores/adminStore.js:217)

**Status:**

- Not exported from module
- Functions throw errors
- **Confirmed safe to delete**

**Priority:** Low
**Effort:** 5 minutes

---

#### Potentially Unused 2: Legacy route handlers

**Pattern:** Some route files have both old and new endpoints

**Example:**

```javascript
// Old endpoint (may be unused)
app.get('/api/projects', ...)

// New org-scoped endpoint
app.get('/api/orgs/:orgId/projects', ...)
```

**Recommendation:** Audit API usage

1. Check frontend for old endpoint calls
2. Check documentation for deprecated routes
3. Add deprecation headers to old routes
4. Schedule removal in next major version

**Priority:** Medium
**Effort:** 2-3 hours (audit + plan deprecation)

---

## Naming Inconsistencies

### Issue 1: Mixed Casing for Files 🟡 **MINOR**

**Pattern:** Inconsistent file naming conventions

**Component Files:**

```
✅ PascalCase: ProjectView.jsx, OverviewTab.jsx (React/Solid convention)
✅ PascalCase: CreateOrgPage.jsx, BillingPage.jsx
⚠️ camelCase: useProject/index.js, useOnlineStatus.js (hook convention)
```

**Utility Files:**

```
✅ camelCase: formStatePersistence.js, queryClient.js
✅ kebab-case: better-auth-store.js, checklist-domain.js
⚠️ Mixed: pdfUtils.js vs pdf-api.js
```

**Status:** ✅ **Mostly Consistent**

- Components: PascalCase ✅
- Hooks: camelCase starting with `use` ✅
- Utilities: Mostly camelCase, some kebab-case

**Recommendation:** Document conventions in `CONTRIBUTING.md`

```markdown
## File Naming Conventions

- **Components**: PascalCase (`ProjectView.jsx`)
- **Hooks**: camelCase with `use` prefix (`useProject.js`)
- **Utilities**: camelCase (`formUtils.js`)
- **Config**: kebab-case (`better-auth-store.js`)
- **Tests**: Match source file with `.test.js` suffix
```

**Priority:** Low
**Effort:** 30 minutes (documentation)

---

### Issue 2: Inconsistent Function Naming 🟡 **MINOR**

**Pattern:** Mix of verb styles

**Examples:**

```javascript
// Verb-first (imperative)
createProject();
deleteStudy();
updateMember();

// Noun-first
projectCreate(); // ⚠️ Rare, but exists in some files

// Getter-style
getProjects();
getTodoChecklists();

// Boolean queries
hasPermission();
isOwner();
```

**Status:** ✅ **Mostly Consistent**

- Verb-first dominates (good!)
- Boolean functions use `is`/`has` prefix
- Getters use `get` prefix

**Minor Issues:**

- A few `fetch*` vs `get*` inconsistencies
- Some `handle*` vs `on*` for event handlers

**Recommendation:** Codify in style guide

```markdown
## Function Naming

- **Actions**: Verb-first (`createProject`, `deleteUser`)
- **Queries**: `get` prefix (`getProjects`, `getUserById`)
- **Booleans**: `is`/`has` prefix (`isOwner`, `hasPermission`)
- **Event handlers**: `handle` prefix (`handleSubmit`, `handleClick`)
- **Async**: No special prefix (use `async` keyword)
```

**Priority:** Low
**Effort:** 1 hour (documentation + light refactoring)

---

## Recommendations

### Critical Priority (This Sprint)

#### C1: Implement Error Monitoring ⚠️

**Current:** Errors go to console only
**Action:** Integrate Sentry or LogRocket
**Files:** `ErrorBoundary.jsx`, `apiClient.js` (if created)
**Effort:** 3-4 hours
**Impact:** Visibility into production issues

---

#### C2: Implement Password Change - COMPLETED

**Completed:** January 2026
**Solution:** Wired up Better Auth `changePassword` API in SettingsPage.jsx
**Features:** Added StrengthIndicator for real-time validation, user-friendly error handling
**Files:** `SettingsPage.jsx`
**Impact:** Users can now change passwords with proper validation

---

#### C3: Create API Client Abstraction - COMPLETED

**Completed:** January 2026
**Solution:** Created `apiFetch` wrapper in `packages/web/src/lib/apiFetch.js`
**Files Updated:** All files in `packages/web/src/api/` now use `apiFetch`
**Impact:** Reduced duplication, consistent error handling, user-friendly error messages, retry support

---

### High Priority (Next Sprint)

#### H1: Standardize Import Paths - INFRASTRUCTURE COMPLETE

**Completed:** January 2026
**Solution:** Configured `@` alias in workers package pointing to `src/`
**Configuration Files:**

- `packages/workers/jsconfig.json` - IDE support
- `packages/workers/vitest.config.js` - Test resolution

**Usage:** `import { createDb } from '@/db/client.js'` instead of `../../db/client.js`

**Migration Status:** Infrastructure in place, files can be gradually migrated as they're touched.
One file (`orgs/invitations.js`) converted as example.

**Impact:** Cleaner imports, easier refactoring, consistent with web package patterns

---

#### H2: Create Error Handler Middleware - COMPLETED

**Completed:** January 2026
**Solution:** Created `middleware/errorHandler.js` with centralized error handling
**Features:**

- Global error handler via `app.onError(errorHandler)`
- Handles domain errors, Zod validation errors, DB errors automatically
- Consistent JSON error response format
- Routes can now throw errors instead of try-catch boilerplate

**Files:** `packages/workers/src/middleware/errorHandler.js`, `packages/workers/src/index.js`
**Impact:** Cleaner route code, consistent error responses

---

#### H3: Extract Constants File - COMPLETED

**Completed:** January 2026
**Solution:** Extended `config/constants.js` with comprehensive constants
**Constants Added:**

- `TIME_DURATIONS`: INVITATION_EXPIRY_MS, MERGE_VERIFICATION_EXPIRY_MS, STATS_RECENT_DAYS
- `GRANT_CONFIG`: DURATION_MONTHS
- `CACHE_DURATIONS`: CORS_PREFLIGHT_SEC, AVATAR_SEC, PDF_SEC
- `QUERY_LIMITS`: R2_LIST_BATCH_SIZE, LEDGER_QUERY_LIMIT
- `ORG_LIMITS`: MEMBERSHIP_LIMIT
- `FILE_SIZE_LIMITS.AVATAR`: Added to existing limits

**Files Updated:** orgs/invitations.js, orgs/members.js, members.js, avatars.js, admin/users.js
**Impact:** Centralized configuration, no more magic numbers for durations

---

### Medium Priority (Next Month)

#### M1: Remove Deprecated Code

**Current:** 4 deprecated functions/endpoints still in code
**Action:** Delete unused code
**Files:** `billing/index.js`, `adminStore.js`, `google-drive.js`
**Effort:** 1-2 hours
**Impact:** Reduces maintenance burden

---

#### M2: Create Database Middleware

**Current:** `const db = createDb(c.env.DB)` in every route
**Action:** Middleware to attach `db` to context
**Files:** All route files
**Effort:** 2-3 hours
**Impact:** Less boilerplate

---

#### M3: Standardize Error Handling Patterns 🟡

**Current:** Mix of `console.error` and structured logging
**Action:** Use `createDomainError` consistently
**Files:** 30+ route files
**Effort:** 4-6 hours
**Impact:** Better error tracking

---

#### M4: Create Permission Utility 🟡

**Current:** Role checks duplicated
**Action:** Create `lib/permissions.js` with helpers
**Files:** Middleware and route files
**Effort:** 2-3 hours
**Impact:** Clearer permission logic

---

### Low Priority (Backlog)

#### L1: Remove Unused Barrel Exports 🟡

**Current:** Many single-component folders with `index.js`
**Action:** Remove unnecessary barrel exports
**Files:** Component folders
**Effort:** 1-2 hours
**Impact:** Slightly clearer imports

---

#### L2: Document Naming Conventions 🟡

**Current:** Conventions exist but not documented
**Action:** Add to `CONTRIBUTING.md`
**Effort:** 30 minutes
**Impact:** Onboarding, consistency

---

#### L3: Create Form Validation Hook 🟡

**Current:** Form logic duplicated
**Action:** Create `useForm` hook
**Files:** Form components
**Effort:** 3-4 hours
**Impact:** Less boilerplate in forms

---

## Summary Metrics

### Technical Debt Score: **5.5/10** (Lower is better)

**Calculation:**

- **Code Duplication:** 2/4 (~~High duplication in API calls, error handling~~ - Resolved with apiFetch)
- **Dead Code:** 2/4 (Some deprecated functions, mostly cleaned up)
- **Magic Numbers:** 2/4 (~~Many scattered constants~~ - Centralized in constants.js)
- **Missing Abstractions:** 1/4 (~~Some patterns could be abstracted~~ - apiFetch, error-utils, errorHandler added)
- **Organization:** 1/4 (Well-organized, minor import path issues)
- **Test Coverage:** 2/4 (18% by file count, likely higher by LOC)

**Average:** (2+2+2+1+1+2) / 6 = **1.67 / 4** - **5.0 / 10**

### Prioritized Action Plan

**COMPLETED:**

- ~~Create API client abstraction~~ - apiFetch wrapper implemented
- ~~Standardize error handling~~ - USER_FRIENDLY_MESSAGES in error-utils.js
- ~~Pattern 4 fetch duplication~~ - All API files migrated to apiFetch
- ~~Implement password change~~ - Wired up Better Auth changePassword API
- ~~Create error handler middleware~~ - Global errorHandler in workers
- ~~Extract constants file~~ - TIME_DURATIONS, CACHE_DURATIONS, etc.

**Week 1 (Critical):**

1. Implement error monitoring (Sentry)

**Week 2-3 (High):** 2. Standardize import paths

**Month 2 (Medium):** 3. Remove deprecated code 4. Create database middleware 5. Standardize error patterns 6. Create permission utility

**Backlog (Low):** 7. Remove unnecessary barrel exports 8. Document naming conventions 9. Create form validation hook

---

## Conclusion

The CoRATES codebase demonstrates **good engineering practices** with intentional structure and organization. The identified technical debt is **moderate and manageable**, primarily consisting of:

1. ~~**Duplicated patterns** that can be abstracted (API calls, error handling)~~ - RESOLVED
2. ~~**Magic numbers** that should be extracted to constants~~ - RESOLVED
3. **Minor inconsistencies** in import paths and naming

**Key Strengths to Maintain:**

- Well-organized monorepo structure
- Colocated tests
- Consistent use of Zod for validation
- Intentional middleware composition
- Deprecated code properly marked
- **NEW:** Centralized API client (`apiFetch`) with consistent error handling

**Most Impactful Improvements (Remaining):**

1. ~~API client abstraction (reduces 15+ files of duplication)~~ - DONE
2. Error handler middleware (cleans up 50+ route files)
3. Constants file (makes limits configurable)
4. Error monitoring (Sentry integration)

The technical debt is **not blocking progress** and has been **actively reduced**. The `apiFetch` wrapper now provides consistent error handling across all API calls, improving both developer experience and user-facing error messages.

---

**End of Report**

For questions or implementation assistance, consult the development team.
