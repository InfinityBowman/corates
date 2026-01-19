# Error Handling Analysis - CoRATES

**Date**: 2026-01-19
**Analyst**: Claude
**Scope**: Full-stack error handling patterns (Frontend, Backend, Shared)

## Executive Summary

CoRATES has a **mature, well-architected error handling system** with strong separation of concerns between domain errors (business logic) and transport errors (network issues). The shared error system provides type-safe error codes and consistent error shapes across the entire stack.

**Overall Grade: B+** (Good with notable gaps)

### Strengths

- Centralized, type-safe error system in `@corates/shared`
- Clear domain/transport error separation
- Comprehensive error codes with user-friendly messages
- Strong validation error handling with field-level details
- Error boundaries properly implemented
- Centralized error logger ready for Sentry integration

### Critical Gaps

1. Inconsistent error logging (218 direct console.error calls vs 7 logError calls in frontend)
2. Missing error boundaries in some component trees
3. Silent error suppression patterns (.catch(console.warn))
4. No monitoring/alerting integration (Sentry commented out)
5. Limited error recovery strategies
6. Missing offline error queue for failed mutations

---

## 1. Error Architecture

### 1.1 Shared Error System

**Location**: `/packages/shared/src/errors/`

The shared error system provides excellent separation of concerns:

```typescript
// Domain errors - from API responses
interface DomainError {
  code: DomainErrorCode;
  message: string;
  statusCode: number;
  details?: ErrorDetails;
  timestamp: string;
}

// Transport errors - network/connection issues (frontend only)
interface TransportError {
  code: TransportErrorCode;
  message: string;
  details?: TransportErrorDetails;
  timestamp: string;
  // No statusCode - these occur before/after API calls
}
```

**Strengths**:

- Strong TypeScript typing for error codes
- Discriminated unions for type-safe error handling
- Clear validation error shape with field-level details
- Consistent error creation helpers

**Example Error Codes**:

```typescript
AUTH_ERRORS: {
  REQUIRED: { code: 'AUTH_REQUIRED', statusCode: 401 },
  FORBIDDEN: { code: 'AUTH_FORBIDDEN', statusCode: 403 },
  EXPIRED: { code: 'AUTH_EXPIRED', statusCode: 401 }
}

PROJECT_ERRORS: {
  NOT_FOUND: { code: 'PROJECT_NOT_FOUND', statusCode: 404 },
  ACCESS_DENIED: { code: 'PROJECT_ACCESS_DENIED', statusCode: 403 }
}
```

### 1.2 Error Normalization

**File**: `/packages/shared/src/errors/normalize.ts`

Good patterns:

- `normalizeError()` converts unknown errors to typed errors
- `isDomainError()` and `isTransportError()` type guards
- Strict pattern matching for network errors
- Prevents programmer errors (e.g., passing Response to normalizeError)

**Issue**: The normalize function logs unknown errors to console:

```typescript
// Unknown error - log and return safe error (no guessing)
console.error('Unknown error normalized:', error);
```

This bypasses centralized logging and makes monitoring difficult.

---

## 2. Backend Error Handling

### 2.1 Error Handler Middleware

**File**: `/packages/workers/src/middleware/errorHandler.ts`

**Grade: A-** (Good coverage, some improvements needed)

```typescript
export const errorHandler: ErrorHandler = (err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err);

  if (isDomainError(err)) {
    return c.json(err, err.statusCode);
  }

  if (isZodError(err)) {
    const error = createDomainError(VALIDATION_ERRORS.FAILED, {
      validationErrors: err.errors,
      message: formatZodErrors(err),
    });
    return c.json(error, error.statusCode);
  }

  // Database errors
  if (err?.message?.includes('D1_')) {
    const error = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
      operation: 'database_operation',
      originalError: err.message,
    });
    return c.json(error, error.statusCode);
  }

  // Fallback
  const error = createDomainError(SYSTEM_ERRORS.INTERNAL_ERROR, {
    ...(!isProduction && { originalError: err.message, stack: err.stack }),
  });
  return c.json(error, error.statusCode);
};
```

**Strengths**:

- Handles all major error types (domain, validation, DB, HTTP)
- Strips error details in production
- Returns consistent error shape
- Good Zod validation error formatting

**Issues**:

1. Direct `console.error` instead of structured logging
2. No error classification (recoverable vs fatal)
3. No rate limiting for error responses
4. No correlation IDs for tracing

### 2.2 API Route Error Handling

**Pattern Analysis** (sampled from `/packages/workers/src/routes/orgs/projects.ts`):

```typescript
try {
  const results = await db.select(...).from(projects)...;
  return c.json(results);
} catch (err) {
  const error = err as Error;
  console.error('Error listing org projects:', error);
  const dbError = createDomainError(SYSTEM_ERRORS.DB_ERROR, {
    operation: 'list_org_projects',
    originalError: error.message,
  });
  return c.json(dbError, dbError.statusCode);
}
```

**Consistency**: This pattern is repeated across **54 files** in workers.

**Issues**:

1. Every route uses `console.error` directly (204 occurrences)
2. No centralized error tracking
3. No automatic error aggregation
4. Error context limited to operation name

**Good**:

- Errors are properly typed as DomainError
- Operation context included in details
- Appropriate status codes
- Original error preserved for debugging

### 2.3 Validation Error Handling

**File**: `/packages/workers/src/config/validation.ts`

**Grade: A** (Excellent validation error handling)

```typescript
export function validateBody<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (!result.success) {
    const validationErrors = result.error.issues.map(issue => {
      const field = issue.path.map(String).join('.') || 'root';
      const validationCode = mapZodErrorToValidationCode(issue);
      return {
        field,
        code: validationCode,
        message: issue.message,
        value,
        zodCode,
      };
    });

    // Single field error
    if (validationErrors.length === 1) {
      return {
        success: false,
        error: createValidationError(field, code, value, constraint),
      };
    }

    // Multi-field error
    return {
      success: false,
      error: createMultiFieldValidationError(errors),
    };
  }

  return { success: true, data: result.data };
}
```

**Strengths**:

- Maps Zod errors to domain error codes
- Preserves field paths and values
- Handles single and multi-field errors
- Type-safe error creation

### 2.4 Durable Objects Error Handling

**File**: `/packages/workers/src/durable-objects/ProjectDoc.ts`

**Grade: B** (Good structure, needs recovery patterns)

WebSocket error handling:

```typescript
ws.addEventListener('error', event => {
  console.error('[ProjectDoc] WebSocket error:', event);
  // No cleanup or state tracking
});

ws.addEventListener('close', event => {
  sessions.delete(ws);
  if (awarenessClientId !== null) {
    awarenessProtocol.removeAwarenessStates(awareness, [awarenessClientId], null);
  }
  // No reconnection guidance sent to client
});
```

**Issues**:

1. WebSocket errors logged but not tracked
2. No error state communicated to client
3. No automatic reconnection hints
4. Missing error boundaries for Yjs operations

**Critical**: Only **9 `throw new Error`** statements in entire workers package, suggesting error propagation may be incomplete.

---

## 3. Frontend Error Handling

### 3.1 Error Boundaries

**File**: `/packages/web/src/components/ErrorBoundary.jsx`

**Grade: A-** (Well implemented, underused)

```typescript
export default function AppErrorBoundary(props) {
  const handleError = (error, reset) => {
    const normalizedError = normalizeError(error);

    logError(normalizedError, {
      component: props.name || 'AppErrorBoundary',
      action: 'render',
    });

    if (props.onError) {
      props.onError(normalizedError, reset);
    }

    if (props.fallback) {
      return props.fallback(normalizedError, reset);
    }

    return <ErrorDisplay error={normalizedError} reset={reset} />;
  };

  return <SolidErrorBoundary fallback={handleError}>{props.children}</SolidErrorBoundary>;
}
```

**Strengths**:

- Normalizes errors before handling
- Logs errors through centralized logger
- Provides user-friendly error display
- Supports custom fallbacks
- Includes reset functionality

**SectionErrorBoundary** for component-level isolation:

```typescript
export function SectionErrorBoundary(props) {
  // Provides inline error recovery for sections
  // Allows rest of UI to continue functioning
}
```

**Usage Analysis**:

- Used in: `main.jsx` (root), `Dashboard`, `ProjectView`, `SettingsLayout`, `AdminLayout`
- **22 total uses** across **5 files**

**Gap**: Many complex components lack error boundaries:

- Individual form components
- Chart/visualization components
- PDF viewer components
- Reconciliation components (some have them, inconsistent)

### 3.2 API Fetch Error Handling

**File**: `/packages/web/src/lib/apiFetch.js`

**Grade: A** (Excellent wrapper with retry logic)

```typescript
export async function apiFetch(path, options = {}) {
  const { retry = 0, retryOptions = {}, showToast = true } = options;

  // Retry logic with exponential backoff
  for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
    try {
      const response = await handleFetchError(fetch(url, fetchOptions), errorOptions);

      if (raw) return response;

      // Auto-parse JSON
      if (contentType?.includes('application/json')) {
        return await response.json();
      }

      return (await response.text()) || null;
    } catch (error) {
      console.error('[apiFetch] Request failed:', { url, method, attempt, error });

      if (retryConfig.shouldRetry(error, attempt, retryConfig.maxRetries)) {
        const delay = calculateBackoff(attempt, baseDelay, maxDelay);
        await sleep(delay, signal);
        continue;
      }

      throw error;
    }
  }
}
```

**Strengths**:

- Automatic JSON parsing
- Retry with exponential backoff
- Abort signal support
- Toast notifications
- Only retries on 5xx and transport errors (not 4xx)
- Integration with handleFetchError

**Issue**: Console.error instead of logError

### 3.3 Error Utilities

**File**: `/packages/web/src/lib/error-utils.js`

**Grade: A-** (Comprehensive, good separation)

```typescript
export async function handleFetchError(fetchPromise, options = {}) {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      const domainError = await parseApiError(response);
      await handleDomainError(domainError, options);
      throw domainError;
    }

    return response;
  } catch (error) {
    if (isDomainError(error)) {
      throw error;
    }

    const normalizedError = normalizeError(error);

    if (isTransportError(normalizedError)) {
      await handleTransportError(normalizedError, options);
    } else if (isDomainError(normalizedError)) {
      await handleDomainError(normalizedError, options);
    }

    throw normalizedError;
  }
}
```

**User-Friendly Messages**:

```typescript
const USER_FRIENDLY_MESSAGES = {
  AUTH_REQUIRED: 'Please sign in to continue',
  AUTH_INVALID: 'Invalid email or password',
  PROJECT_NOT_FOUND: 'This project could not be found',
  FILE_TOO_LARGE: 'This file is too large. Please choose a smaller file.',
  TRANSPORT_NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
};
```

**Strengths**:

- Separates domain and transport error handling
- User-friendly message mapping
- Toast notification integration
- Navigation support for auth redirects
- Form error support

### 3.4 Form Error Handling

**File**: `/packages/web/src/lib/form-errors.js`

**Grade: A** (Excellent field-level error support)

```typescript
export function createFormErrorSignals(createSignal, createStore) {
  const [fieldErrors, setFieldErrors] = createStore({});
  const [globalError, setGlobalError] = createSignal('');

  return {
    fieldErrors,      // Reactive store: { email: 'Invalid', password: 'Too short' }
    globalError,      // Reactive signal: 'Failed to save'
    setFieldError(field, message),
    clearFieldError(field),
    handleError(error),  // Auto-maps validation errors to fields
  };
}
```

**Strengths**:

- Fine-grained reactivity per field
- Automatic field mapping from validation errors
- Multi-field error support
- Clean API for forms

### 3.5 Error Logger

**File**: `/packages/web/src/lib/errorLogger.js`

**Grade: B+** (Good design, underutilized)

```typescript
export function logError(error, context = {}) {
  const errorData = formatErrorData(error);
  const message = context.action ? `${context.action}: ${errorData.message}` : errorData.message;

  log(LogLevel.ERROR, message, {
    ...context,
    error: errorData,
  });
}

export function bestEffort(promise, context = {}) {
  return promise.catch(error => {
    logWarning(`Best-effort operation failed: ${context.operation}`, {
      ...context,
      error: formatErrorData(error),
    });
    return undefined;
  });
}
```

**Strengths**:

- Centralized logging point
- Sentry integration ready (commented out)
- Context tracking
- Best-effort helper for non-critical operations

**Critical Issue**: Only **7 uses** of `logError` in frontend vs **218 direct console.error calls**

**Usage breakdown**:

- `ErrorBoundary.jsx`: 2 uses
- `errorLogger.js`: 5 uses (internal + exports)

**Recommendation**: Enforce `logError` usage through ESLint rule.

---

## 4. Error Logging Analysis

### 4.1 Console Usage Statistics

**Backend (workers)**:

- `console.error/warn`: **204 occurrences** across 54 files
- Structured logging: **2 uses** (in logger.ts)
- `throw new Error`: **9 occurrences** (very low)

**Frontend (web)**:

- `console.error/warn`: **218 occurrences** across 76 files
- `logError`: **7 occurrences** across 2 files
- Usage ratio: **31:1** (console vs logError)

### 4.2 Silent Error Suppression

**Pattern**: `.catch(console.warn)` - **6 occurrences**

Examples:

```typescript
// packages/web/src/components/project/ProjectView.jsx
cachePdf(projectId, studyId, fileName, arrayBuffer).catch(console.warn);
deletePdf(orgId, projectId, studyId, fileName).catch(console.warn);

// packages/web/src/stores/projectActionsStore/pdfs.js
uploadPdf(...).catch(console.warn);
```

**Issue**: These errors are suppressed without:

- User feedback
- Retry mechanism
- State tracking
- Monitoring

**Better Pattern**:

```typescript
bestEffort(cachePdf(...), { operation: 'cachePdf', studyId });
```

### 4.3 Empty Catch Blocks

**Pattern**: `.catch(() => {})` - **11 occurrences**

Examples:

```typescript
// packages/web/src/components/project/ProjectsPanel.jsx
projectActionsStore.project.update(name, description).catch(() => {});

// packages/web/src/stores/projectActionsStore/project.js
apiFetch(...).catch(() => {});
```

**Critical Issue**: Complete error suppression with no fallback, logging, or user feedback.

---

## 5. Error Recovery Strategies

### 5.1 Offline/Online Handling

**File**: `/packages/web/src/primitives/useOnlineStatus.js`

**Grade: A-** (Smart implementation)

```typescript
export default function useOnlineStatus() {
  const [isOnline, setIsOnline] = createSignal(navigator.onLine);

  // Verify connectivity with actual request
  async function verifyConnectivity() {
    try {
      await fetch('/api/health', {
        method: 'HEAD',
        signal: controller.signal,
        cache: 'no-store',
      });
      return true;
    } catch (err) {
      console.warn('Connectivity check failed:', err.message);
      return false;
    }
  }

  // Debounced to prevent thrashing
  const debouncedHandleOnline = debounce(async () => {
    const actuallyOnline = await verifyConnectivity();
    if (actuallyOnline) setIsOnline(true);
  }, 500);
}
```

**Strengths**:

- Debouncing prevents thrashing
- Verifies connectivity with real request
- Handles flaky networks

**Gap**: No automatic retry of failed requests when coming back online.

### 5.2 Retry Logic

**apiFetch** includes retry:

```typescript
const DEFAULT_RETRY_OPTIONS = {
  maxRetries: 0, // disabled by default
  shouldRetry: (error, attempt, maxRetries) => {
    if (attempt >= maxRetries) return false;
    if (error.code?.startsWith('TRANSPORT_')) return true;
    if (error.statusCode >= 500) return true;
    return false;
  },
};
```

**Good**: Only retries on network errors and 5xx (not client errors).

**Gap**: No persistent retry queue for failed mutations while offline.

### 5.3 Query Client Error Handling

**File**: `/packages/web/src/lib/queryClient.js`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error?.statusCode === 401 || error?.statusCode === 403) {
          return false;
        }
        return failureCount < 2;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: false, // Never retry mutations automatically
    },
  },
});
```

**Strengths**:

- Smart retry logic (don't retry auth errors)
- Exponential backoff
- Mutations don't auto-retry (correct)

**Gap**: No onError callback for centralized error tracking.

### 5.4 WebSocket Reconnection

**File**: `/packages/web/src/primitives/useProject/connection.js`

Limited information available, but based on Durable Objects code, reconnection is handled by client but no error state is communicated from server.

**Gap**: No guidance sent to client on close codes (e.g., AUTH_REQUIRED vs SERVER_ERROR).

---

## 6. User-Facing Error Messages

### 6.1 Toast Notifications

**Integration**: All error handlers support toast notifications via `showToast.error()`

**User-Friendly Messages**: Excellent mapping in `error-utils.js`:

```typescript
AUTH_REQUIRED: 'Please sign in to continue',
PROJECT_NOT_FOUND: 'This project could not be found',
FILE_TOO_LARGE: 'This file is too large. Please choose a smaller file.',
TRANSPORT_NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
```

**Issue**: System errors fallback to generic message:

```typescript
SYSTEM_DB_ERROR: 'Something went wrong. Please try again.',
SYSTEM_INTERNAL_ERROR: 'Something went wrong. Please try again.',
```

These provide no actionable information for users.

### 6.2 Error Boundary Display

**AppErrorBoundary** shows:

- Friendly title based on error type
- User-friendly message
- "Try Again" button (reset)
- "Go Home" button
- Error details in dev mode

**Good UX**, but no:

- Automatic error reporting option
- Session recovery guidance
- Contact support link

---

## 7. API Error Responses

### 7.1 Error Shape Consistency

**Grade: A** (Excellent consistency)

All API errors follow DomainError shape:

```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "Project not found",
  "statusCode": 404,
  "details": {
    "projectId": "proj-123"
  },
  "timestamp": "2026-01-19T10:30:00Z"
}
```

### 7.2 HTTP Status Codes

**Mapping**:

- 400: Validation errors
- 401: Authentication required/invalid
- 403: Authorization denied
- 404: Resource not found
- 409: Conflict (duplicate, constraint violation)
- 413: File too large
- 500: System/database errors

**Consistent** across all routes.

### 7.3 Validation Error Details

**Excellent field-level details**:

```json
{
  "code": "VALIDATION_MULTI_FIELD",
  "message": "Validation failed for multiple fields",
  "statusCode": 400,
  "details": {
    "fields": [
      { "field": "email", "message": "Invalid email address" },
      { "field": "password", "message": "Password too short" }
    ]
  }
}
```

---

## 8. Monitoring and Observability

### 8.1 Current State

**Grade: D** (Infrastructure ready, not implemented)

**Sentry Integration**:

```typescript
// errorLogger.js - Lines 72-94
// Future Sentry integration point
// When Sentry is configured, add integration here:
//
// if (typeof window !== 'undefined' && window.Sentry) {
//   if (level === LogLevel.ERROR && context.error) {
//     window.Sentry.captureException(context.error, {
//       tags: { component, action },
//       extra: context,
//     });
//   }
// }
```

**Issues**:

1. Sentry is commented out (not integrated)
2. No error tracking in production
3. No aggregation or alerting
4. No error rate monitoring
5. Backend has no structured logging

### 8.2 Missing Observability

**No answers to critical questions**:

- What's the error rate?
- Which endpoints fail most?
- Which errors affect most users?
- Are errors increasing or decreasing?
- Which components crash most?
- What's the mean time to recovery?

**Recommendation**: Implement Sentry with:

- Error grouping by code
- Component breadcrumbs
- User context
- Release tracking
- Performance monitoring

### 8.3 Correlation and Tracing

**Missing**:

- Request correlation IDs
- Error trace IDs
- User session tracking across errors
- Error chains (A caused B caused C)

---

## 9. Graceful Degradation

### 9.1 Offline Support

**QueryClient Persistence**: Good offline cache with 24-hour expiration.

**Gap**: No offline mutation queue. Users can:

- View cached data offline
- Cannot create/update while offline
- Mutations fail without queuing

**Recommendation**: Implement persistent mutation queue:

```typescript
// When offline, queue mutations
if (!isOnline()) {
  await queueMutation({ type, payload, timestamp });
  showToast.info('Changes saved. Will sync when online.');
}

// On reconnect, flush queue
onOnline(() => {
  flushMutationQueue();
});
```

### 9.2 Partial Failure Handling

**Good Examples**:

- PDF upload failure doesn't break study creation
- Profile sync failures are tracked individually
- Best-effort cache operations

**Gap**: No user feedback when optional operations fail:

```typescript
// ProjectView.jsx - Line 125
cachePdf(...).catch(console.warn);  // User never knows this failed
```

### 9.3 Fallback Strategies

**Query Client**:

- Stale-while-revalidate for queries
- Background refetch on window focus
- Retry with exponential backoff

**Missing**:

- Service worker for offline pages
- Cached route rendering
- Degraded mode indicator

---

## 10. Error Handling by Domain

### 10.1 Authentication Errors

**Grade: A-** (Well handled)

**Good**:

- Automatic redirect on AUTH_REQUIRED
- Session expiry handling
- Email verification flow

**Gap**: No session recovery after network errors.

### 10.2 Database Errors

**Grade: B** (Logged but not monitored)

**Patterns**:

- Wrapped in try/catch
- Converted to domain errors
- Operation context included

**Issues**:

- No DB error classification (deadlock vs constraint)
- No automatic retry for transient errors
- No circuit breaker for repeated failures

### 10.3 Validation Errors

**Grade: A** (Excellent field-level handling)

**Strengths**:

- Field-level error mapping
- Multi-field error support
- Clear user feedback

### 10.4 File Upload Errors

**Grade: B+** (Good error handling, poor recovery)

**Good**:

- File size validation
- Type validation
- Cleanup on failure

**Gap**: No resumable uploads, no retry on network error.

### 10.5 Real-time Sync Errors

**Grade: C+** (Needs improvement)

**Issues**:

- WebSocket errors logged but not surfaced
- No sync error UI state
- No conflict resolution guidance
- Reconnection is automatic but opaque

---

## 11. Testing Coverage

### 11.1 Error Handling Tests

**Backend**:

- Error handler middleware tested
- Validation tested
- Auth error flows tested

**Frontend**:

- ErrorBoundary tested (`ErrorBoundary.test.jsx`)
- Error utils tested (`error-utils.test.js`)
- Form errors tested (`form-errors.test.js`)

**Good coverage** for core error utilities.

**Gap**: No E2E error recovery tests (e.g., offline → online).

---

## 12. Critical Issues Summary

### 12.1 High Priority

1. **No monitoring/alerting** - Zero visibility into production errors
   - **Impact**: Cannot detect or respond to user-facing issues
   - **Fix**: Implement Sentry integration (already prepared)

2. **Inconsistent error logging** - 218 console.error vs 7 logError
   - **Impact**: Errors bypass centralized tracking
   - **Fix**: ESLint rule to enforce logError usage

3. **Silent error suppression** - `.catch(console.warn)` and `.catch(() => {})`
   - **Impact**: Users don't know operations failed
   - **Fix**: Replace with bestEffort() or proper error handling

4. **Missing offline mutation queue**
   - **Impact**: Users lose work when offline
   - **Fix**: Implement persistent mutation queue

### 12.2 Medium Priority

5. **Missing error boundaries** - Many complex components unprotected
   - **Impact**: Errors crash entire app instead of section
   - **Fix**: Add SectionErrorBoundary to critical components

6. **No error recovery guidance** - Generic "try again" messages
   - **Impact**: Users don't know how to fix issues
   - **Fix**: Add actionable guidance per error type

7. **No correlation IDs** - Cannot trace errors across services
   - **Impact**: Difficult to debug distributed issues
   - **Fix**: Add request/trace IDs to all errors

8. **WebSocket errors opaque** - No error state in UI
   - **Impact**: Users don't know sync is broken
   - **Fix**: Add sync error state to connection status

### 12.3 Low Priority

9. **No circuit breaker** - Repeated failures not throttled
   - **Impact**: Can amplify outages
   - **Fix**: Add circuit breaker for external services

10. **No error rate limiting** - Can spam logs/monitoring
    - **Impact**: Noise in logs, potential DDoS vector
    - **Fix**: Rate limit error responses per client

---

## 13. Recommendations

### 13.1 Immediate Actions (Week 1)

1. **Enable Sentry** - Uncomment integration in errorLogger.js
2. **Add ESLint rule** - Enforce logError over console.error:
   ```json
   {
     "rules": {
       "no-console": ["error", { "allow": ["info"] }],
       "corates/use-log-error": "error"
     }
   }
   ```
3. **Audit and fix silent suppressions** - Replace all `.catch(console.warn)` and `.catch(() => {})`

### 13.2 Short-term Improvements (Month 1)

4. **Add correlation IDs** - Generate and track request IDs
5. **Implement offline mutation queue** - Persistent queue for mutations
6. **Add error boundaries** - Protect critical component trees:
   - PDF viewer
   - Reconciliation components
   - Chart/visualization components
   - Form components

### 13.3 Long-term Enhancements (Quarter 1)

7. **Enhanced error recovery**:
   - Session recovery on auth errors
   - Automatic retry for transient DB errors
   - Resumable file uploads
   - Sync conflict resolution UI

8. **Monitoring dashboards**:
   - Error rate by endpoint
   - Error rate by component
   - Mean time to recovery
   - User impact metrics

9. **Graceful degradation**:
   - Service worker for offline pages
   - Degraded mode indicator
   - Cached route rendering

### 13.4 Documentation Updates

10. **Error handling guide** - Already excellent, add:
    - Error recovery patterns
    - Monitoring best practices
    - Common error scenarios and solutions

---

## 14. Error Handling Checklist

Use this checklist for new features:

### Backend (API Routes)

- [ ] All database operations wrapped in try/catch
- [ ] Errors converted to domain errors
- [ ] Operation context included in error details
- [ ] Appropriate HTTP status codes
- [ ] Validation uses shared validation schemas
- [ ] Errors logged through centralized logger (not console)

### Frontend (Components)

- [ ] Error boundary wraps component tree
- [ ] API calls use apiFetch wrapper
- [ ] Errors handled with logError (not console)
- [ ] User feedback via toast or inline message
- [ ] Loading and error states in UI
- [ ] Retry mechanism for recoverable errors

### Forms

- [ ] Field-level error display
- [ ] Global form error display
- [ ] Validation errors mapped to fields
- [ ] Clear error on field change

### Real-time Features

- [ ] Connection error state in UI
- [ ] Reconnection strategy
- [ ] Sync error handling
- [ ] Conflict resolution

---

## 15. Code Examples

### 15.1 Good Patterns

**Centralized error logging**:

```typescript
import { logError } from '@lib/errorLogger.js';

try {
  await riskyOperation();
} catch (error) {
  logError(error, { component: 'MyComponent', action: 'riskyOperation' });
  throw error;
}
```

**Best-effort operations**:

```typescript
import { bestEffort } from '@lib/errorLogger.js';

bestEffort(cachePdf(projectId, studyId, data), {
  operation: 'cachePdf',
  studyId,
});
```

**Form error handling**:

```typescript
const errors = createFormErrorSignals(createSignal, createStore);

try {
  await apiFetch.post('/api/projects', formData);
} catch (error) {
  errors.handleError(error); // Auto-maps to field errors
}
```

### 15.2 Anti-Patterns

**Silent suppression**:

```typescript
// BAD
uploadPdf(...).catch(console.warn);
cachePdf(...).catch(() => {});

// GOOD
bestEffort(uploadPdf(...), { operation: 'uploadPdf', studyId });
```

**Direct console.error**:

```typescript
// BAD
try {
  await operation();
} catch (err) {
  console.error('Operation failed:', err);
}

// GOOD
try {
  await operation();
} catch (err) {
  logError(err, { component: 'MyComponent', action: 'operation' });
}
```

---

## 16. Conclusion

CoRATES has a **solid foundation** for error handling with a well-architected shared error system, strong type safety, and good separation of concerns. The error handling patterns are **consistent and comprehensive** across the codebase.

**However**, the lack of **monitoring and observability** is a critical gap that prevents the team from understanding production issues. The **inconsistent use of centralized logging** makes it difficult to track errors, and **silent error suppression** patterns hide failures from users.

**Priority fixes**:

1. Enable Sentry integration (1 day)
2. Enforce logError usage via ESLint (1 day)
3. Audit and fix silent suppressions (2-3 days)
4. Add error boundaries to critical components (1 week)
5. Implement offline mutation queue (1-2 weeks)

With these improvements, CoRATES will have **production-grade error handling** with full visibility, better user experience, and faster incident response.

---

## Appendix: File Reference

### Shared Error System

- `/packages/shared/src/errors/index.ts` - Public API
- `/packages/shared/src/errors/types.ts` - Type definitions
- `/packages/shared/src/errors/helpers.ts` - Error creation helpers
- `/packages/shared/src/errors/normalize.ts` - Error normalization
- `/packages/shared/src/errors/validate.ts` - Error validation
- `/packages/shared/src/errors/domains/domain.ts` - Domain error codes
- `/packages/shared/src/errors/domains/transport.ts` - Transport error codes
- `/packages/shared/src/errors/domains/unknown.ts` - Unknown error codes

### Backend Error Handling

- `/packages/workers/src/middleware/errorHandler.ts` - Global error handler
- `/packages/workers/src/config/validation.ts` - Validation schemas and helpers
- `/packages/workers/src/routes/orgs/projects.ts` - Example API route with error handling

### Frontend Error Handling

- `/packages/web/src/components/ErrorBoundary.jsx` - Error boundaries
- `/packages/web/src/lib/error-utils.js` - Error parsing and handling
- `/packages/web/src/lib/errorLogger.js` - Centralized error logger
- `/packages/web/src/lib/apiFetch.js` - API fetch wrapper with retry
- `/packages/web/src/lib/form-errors.js` - Form error utilities
- `/packages/web/src/lib/queryClient.js` - Query client with error handling
- `/packages/web/src/primitives/useOnlineStatus.js` - Online/offline detection

### Documentation

- `/packages/docs/guides/error-handling.md` - Error handling guide
