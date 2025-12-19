# @corates/shared

Shared error definitions and utilities for CoRATES.

This package provides:
- Type-safe error code definitions
- Error creation helpers
- Error normalization and validation utilities
- TypeScript types with JavaScript runtime support

## Structure

- **TypeScript source**: `src/errors/`
- **Compiled output**: `dist/` (JavaScript + `.d.ts` files)
- **Public API**: Import from `@corates/shared` or `@corates/shared/errors`

## Usage

### Backend (JavaScript)

```javascript
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

// Create a domain error
const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: '123' });
return c.json(error, error.statusCode);
```

### Frontend (JavaScript)

```javascript
import { normalizeError, isDomainError, isTransportError } from '@corates/shared';

try {
  const response = await fetch('/api/projects');
  // ...
} catch (error) {
  const normalized = normalizeError(error);

  if (isTransportError(normalized)) {
    // Handle network errors
  } else if (isDomainError(normalized)) {
    // Handle API errors
  }
}
```

## Error Types

- **Domain Errors**: Business logic errors from backend API (have `statusCode`)
- **Transport Errors**: Network/connection errors (frontend only, no `statusCode`)
- **Unknown Errors**: Fallback for unhandled errors

## Building

```bash
pnpm build
```

This compiles TypeScript to JavaScript and generates `.d.ts` type definition files.
