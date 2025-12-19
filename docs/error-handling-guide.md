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

```javascript
// packages/workers/src/routes/projects.js
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

export async function getProject(c) {
  const project = await db.getProject(c.req.param('id'));

  if (!project) {
    return c.json(createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: c.req.param('id') }), 404);
  }

  return c.json(project);
}
```

### Validation Middleware

The validation middleware automatically creates validation errors:

```javascript
// packages/workers/src/config/validation.js
// Already configured to use shared error system
// Returns DomainError objects with validation details
```

## Frontend Usage

### Handling API Errors

```javascript
// packages/web/src/lib/error-utils.js
import { handleFetchError, handleDomainError } from '@/lib/error-utils.js';

// Wrap fetch calls
try {
  const response = await handleFetchError(fetch('/api/projects'), { showToast: true });
  const data = await response.json();
} catch (error) {
  // Error already handled (toast shown, etc.)
  // error is a DomainError or TransportError
}
```

### Form Error Handling

```javascript
// packages/web/src/lib/form-errors.js
import { createFormErrorSignals, handleFormError } from '@/lib/form-errors.js';
import { createSignal } from 'solid-js';

function MyForm() {
  const errors = createFormErrorSignals(createSignal);

  async function handleSubmit() {
    try {
      const response = await fetch('/api/projects', { ... });
      // ...
    } catch (error) {
      // Handle validation errors with field details
      errors.handleError(error);
    }
  }

  return (
    <form>
      <input name="email" />
      {errors.fieldErrors().email && (
        <span class="error">{errors.fieldErrors().email}</span>
      )}
      {errors.globalError() && (
        <div class="error">{errors.globalError()}</div>
      )}
    </form>
  );
}
```

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

- Use error helpers from `@corates/shared`
- Handle domain errors with `handleDomainError()`
- Handle transport errors with `handleTransportError()`
- Use form error utilities for validation errors
- Wrap fetch calls with `handleFetchError()`
- Use error boundaries for rendering errors

### ❌ DON'T

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
