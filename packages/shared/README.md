# @corates/shared

**Shared types and utilities for CoRATES** - TypeScript package providing centralized error definitions, plan configurations, and domain types used across frontend and backend.

## Purpose

This package provides shared contracts and utilities between `@corates/workers` (backend) and `@corates/web` (frontend):

- **Centralized error system** with type-safe domain errors
- **Billing plan configuration** with entitlements and quotas
- **Shared types** for projects, studies, checklists
- **Error normalization** for consistent error handling across transport layers

## Tech Stack

- **Language:** TypeScript 5.9+
- **Build Tool:** tsc (TypeScript compiler)
- **Testing:** Vitest 4.0+
- **Type Safety:** Strict mode enabled

## Key Exports

This package has three main export paths:

### Main Export (`@corates/shared`)

```typescript
import {
  // Error types
  createDomainError,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  VALIDATION_ERRORS,
  normalizeError,

  // Plan types
  PLANS,
  getPlan,
  isUnlimitedQuota,
  getBillingPlanCatalog,
} from '@corates/shared';
```

### Error-Only Export (`@corates/shared/errors`)

```typescript
import {
  createDomainError,
  createValidationError,
  createTransportError,
  AUTH_ERRORS,
  PROJECT_ERRORS,
  VALIDATION_ERRORS,
  type DomainError,
} from '@corates/shared/errors';
```

### Plans-Only Export (`@corates/shared/plans`)

```typescript
import { PLANS, getPlan, PLAN_PRICING, getBillingPlanCatalog, type Plan, type PlanId } from '@corates/shared/plans';
```

## File Structure

```
src/
├── index.ts                    # Main entry point (re-exports errors + plans)
├── errors/
│   ├── index.ts                # Error system public API
│   ├── types.ts                # TypeScript error types
│   ├── helpers.ts              # createDomainError, createValidationError
│   ├── normalize.ts            # Error normalization for API responses
│   ├── validate.ts             # Runtime validation for error responses
│   └── domains/
│       ├── domain.ts           # AUTH_ERRORS, PROJECT_ERRORS, etc.
│       ├── transport.ts        # TRANSPORT_ERRORS (network, timeout)
│       └── unknown.ts          # UNKNOWN_ERRORS (fallback)
└── plans/
    ├── index.ts                # Plans public API
    ├── types.ts                # Plan, Entitlements, Quotas types
    ├── plans.ts                # PLANS configuration (free, pro, unlimited)
    ├── pricing.ts              # PLAN_PRICING (monthly/yearly pricing)
    ├── catalog.ts              # getBillingPlanCatalog (UI catalog)
    └── stripe.ts               # Stripe product configuration
```

## Development

```bash
# Install dependencies
pnpm install

# Build TypeScript to dist/
pnpm build

# Build in watch mode
pnpm dev

# Type check (no emit)
pnpm typecheck

# Run tests
pnpm test

# Run tests in watch mode
pnpm test:watch

# Clean build artifacts
pnpm clean
```

## Usage Examples

### Creating Domain Errors (Backend)

```typescript
import { createDomainError, PROJECT_ERRORS } from '@corates/shared';

// In API route handler
if (!project) {
  const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, {
    projectId,
  });
  return c.json(error, error.statusCode); // 404
}
```

### Handling Errors (Frontend)

```typescript
import { normalizeError, isDomainError } from '@corates/shared';

try {
  const response = await fetch('/api/projects/123');
  if (!response.ok) {
    const errorData = await response.json();
    const error = normalizeError(errorData);

    if (isDomainError(error)) {
      // error has: code, message, details, statusCode
      toast.error(error.message);
    }
  }
} catch (err) {
  // Network error
  const error = normalizeError(err);
  toast.error(error.message);
}
```

### Checking Plan Entitlements (Backend)

```typescript
import { getPlan } from '@corates/shared/plans';

const plan = getPlan(org.planId); // e.g., 'team'

if (!plan.entitlements['project.create']) {
  return c.json({ error: 'Plan does not allow project creation' }, 403);
}

const maxProjects = plan.quotas['projects.max']; // e.g., 10
```

### Displaying Billing Plans (Frontend)

```typescript
import { getBillingPlanCatalog } from '@corates/shared/plans';

const catalog = getBillingPlanCatalog();
// Returns structured plan catalog with tiers, features, CTAs

catalog.forEach(plan => {
  console.log(plan.name, plan.monthlyPrice, plan.features);
});
```

## Error System

### Error Domains

The error system organizes errors by domain:

| Domain         | Examples                                  | Status Codes |
| -------------- | ----------------------------------------- | ------------ |
| **AUTH**       | AUTH_REQUIRED, AUTH_FORBIDDEN             | 401, 403     |
| **VALIDATION** | FIELD_REQUIRED, FIELD_INVALID_FORMAT      | 400          |
| **PROJECT**    | PROJECT_NOT_FOUND, PROJECT_QUOTA_EXCEEDED | 404, 403     |
| **FILE**       | FILE_NOT_FOUND, FILE_TOO_LARGE            | 404, 413     |
| **USER**       | USER_NOT_FOUND, EMAIL_ALREADY_EXISTS      | 404, 409     |
| **SYSTEM**     | INTERNAL_ERROR, RATE_LIMIT_EXCEEDED       | 500, 429     |
| **TRANSPORT**  | NETWORK_ERROR, TIMEOUT                    | -            |
| **UNKNOWN**    | UNKNOWN_ERROR                             | 500          |

### Error Structure

All errors follow this structure:

```typescript
interface DomainError {
  code: string; // e.g., 'PROJECT_NOT_FOUND'
  message: string; // Human-readable message
  statusCode: number; // HTTP status code (404, 400, 500, etc.)
  details?: {
    // Optional domain-specific details
    projectId?: string;
    field?: string;
    // ...
  };
}
```

### Helper Functions

```typescript
// Create domain error
createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId: '123' });

// Create validation error (single field)
createValidationError('email', 'Invalid email format');

// Create multi-field validation error
createMultiFieldValidationError([
  { field: 'email', message: 'Required' },
  { field: 'password', message: 'Too short' },
]);

// Normalize any error to standard format
normalizeError(error); // Returns DomainError | TransportError

// Type guards
isDomainError(error); // true if DomainError
isTransportError(error); // true if TransportError
```

## Plan System

### Plan Configuration

Plans are defined in [src/plans/plans.ts](src/plans/plans.ts):

```typescript
export const PLANS = {
  free: {
    name: 'Free',
    entitlements: {
      'project.create': false,
    },
    quotas: {
      'projects.max': 0,
      'collaborators.org.max': 0,
    },
  },
  starter_team: {
    /* ... */
  },
  team: {
    /* ... */
  },
  unlimited_team: {
    name: 'Unlimited Team',
    quotas: {
      'projects.max': -1, // -1 = unlimited
      'collaborators.org.max': -1,
    },
  },
};
```

### Pricing Configuration

Pricing is defined separately in [src/plans/pricing.ts](src/plans/pricing.ts):

```typescript
export const PLAN_PRICING = {
  starter_team: {
    monthly: { amount: 4900, currency: 'usd' }, // $49/month
    yearly: { amount: 49900, currency: 'usd' }, // $499/year
  },
  // ...
};
```

### Grant-Based Access

CoRATES supports time-limited grants (trial, single_project) that temporarily upgrade plan access:

```typescript
import { getGrantPlan } from '@corates/shared/plans';

// Get plan configuration based on grant type
const plan = getGrantPlan('single_project');
// Returns plan config with limited entitlements/quotas
```

## Testing

All functions have comprehensive unit tests:

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test helpers

# Watch mode
pnpm test:watch
```

Test coverage includes:

- Error creation and normalization ([errors/**tests**/](src/errors/__tests__/))
- Plan resolution and quota checks
- Type validation

## Important Patterns

### Always Use Centralized Error Definitions

❌ **Bad - Magic strings:**

```typescript
return c.json({ error: 'Project not found' }, 404);
```

✅ **Good - Type-safe domain errors:**

```typescript
const error = createDomainError(PROJECT_ERRORS.NOT_FOUND, { projectId });
return c.json(error, error.statusCode);
```

### Normalize Errors at Transport Boundaries

❌ **Bad - Passing raw errors:**

```typescript
catch (err) {
  toast.error(err.message); // err might be anything
}
```

✅ **Good - Normalize first:**

```typescript
catch (err) {
  const error = normalizeError(err);
  toast.error(error.message);
}
```

### Check Quotas with isUnlimitedQuota

❌ **Bad - Direct comparison:**

```typescript
if (currentCount >= plan.quotas['projects.max']) {
  // Fails for unlimited (-1) quota
}
```

✅ **Good - Handle unlimited:**

```typescript
import { isUnlimitedQuota } from '@corates/shared/plans';

const maxProjects = plan.quotas['projects.max'];
if (!isUnlimitedQuota(maxProjects) && currentCount >= maxProjects) {
  // Only enforce limit if not unlimited
}
```

## Links

- **Backend Package:** [packages/workers/](../workers/)
- **Frontend Package:** [packages/web/](../web/)
- **Documentation:** [packages/docs/](../docs/)
- **Error Handling Guide:** [.cursor/rules/error-handling.mdc](../../.cursor/rules/error-handling.mdc)
- **Billing Guide:** [packages/docs/guides/billing.md](../docs/guides/billing.md)

## TypeScript Configuration

This package uses strict TypeScript settings:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

All exports are fully typed with `.d.ts` declaration files generated at build time.
