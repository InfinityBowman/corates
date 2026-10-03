# Error Handling Guide

This guide explains how to handle errors consistently across the CoRATES application using the shared error system.

## Overview

CoRATES uses a centralized error system defined in `@corates/shared` that provides:

- **Type-safe error codes** - String-based error codes (e.g., `PROJECT_NOT_FOUND`)
- **Canonical error shape** - Consistent error structure across frontend and backend
- **Domain vs Transport separation** - Clear distinction between API errors and network errors
- **Validation error details** - Field-level error information for forms

## Error Types

### Domain Errors

Domain errors come from the backend API and always include a `statusCode`. These represent business logic errors.

```javascript
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

// Create a domain error
const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: '123' });
// Returns: { code: 'PROJECT_NOT_FOUND', message: 'Project not found', statusCode: 404, ... }
```

### Transport Errors

Transport errors occur during network/fetch operations (frontend only). They do NOT have a `statusCode`.

```javascript
import { createTransportError } from '@corates/shared';

// Create a transport error
const error = createTransportError('TRANSPORT_NETWORK_ERROR');
// Returns: { code: 'TRANSPORT_NETWORK_ERROR', message: 'Unable to connect...', ... }
```

### Validation Errors

Validation errors are a special type of domain error with field-level details.

```javascript
import { createValidationError, createMultiFieldValidationError } from '@corates/shared';

// Single field error
const error = createValidationError('email', 'VALIDATION_FIELD_REQUIRED', '');
// Returns: { code: 'VALIDATION_FIELD_REQUIRED', details: { field: 'email', value: '', ... }, ... }

// Multi-field error
const multiError = createMultiFieldValidationError([
  { field: 'email', code: 'VALIDATION_FIELD_REQUIRED', message: 'Email is required' },
  { field: 'password', code: 'VALIDATION_FIELD_TOO_SHORT', message: 'Password too short' },
]);
```

## Backend Usage

### Creating Domain Errors

Server functions (the default; see the [API Development Guide](/guides/api-development)) throw. The serialization adapter in `src/start.ts` delivers the error to the browser with its `code`, `statusCode` and `details`.

```ts
// packages/web/src/server/functions/workspaces.server.ts
import { throwDomainError, PROJECT_ERRORS } from '@corates/shared';

if (!target) {
  throwDomainError(PROJECT_ERRORS.NOT_FOUND, { orgId, userId: targetUserId }, 'Member not found');
}
```

Guards return the error instead of throwing it, so the caller decides: server functions `throw result.error`, HTTP routes `return result.error.toResponse()`.

HTTP routes (`routes/api/`, raw HTTP only) return the error as JSON:

```ts
// packages/web/src/routes/api/orgs/$orgId/projects/$projectId/studies/$studyId/pdfs/$fileName.ts
if (!object) {
  return Response.json(createDomainError(FILE_ERRORS.NOT_FOUND, { fileName }), { status: 404 });
}
```

### Validation errors

Server functions validate input with Zod in `.validator(...)`. HTTP routes parse their own bodies and return a `createValidationError(...)` response. See the [API Development Guide](/guides/api-development#validation) for examples.

## Frontend Usage

### Calling server functions

Server function calls throw the domain error. Catch it and hand it to `handleError`, or read it with `getDomainError` / `isErrorCode` to branch on a specific code:

```ts
import { getDomainError, handleError } from '@/lib/error-utils';
import { acceptInvitation } from '@/server/functions/invitations.functions';

try {
  await acceptInvitation({ data: { token } });
} catch (err) {
  const domainError = getDomainError(err);
  if (domainError?.code === 'PROJECT_MEMBER_ALREADY_EXISTS') {
    // already in, treat as success
  } else {
    await handleError(err, { toastTitle: 'Could not accept invitation' });
  }
}
```

Inside TanStack Query, let the query or mutation reject and render `error`, or handle it in `onError`.

### Calling HTTP routes: apiFetch

The few HTTP routes (PDF list, upload, download, delete) go through `apiFetch`, which parses JSON, turns error bodies into domain errors, and shows toasts:

```ts
import { apiFetch } from '@/lib/apiFetch';

const pdfs = await apiFetch.get(`/api/orgs/${orgId}/projects/${projectId}/studies/${studyId}/pdfs`);
```

Available methods: `apiFetch.get()`, `apiFetch.post()`, `apiFetch.put()`, `apiFetch.patch()`, `apiFetch.delete()`. For a raw `fetch`, `handleFetchError(fetch(url), { showToast: true })` does the same error handling.

### Form Error Handling

Most forms in the codebase use a simple pattern: one `error` useState for a general message, set via `handleError` from `@/lib/error-utils`. Fine-grained field-level errors are only needed for forms with structured validation (admin mutations, contact form); those use `handleFormError` + `createFormErrorState` from `@/lib/form-errors`.

**Simple form (most common pattern):**

```tsx
import { useState } from 'react';
import { handleError } from '@/lib/error-utils';
import { useNavigate } from '@tanstack/react-router';

function MyForm() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await createProject({ data: { orgId, name } });
      navigate({ to: '/dashboard' });
    } catch (err) {
      await handleError(err, { setError, showToast: false, navigate });
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name='email' />
      {error && <div className='text-sm text-red-600'>{error}</div>}
      <button type='submit' disabled={loading}>
        Submit
      </button>
    </form>
  );
}
```

**Field-level errors (when the API returns `details.field` or `details.fields`):**

```tsx
import { useMemo, useState } from 'react';
import { handleFormError, createFormErrorState } from '@/lib/form-errors';

function MyForm() {
  const fieldState = useMemo(() => createFormErrorState(), []);
  const [, forceRender] = useState(0);
  const [globalError, setGlobalError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fieldState.clearAll();
    setGlobalError('');
    try {
      await submitContactForm({ data: { name, email, subject, message } });
    } catch (err) {
      handleFormError(
        err as Parameters<typeof handleFormError>[0],
        (field, message) => {
          fieldState.setFieldError(field, message);
          forceRender(n => n + 1);
        },
        setGlobalError,
      );
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input name='email' />
      {fieldState.getFieldError('email') && (
        <span className='text-sm text-red-600'>{fieldState.getFieldError('email')}</span>
      )}
      {globalError && <div className='text-sm text-red-600'>{globalError}</div>}
    </form>
  );
}
```

The `handleFormError(error, setFieldError, setGlobalError)` signature is two callbacks -- one invoked per field error (possibly multiple times for multi-field validation errors), one for top-level errors.

### Error Boundaries

Error boundaries catch rendering errors and unknown/programmer errors:

```javascript
// packages/web/src/components/ErrorBoundary.jsx
import AppErrorBoundary from '@/components/ErrorBoundary.jsx';

function App() {
  return (
    <AppErrorBoundary>
      <YourComponent />
    </AppErrorBoundary>
  );
}
```

## Error Code Reference

### Authentication Errors (`AUTH_*`)

- `AUTH_REQUIRED` - Authentication required (401)
- `AUTH_INVALID` - Invalid credentials (401)
- `AUTH_EXPIRED` - Session expired (401)
- `AUTH_FORBIDDEN` - Access denied (403)

### Validation Errors (`VALIDATION_*`)

- `VALIDATION_FIELD_REQUIRED` - Required field missing (400)
- `VALIDATION_FIELD_INVALID_FORMAT` - Invalid format (400)
- `VALIDATION_FIELD_TOO_LONG` - Value too long (400)
- `VALIDATION_FIELD_TOO_SHORT` - Value too short (400)
- `VALIDATION_MULTI_FIELD` - Multiple field errors (400)
- `VALIDATION_FAILED` - General validation failure (400)

### Project Errors (`PROJECT_*`)

- `PROJECT_NOT_FOUND` - Project not found (404)
- `PROJECT_ACCESS_DENIED` - Access denied (403)
- `PROJECT_MEMBER_EXISTS` - User already a member (409)
- `PROJECT_LAST_OWNER` - Cannot remove last owner (400)

### File Errors (`FILE_*`)

- `FILE_TOO_LARGE` - File exceeds size limit (413)
- `FILE_INVALID_TYPE` - Invalid file type (400)
- `FILE_NOT_FOUND` - File not found (404)
- `FILE_UPLOAD_FAILED` - Upload failed (500)

### Transport Errors (`TRANSPORT_*`)

- `TRANSPORT_NETWORK_ERROR` - Network connection failed
- `TRANSPORT_TIMEOUT` - Request timed out
- `TRANSPORT_CORS_ERROR` - CORS error

### Unknown Errors (`UNKNOWN_*`)

- `UNKNOWN_PROGRAMMER_ERROR` - Programmer error (500)
- `UNKNOWN_UNHANDLED_ERROR` - Unhandled error (500)
- `UNKNOWN_INVALID_RESPONSE` - Invalid API response (500)

## Best Practices

### ✅ DO

- **Use `apiFetch` for all API calls** (preferred)
- Use error helpers from `@corates/shared`
- Handle domain errors with `handleDomainError()`
- Handle transport errors with `handleTransportError()`
- Use form error utilities for validation errors
- Use error boundaries for rendering errors

### ❌ DON'T

- Use raw `fetch()` with manual error handling
- Throw string literals (use `no-throw-literal` ESLint rule)
- Create raw `Error()` objects without error codes
- Use string matching for error codes
- Mix domain and transport error handling
- Ignore error boundaries

## ESLint Rules

The project includes ESLint rules to enforce error handling:

- `no-throw-literal: error` - Prevents throwing string literals

## Migration Guide

When migrating existing code:

1. Replace numeric error codes with string codes from `@corates/shared`
2. Replace `createErrorResponse()` with `createDomainError()`
3. Replace string-based error matching with type-safe code checks
4. Use `handleFetchError()` for all fetch calls
5. Use form error utilities for form validation

## Examples

See the test files for comprehensive examples:

- `packages/shared/src/errors/__tests__/helpers.test.ts`
- `packages/web/src/lib/__tests__/error-utils.test.js`
- `packages/web/src/lib/__tests__/form-errors.test.js`
