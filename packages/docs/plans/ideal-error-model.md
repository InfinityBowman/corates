---
name: Ideal Error Model Architecture
overview: Design and implement a comprehensive, type-safe error model with strongly typed error codes, canonical error shape, domain boundaries, and clear separation between machine-readable codes and user-facing messages.
todos:
  - id: create-shared-structure
    content: Create packages/shared package with TypeScript setup, build configuration, and src/errors/ structure with domains, types, and helpers
    status: in_progress
  - id: define-error-codes
    content: Define all error codes in TypeScript domain files (auth, validation, project, file, transport, system) with type-safe exports
    status: pending
  - id: create-canonical-shape
    content: Implement AppError, DomainError, and TransportError interfaces (TypeScript) with strongly typed ErrorDetails, and error creation helpers (TypeScript, compiled to JavaScript with .d.ts files)
    status: pending
  - id: update-validation
    content: Update validation middleware (JavaScript) to import and use shared error codes (from TypeScript package)
    status: pending
  - id: migrate-backend-routes
    content: Migrate all backend routes (JavaScript) to import and use createDomainError from shared TypeScript package
    status: pending
  - id: remove-numeric-codes
    content: Remove all numeric error codes from backend and frontend
    status: pending
  - id: update-frontend-utils
    content: Replace error-utils.js (JavaScript) with new error handling system that separates domain errors (from API) from transport errors (network issues), importing from shared TypeScript package
    status: pending
  - id: add-form-error-handling
    content: Implement form-level error handling utilities
    status: pending
  - id: add-error-boundaries
    content: Add error boundaries for unknown/programmer errors
    status: pending
  - id: add-lint-rules
    content: Add ESLint rules to prevent untyped errors
    status: pending
  - id: add-error-validation
    content: Add strict runtime validation for error responses (validateErrorResponse) that ensures domain errors have proper shape and rejects transport/unknown codes from API
    status: pending
  - id: migrate-components
    content: Migrate all components to use new error handling patterns
    status: pending
  - id: add-tests
    content: Add comprehensive tests for error handling
    status: pending
  - id: add-documentation
    content: Create error code reference and handling guide
    status: pending
---

# Ideal error model architecture

## Design principles

1. Single canonical error shape: All errors follow one consistent structure
2. Strongly typed codes: String-based error codes with compile-time type safety
3. Domain boundaries: Errors organized by domain (auth, projects, files, etc.)
4. Code vs message separation: Codes are machine-readable, messages are user-facing
5. Prevent untyped errors: No string-based error matching, all errors must have codes
6. Transport vs domain: Network/transport errors separate from business logic errors
7. Safe unknown errors: Programmer errors and unknown errors handled gracefully

## Canonical error shape

All errors follow this structure, with distinct types for domain vs transport errors:

```typescript
// Base error shape
interface AppError {
  code: string; // Machine-readable error code (e.g., "PROJECT_NOT_FOUND")
  message: string; // User-facing message (localized, can be overridden)
  timestamp?: string; // Error timestamp (for debugging)
}

// Domain errors - business logic errors from backend API
interface DomainError extends AppError {
  code: DomainErrorCode; // Typed error code
  statusCode: number; // HTTP status code (required for domain errors)
  details?: ErrorDetails; // Typed details based on error code
}

// Transport errors - network/connection errors (frontend only, never from API)
interface TransportError extends AppError {
  code: TransportErrorCode;
  details?: TransportErrorDetails;
  // Note: Transport errors don't have statusCode (they occur before/after API call)
}

// Error details - strongly typed based on error code
// Each error code has a specific details shape
// Runtime: details shape validated based on error code
// TypeScript: discriminated union based on code for type safety
type ErrorDetails =
  | ValidationErrorDetails
  | ProjectErrorDetails
  | FileErrorDetails
  | AuthErrorDetails
  | SystemErrorDetails;

// Note: In practice, details typing is validated at runtime based on error code
// TypeScript provides compile-time hints, but runtime validation ensures correctness

// Union of all domain error codes for type safety
type DomainErrorCode = ValidationErrorCode | ProjectErrorCode | FileErrorCode | AuthErrorCode | SystemErrorCode;

// Transport error codes (frontend only)
type TransportErrorCode = 'TRANSPORT_NETWORK_ERROR' | 'TRANSPORT_TIMEOUT' | 'TRANSPORT_CORS_ERROR';

interface ValidationErrorDetails {
  field: string;
  value?: unknown;
  constraint?: string;
  fields?: Array<{ field: string; message: string }>; // For multi-field errors
}

interface ProjectErrorDetails {
  projectId?: string;
  userId?: string;
  role?: string;
  [key: string]: unknown; // Domain-specific fields
}

interface FileErrorDetails {
  fileName?: string;
  fileSize?: number;
  fileType?: string;
  [key: string]: unknown;
}

interface AuthErrorDetails {
  provider?: string;
  reason?: string;
  [key: string]: unknown;
}

interface SystemErrorDetails {
  operation?: string;
  originalError?: unknown;
  [key: string]: unknown;
}

// Transport error details (frontend only)
interface TransportErrorDetails {
  originalError?: unknown;
  url?: string;
  method?: string;
  statusCode?: number;
}
```

## Error code structure

### Domain organization

Errors organized by domain with hierarchical codes:

```javascript
<DOMAIN>_<CATEGORY>_<SPECIFIC>

Examples:
- AUTH_REQUIRED
- AUTH_INVALID_CREDENTIALS
- PROJECT_NOT_FOUND
- PROJECT_MEMBER_ALREADY_EXISTS
- VALIDATION_FIELD_REQUIRED
- VALIDATION_FIELD_INVALID_FORMAT
- TRANSPORT_NETWORK_ERROR
- TRANSPORT_TIMEOUT
```

### Error categories

Domain errors (from backend API):

- Validation errors (`VALIDATION_*`): Input validation, schema validation
- Authentication errors (`AUTH_*`): Auth required, invalid, expired, forbidden
- Domain errors (`<DOMAIN>_*`): Project, File, User, etc.
- System errors (`SYSTEM_*`): Database, internal server, service unavailable

Transport errors (frontend only, never from backend):

- Transport errors (`TRANSPORT_*`): Network, timeout, CORS, fetch failures
- These occur before/after API calls, not in API responses

Unknown errors (fallback):

- Unknown errors (`UNKNOWN_*`): Unhandled errors, programmer errors, invalid error shapes

## Shared error definitions

### Location: `packages/shared/src/errors/`

Important: The shared package is written in TypeScript to provide type safety, while the `web` and `workers` packages remain in JavaScript and consume the compiled output and type definitions.

### TypeScript build configuration

The shared package will:

- Use TypeScript to define all error codes, types, and helpers
- Compile to JavaScript (ESM) for runtime consumption
- Generate `.d.ts` type definition files for IDE support
- Export both compiled JavaScript and TypeScript definitions

Package structure:

```
packages/shared/
  package.json          # TypeScript package config
  tsconfig.json         # TypeScript configuration
  src/
    errors/            # TypeScript source files
  dist/                # Compiled JavaScript output
  dist/                # TypeScript .d.ts definitions
```

JavaScript package consumption:

- `web` and `workers` packages import from `@shared/errors`
- Runtime uses compiled JavaScript from `dist/`
- IDE provides autocomplete and type checking via `.d.ts` files
- No TypeScript required in consuming packages

```typescript
packages/shared/src/errors/
  index.ts                 # Public API exports (TypeScript)
  types.ts                 # TypeScript type definitions (AppError, DomainError, TransportError, ErrorDetails)
  domains/
    domain.ts              # Domain error codes (auth, validation, project, file, user, system)
    transport.ts           # Transport/network errors (frontend only)
    unknown.ts             # Unknown error codes (fallback)
  helpers.ts               # Helper functions (createDomainError, createTransportError, normalizeError)
  normalize.ts             # Error normalization (strict validation)
```

The shared package will:

- Compile TypeScript to JavaScript for runtime consumption
- Generate `.d.ts` type definition files for IDE support in JavaScript packages
- Export both ESM JavaScript and TypeScript definitions

### Error code definition format

Simplified format - just code, message, and status code:

```typescript
// packages/shared/src/errors/domains/project.ts
export const PROJECT_ERRORS = {
  NOT_FOUND: {
    code: 'PROJECT_NOT_FOUND',
    defaultMessage: 'Project not found',
    statusCode: 404,
  },
  ACCESS_DENIED: {
    code: 'PROJECT_ACCESS_DENIED',
    defaultMessage: 'You do not have access to this project',
    statusCode: 403,
  },
  MEMBER_ALREADY_EXISTS: {
    code: 'PROJECT_MEMBER_ALREADY_EXISTS',
    defaultMessage: 'User is already a member of this project',
    statusCode: 409,
  },
  // ... etc
} as const;

// Type-safe error code union
export type ProjectErrorCode = (typeof PROJECT_ERRORS)[keyof typeof PROJECT_ERRORS]['code'];

// Error definition type
export type ErrorDefinition = {
  code: string;
  defaultMessage: string;
  statusCode: number;
};
```

### Validation error format

```typescript
// packages/shared/src/errors/domains/validation.ts
export const VALIDATION_ERRORS = {
  FIELD_REQUIRED: {
    code: 'VALIDATION_FIELD_REQUIRED',
    defaultMessage: 'This field is required',
    statusCode: 400,
  },
  FIELD_INVALID_FORMAT: {
    code: 'VALIDATION_FIELD_INVALID_FORMAT',
    defaultMessage: 'Invalid format',
    statusCode: 400,
  },
  FIELD_TOO_LONG: {
    code: 'VALIDATION_FIELD_TOO_LONG',
    defaultMessage: 'Value is too long',
    statusCode: 400,
  },
  MULTI_FIELD: {
    code: 'VALIDATION_MULTI_FIELD',
    defaultMessage: 'Validation failed for multiple fields',
    statusCode: 400,
  },
  // ... etc
} as const;

export type ValidationErrorCode = (typeof VALIDATION_ERRORS)[keyof typeof VALIDATION_ERRORS]['code'];
```

## Backend implementation

### Error creation helpers

```typescript
// packages/shared/src/errors/helpers.ts
import type { ErrorDefinition, ErrorDetails } from './types.js';

// Create domain error with typed details
export function createDomainError(
  errorDef: ErrorDefinition,
  details?: ErrorDetails,
  messageOverride?: string,
): DomainError {
  return {
    code: errorDef.code as DomainErrorCode,
    message: messageOverride || errorDef.defaultMessage,
    details,
    statusCode: errorDef.statusCode,
    timestamp: new Date().toISOString(),
  };
}

// Create validation error with typed details
export function createValidationError(
  field: string,
  errorCode: ValidationErrorCode,
  value?: unknown,
  constraint?: string,
): DomainError {
  const errorDef = VALIDATION_ERRORS[errorCode];
  return {
    code: errorCode,
    message: errorDef.defaultMessage,
    details: { field, value, constraint } as ValidationErrorDetails,
    statusCode: errorDef.statusCode,
    timestamp: new Date().toISOString(),
  };
}

// Create multi-field validation error
export function createMultiFieldValidationError(
  errors: Array<{ field: string; code: ValidationErrorCode; message: string }>,
): DomainError {
  return {
    code: 'VALIDATION_MULTI_FIELD',
    message: VALIDATION_ERRORS.MULTI_FIELD.defaultMessage,
    details: { fields: errors } as ValidationErrorDetails,
    statusCode: 400,
    timestamp: new Date().toISOString(),
  };
}

// Create transport error (frontend only)
export function createTransportError(
  code: TransportErrorCode,
  message: string,
  details?: TransportError['details'],
): TransportError {
  return {
    code,
    message,
    details,
    timestamp: new Date().toISOString(),
  };
}
```

### Backend route usage

Note: Backend remains in JavaScript but imports from TypeScript-compiled shared package.

```javascript
// packages/workers/src/routes/projects.js
import { createDomainError, PROJECT_ERRORS } from '@shared/errors';

projectRoutes.get('/:id', async c => {
  const project = await db.getProject(id);

  if (!project) {
    return c.json(createDomainError(PROJECT_ERRORS.NOT_FOUND), PROJECT_ERRORS.NOT_FOUND.statusCode);
  }

  // ...
});

// Validation example
projectRoutes.post('/', validateRequest(projectSchema), async c => {
  // Validation middleware automatically creates validation errors
  // ...
});
```

### Validation middleware integration

Note: Backend remains in JavaScript but imports from TypeScript-compiled shared package.

```javascript
// packages/workers/src/config/validation.js
import { createValidationError, VALIDATION_ERRORS } from '@shared/errors';

export function validateRequest(schema) {
  return async (c, next) => {
    const result = schema.safeParse(body);

    if (!result.success) {
      const errors = result.error.issues.map(issue => ({
        field: issue.path.join('.'),
        code: mapZodErrorToCode(issue),
        message: issue.message,
      }));

      if (errors.length === 1) {
        return c.json(createValidationError(...), 400);
      }

      return c.json(createMultiFieldValidationError(errors), 400);
    }

    await next();
  };
}
```

## Frontend implementation

### API error parsing

Critical: API responses only return domain errors. Transport errors occur before/after the API call, not in responses.

```typescript
// packages/web/src/lib/errors/parse.ts
import { validateErrorResponse, createTransportError } from '@shared/errors';

// Parse API error response - only returns DomainError
export async function parseApiError(response: Response): Promise<DomainError> {
  try {
    const data = await response.json();
    return validateErrorResponse(data);
  } catch (_err) {
    // If response body can't be parsed, create unknown error
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Invalid error response format');
  }
}

// Handle fetch errors - separates transport from domain
export async function handleFetchError(fetchPromise: Promise<Response>, options = {}): Promise<Response> {
  try {
    const response = await fetchPromise;

    if (!response.ok) {
      // Parse domain error from API response
      const domainError = await parseApiError(response);
      await handleDomainError(domainError, options);
      throw domainError;
    }

    return response;
  } catch (error) {
    // If already a domain error, re-throw
    if (isDomainError(error)) {
      throw error;
    }

    // Otherwise, it's a transport error (network, fetch failure, etc.)
    const transportError = normalizeError(error);
    if (isTransportError(transportError)) {
      await handleTransportError(transportError, options);
      throw transportError;
    }

    // Fallback to unknown error
    const unknownError = createUnknownError('UNKNOWN_UNHANDLED_ERROR', 'An unexpected error occurred');
    throw unknownError;
  }
}
```

### Error handling patterns

Important: Transport errors are handled separately from domain errors. Domain errors come from API responses, transport errors occur during fetch/network operations.

#### 1. Form-level errors

Note: Frontend remains in JavaScript but imports from TypeScript-compiled shared package.

```javascript
// packages/web/src/lib/errors/form.js
import type { DomainError, ValidationErrorDetails } from '@shared/errors';

export function handleFormError(
  error,
  setFieldError,
  setGlobalError
) {
  // Handle validation errors with field details
  if (error.code.startsWith('VALIDATION_')) {
    const details = error.details;
    if (details?.field) {
      // Single field error
      setFieldError(details.field, error.message);
    } else if (details?.fields) {
      // Multi-field errors
      details.fields.forEach(({ field, message }) => {
        setFieldError(field, message);
      });
    } else {
      setGlobalError(error.message);
    }
  } else {
    // Other domain errors
    setGlobalError(error.message);
  }
}
```

#### 2. Global error handling

Note: Frontend remains in JavaScript but imports from TypeScript-compiled shared package. Separates domain errors (from API) from transport errors (network issues).

```javascript
// packages/web/src/lib/errors/handler.js
import type { DomainError, TransportError } from '@shared/errors';

export function handleGlobalError(error, options = {}) {
  // Transport errors (network issues) - handle differently
  if (error.code.startsWith('TRANSPORT_')) {
    if (options.showToast) {
      showToast.error('Connection Error', error.message);
    }
    if (options.onError) {
      options.onError(error);
    }
    return;
  }

  // Domain errors (from API) - handle navigation, etc.
  if (error.code === 'AUTH_REQUIRED' && options.navigate) {
    options.navigate('/signin');
    return;
  }

  if (error.code === 'AUTH_EXPIRED' && options.navigate) {
    options.navigate('/signin');
    return;
  }

  // Show toast for user-facing errors
  if (options.showToast) {
    showToast.error(error.message);
  }

  // Call custom handler
  if (options.onError) {
    options.onError(error);
  }
}
```

#### 3. Error boundaries

Note: Frontend remains in JavaScript but imports from TypeScript-compiled shared package.

```javascript
// packages/web/src/components/ErrorBoundary.jsx
import type { AppError } from '@shared/errors';

export function ErrorBoundary(props) {
  const [error, setError] = createSignal(null);

  onError((err) => {
    const appError = normalizeError(err);
    setError(appError);

    // Log unknown errors
    if (appError.code.startsWith('UNKNOWN_')) {
      logErrorToService(appError);
    }
  });

  return (
    <Show when={error()}>
      <ErrorDisplay error={error()} />
    </Show>
  );
}
```

### Type-safe error handling

Note: Frontend remains in JavaScript but imports from TypeScript-compiled shared package. Type definitions provide IDE support.

```javascript
// packages/web/src/lib/errors/utils.js
import type { DomainError, TransportError } from '@shared/errors';

// Error code checking (runtime, with type hints from .d.ts)
export function isErrorCode(error, code) {
  return error?.code === code;
}

// Check if error is domain error (from API)
export function isDomainError(error) {
  return error && typeof error.code === 'string' && !error.code.startsWith('TRANSPORT_');
}

// Check if error is transport error (network issue)
export function isTransportError(error) {
  return error && error.code?.startsWith('TRANSPORT_');
}

// Usage in components
if (isErrorCode(error, 'PROJECT_NOT_FOUND')) {
  navigate('/dashboard');
} else if (isErrorCode(error, 'VALIDATION_FIELD_REQUIRED')) {
  const details = error.details; // Typed as ValidationErrorDetails
  if (details?.field) {
    setFieldError(details.field, error.message);
  }
}
```

## Preventing untyped errors

### 1. Lint rules

```javascript
// .eslintrc.js
rules: {
  'no-throw-literal': 'error',  // Must throw Error objects
  'no-new-error-without-code': 'error',  // Custom rule
}
```

### 2. Helper functions (no raw errors)

```typescript
// All error creation goes through helpers
// Direct Error() or throw "string" is prevented
export function createError(code: ErrorCode, details?: any): AppError {
  // ...
}
```

### 3. Runtime validation

```typescript
// packages/shared/src/errors/validate.ts

// Validate API error response matches DomainError shape
export function validateErrorResponse(data: unknown): DomainError {
  if (!data || typeof data !== 'object') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Invalid error response');
  }

  const error = data as Record<string, unknown>;

  // Must have code and message
  if (typeof error.code !== 'string' || typeof error.message !== 'string') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Error response missing code or message');
  }

  // Domain errors must have statusCode
  if (typeof error.statusCode !== 'number') {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', 'Error response missing statusCode');
  }

  // Validate code is not transport/unknown (those shouldn't come from API)
  if (error.code.startsWith('TRANSPORT_') || error.code.startsWith('UNKNOWN_')) {
    return createUnknownError('UNKNOWN_INVALID_RESPONSE', `Invalid error code from API: ${error.code}`);
  }

  // Return validated domain error
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    statusCode: error.statusCode,
    timestamp: typeof error.timestamp === 'string' ? error.timestamp : new Date().toISOString(),
  };
}
```

## Unknown/programmer error handling

### Unknown error codes

```typescript
// packages/shared/src/errors/domains/unknown.ts
export const UNKNOWN_ERRORS = {
  PROGRAMMER_ERROR: {
    code: 'UNKNOWN_PROGRAMMER_ERROR',
    defaultMessage: 'An unexpected error occurred',
    statusCode: 500,
  },
  UNHANDLED_ERROR: {
    code: 'UNKNOWN_UNHANDLED_ERROR',
    defaultMessage: 'Something went wrong',
    statusCode: 500,
  },
  INVALID_RESPONSE: {
    code: 'UNKNOWN_INVALID_RESPONSE',
    defaultMessage: 'Invalid error response format',
    statusCode: 500,
  },
} as const;

export type UnknownErrorCode = (typeof UNKNOWN_ERRORS)[keyof typeof UNKNOWN_ERRORS]['code'];

// Helper to create unknown errors
export function createUnknownError(code: UnknownErrorCode, message: string, details?: SystemErrorDetails): DomainError {
  return {
    code,
    message,
    details,
    statusCode: UNKNOWN_ERRORS[code].statusCode,
    timestamp: new Date().toISOString(),
  };
}
```

### Error normalization

Tightened normalization - strict validation, no guessing, clear separation:

```typescript
// packages/shared/src/errors/normalize.ts

// Validate error shape matches AppError
function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    typeof (error as AppError).code === 'string' &&
    typeof (error as AppError).message === 'string'
  );
}

// Validate domain error (from API) - must have statusCode, not transport/unknown
export function isDomainError(error: unknown): error is DomainError {
  if (!isAppError(error)) return false;
  return (
    typeof error.statusCode === 'number' && !error.code.startsWith('TRANSPORT_') && !error.code.startsWith('UNKNOWN_')
  );
}

// Validate transport error
export function isTransportError(error: unknown): error is TransportError {
  return isAppError(error) && error.code.startsWith('TRANSPORT_');
}

// Normalize error - strict validation, no fallback guessing
// Only handles transport errors and unknown errors - domain errors come from parseApiError
export function normalizeError(error: unknown): TransportError | DomainError {
  // If already valid error, return as-is
  if (isDomainError(error)) {
    return error;
  }

  if (isTransportError(error)) {
    return error;
  }

  // If Error object from network/fetch, create transport error (strict matching)
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    // Network errors - strict patterns
    if (
      msg.includes('failed to fetch') ||
      msg.includes('networkerror') ||
      msg.includes('load failed') ||
      msg.includes('cors')
    ) {
      return createTransportError('TRANSPORT_NETWORK_ERROR', getErrorMessage('TRANSPORT_NETWORK_ERROR'), {
        originalError: error.message,
      });
    }

    // Timeout errors
    if (msg.includes('timeout') || msg.includes('timed out')) {
      return createTransportError('TRANSPORT_TIMEOUT', getErrorMessage('TRANSPORT_TIMEOUT'), {
        originalError: error.message,
      });
    }
  }

  // Response objects should never reach normalizeError - use parseApiError instead
  if (error instanceof Response) {
    console.error('Programmer error: Response object passed to normalizeError. Use parseApiError instead.');
    return createUnknownError('UNKNOWN_PROGRAMMER_ERROR', 'Response object passed to normalizeError');
  }

  // Unknown error - log and return safe error (no guessing)
  console.error('Unknown error normalized:', error);
  return createUnknownError('UNKNOWN_UNHANDLED_ERROR', 'An unexpected error occurred', {
    originalError: String(error),
  });
}
```
