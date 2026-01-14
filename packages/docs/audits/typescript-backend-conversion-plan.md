# TypeScript Backend Conversion Plan

Plan to convert the `@corates/workers` package from JavaScript to TypeScript.

## Current State Analysis

### Scope

- **Total files**: 155 JavaScript files
- **Source files**: ~80 implementation files
- **Test files**: ~75 test files
- **Entry point**: `src/index.js`
- **Build tool**: Wrangler (Cloudflare Workers)

### Directory Structure

```
packages/workers/src/
  index.js              # Main entry, exports Durable Objects
  docs.js               # OpenAPI documentation generator
  auth/                 # Authentication (6 files)
  config/               # Constants, validation, origins (3 files)
  db/                   # Drizzle schema and client (4 files)
  durable-objects/      # UserSession, ProjectDoc, EmailQueue (4 files)
  lib/                  # Utilities (12 files)
  middleware/           # Hono middleware (11 files)
  routes/               # API routes (15+ files)
  schemas/              # Zod schemas (1 file)
  commands/             # CLI commands
  __tests__/            # Test files and helpers
```

### Existing TypeScript Assets

- `drizzle.config.ts` - Drizzle configuration
- `worker-configuration.d.ts` - Generated Cloudflare types (12k+ lines)
- `jsconfig.json` - Path aliases (`@/*` -> `src/*`)

### Dependencies Already Type-Safe

- `@hono/zod-openapi` - TypeScript-first
- `drizzle-orm` - Full TypeScript support
- `better-auth` - TypeScript
- `zod` - TypeScript-first validation
- `@corates/shared` - Already TypeScript
- `@cloudflare/workers-types` - Cloudflare type definitions

---

## Conversion Strategy

### Approach: Incremental Migration

Convert files incrementally while maintaining a working codebase. Use TypeScript's `allowJs: true` during transition to allow mixed JS/TS.

### Guiding Principles

1. **Keep the codebase working** - All tests must pass after each phase
2. **Convert leaf nodes first** - Start with files that have no internal dependencies
3. **Maximize type inference** - Let TypeScript infer types where possible
4. **Add explicit types where valuable** - Focus on public APIs and function signatures
5. **Preserve runtime behavior** - No functional changes during conversion

---

## Phase 1: Infrastructure Setup

**Duration**: 1 day  
**Risk**: Low

### Tasks

1. **Create `tsconfig.json`**

   ```jsonc
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "ES2022",
       "lib": ["ES2022"],
       "moduleResolution": "bundler",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true,
       "forceConsistentCasingInFileNames": true,
       "resolveJsonModule": true,
       "declaration": false,
       "noEmit": true,
       "allowJs": true,
       "checkJs": false,
       "types": ["@cloudflare/workers-types", "vitest/globals"],
       "paths": {
         "@/*": ["./src/*"],
       },
       "baseUrl": ".",
     },
     "include": ["src/**/*"],
     "exclude": ["node_modules", "migrations", ".wrangler"],
   }
   ```

2. **Update `package.json`**
   - Add `typescript` dev dependency
   - Add `typecheck` script: `tsc --noEmit`
   - Keep `main` as `src/index.js` (Wrangler handles compilation)

3. **Update `wrangler.jsonc`**
   - Change `main` from `src/index.js` to `src/index.ts` (after Phase 2)

4. **Update `vitest.config.js` -> `vitest.config.ts`**
   - Update test include pattern: `['src/**/*.{test,spec}.{js,ts}']`

5. **Update `drizzle.config.ts`**
   - Change schema path from `.js` to `.ts` (after db files converted)

6. **Delete `jsconfig.json`** (superseded by tsconfig.json)

### Verification

- [ ] `pnpm typecheck` runs without errors (with `checkJs: false`)
- [ ] `pnpm test` passes
- [ ] `pnpm dev` starts successfully

---

## Phase 2: Core Infrastructure

**Duration**: 2 days  
**Risk**: Medium

Convert foundational files that other modules depend on.

### Conversion Order

1. **Database Layer** (`src/db/`)
   - `schema.js` -> `schema.ts`
   - `client.js` -> `client.ts`
   - `orgAccessGrants.js` -> `orgAccessGrants.ts`
   - `stripeEventLedger.js` -> `stripeEventLedger.ts`

2. **Configuration** (`src/config/`)
   - `constants.js` -> `constants.ts`
   - `origins.js` -> `origins.ts`
   - `validation.js` -> `validation.ts`

3. **Schemas** (`src/schemas/`)
   - `common.js` -> `common.ts`

### Type Definitions to Add

```typescript
// src/types/env.ts - Re-export from generated types
export type { Env } from '../../worker-configuration';

// src/types/context.ts - Hono context with auth
import type { Context } from 'hono';
import type { Env } from './env';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role?: string;
  // ... other fields
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  // ... other fields
}

export interface AppVariables {
  user: AuthUser | null;
  session: AuthSession | null;
}

export type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;
```

### Verification

- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Drizzle migrations still generate correctly

---

## Phase 3: Middleware Layer

**Duration**: 2 days  
**Risk**: Medium

Convert all middleware with proper Hono typing.

### Conversion Order

1. `errorHandler.js` -> `errorHandler.ts`
2. `cors.js` -> `cors.ts`
3. `securityHeaders.js` -> `securityHeaders.ts`
4. `auth.js` -> `auth.ts`
5. `csrf.js` -> `csrf.ts`
6. `rateLimit.js` -> `rateLimit.ts`
7. `requireAuth.js` (if separate)
8. `requireOrg.js` -> `requireOrg.ts`
9. `requireOrgWriteAccess.js` -> `requireOrgWriteAccess.ts`
10. `requireAdmin.js` -> `requireAdmin.ts`
11. `requireEntitlement.js` -> `requireEntitlement.ts`
12. `requireQuota.js` -> `requireQuota.ts`
13. `subscription.js` -> `subscription.ts`

### Type Pattern for Middleware

```typescript
import type { MiddlewareHandler } from 'hono';
import type { Env } from '../types/env';
import type { AppVariables } from '../types/context';

export const requireAuth: MiddlewareHandler<{
  Bindings: Env;
  Variables: AppVariables;
}> = async (c, next) => {
  // implementation
};
```

### Verification

- [ ] All middleware tests pass
- [ ] `pnpm typecheck` passes

---

## Phase 4: Library Utilities

**Duration**: 2 days  
**Risk**: Low

Convert utility functions and helpers.

### Conversion Order

1. `lib/escapeHtml.js` -> `lib/escapeHtml.ts`
2. `lib/ssrf-protection.js` -> `lib/ssrf-protection.ts`
3. `lib/project-doc-id.js` -> `lib/project-doc-id.ts`
4. `lib/project-sync.js` -> `lib/project-sync.ts`
5. `lib/access.js` -> `lib/access.ts`
6. `lib/entitlements.js` -> `lib/entitlements.ts`
7. `lib/quotaTransaction.js` -> `lib/quotaTransaction.ts`
8. `lib/billingResolver.js` -> `lib/billingResolver.ts`
9. `lib/notify.js` -> `lib/notify.ts`
10. `lib/observability/*` -> `lib/observability/*.ts`
11. `lib/dev-seed/*` -> `lib/dev-seed/*.ts`
12. `lib/mock-templates.js` -> `lib/mock-templates.ts`

### Verification

- [ ] All lib tests pass
- [ ] `pnpm typecheck` passes

---

## Phase 5: Authentication

**Duration**: 1 day  
**Risk**: Medium (auth is critical)

### Conversion Order

1. `auth/emailTemplates.js` -> `auth/emailTemplates.ts`
2. `auth/templates.js` -> `auth/templates.ts`
3. `auth/email.js` -> `auth/email.ts`
4. `auth/config.js` -> `auth/config.ts`
5. `auth/admin.js` -> `auth/admin.ts`
6. `auth/routes.js` -> `auth/routes.ts`

### Type Considerations

```typescript
// Better Auth types
import type { Auth } from 'better-auth';
import type { BetterAuthOptions } from 'better-auth/types';

export function createAuth(env: Env): Auth {
  // implementation
}
```

### Verification

- [ ] Auth tests pass
- [ ] Manual login/logout testing
- [ ] OAuth flows work

---

## Phase 6: Durable Objects

**Duration**: 2 days  
**Risk**: High (complex async state)

### Conversion Order

1. `durable-objects/EmailQueue.js` -> `durable-objects/EmailQueue.ts`
2. `durable-objects/UserSession.js` -> `durable-objects/UserSession.ts`
3. `durable-objects/ProjectDoc.js` -> `durable-objects/ProjectDoc.ts`
4. `durable-objects/dev-handlers.js` -> `durable-objects/dev-handlers.ts`

### Type Pattern for Durable Objects

```typescript
import { DurableObject } from 'cloudflare:workers';
import type { Env } from '../types/env';

export class UserSession extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
  }

  async fetch(request: Request): Promise<Response> {
    // implementation
  }
}
```

### Verification

- [ ] Durable Object tests pass
- [ ] WebSocket connections work
- [ ] Yjs sync works

---

## Phase 7: API Routes

**Duration**: 3-4 days  
**Risk**: Medium

Largest phase - convert all route handlers.

### Conversion Order (by complexity, ascending)

**Simple routes (no complex dependencies)**

1. `routes/health.js` -> `routes/health.ts`
2. `routes/contact.js` -> `routes/contact.ts`
3. `routes/avatars.js` -> `routes/avatars.ts`
4. `routes/database.js` -> `routes/database.ts`

**Medium complexity** 5. `routes/email.js` -> `routes/email.ts` 6. `routes/users.js` -> `routes/users.ts` 7. `routes/invitations.js` -> `routes/invitations.ts` 8. `routes/members.js` -> `routes/members.ts` 9. `routes/google-drive.js` -> `routes/google-drive.ts` 10. `routes/account-merge.js` -> `routes/account-merge.ts`

**Complex routes** 11. `routes/projects.js` -> `routes/projects.ts` 12. `routes/orgs/index.js` -> `routes/orgs/index.ts` 13. `routes/orgs/*.js` -> `routes/orgs/*.ts` 14. `routes/billing/index.js` -> `routes/billing/index.ts` 15. `routes/billing/*.js` -> `routes/billing/*.ts` 16. `routes/admin/index.js` -> `routes/admin/index.ts` 17. `routes/admin/*.js` -> `routes/admin/*.ts`

### Type Pattern for Routes

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import type { Env } from '../types/env';
import type { AppVariables } from '../types/context';

const routes = new OpenAPIHono<{
  Bindings: Env;
  Variables: AppVariables;
}>();

// Route with typed request/response
const getProjectRoute = createRoute({
  method: 'get',
  path: '/:projectId',
  request: {
    params: z.object({
      projectId: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: ProjectSchema,
        },
      },
      description: 'Project details',
    },
  },
});

routes.openapi(getProjectRoute, async c => {
  const { projectId } = c.req.valid('param');
  // implementation - fully typed!
});
```

### Verification

- [ ] All route tests pass
- [ ] API responses match expected schemas
- [ ] `pnpm typecheck` passes

---

## Phase 8: Entry Point and Final Cleanup

**Duration**: 1 day  
**Risk**: Low

### Tasks

1. **Convert entry point**
   - `src/index.js` -> `src/index.ts`
   - `src/docs.js` -> `src/docs.ts`

2. **Update Wrangler config**

   ```jsonc
   {
     "main": "src/index.ts",
   }
   ```

3. **Remove `allowJs` from tsconfig**

   ```jsonc
   {
     "compilerOptions": {
       "allowJs": false,
       "checkJs": false,
     },
   }
   ```

4. **Enable strict checks** (if not already)
   - `noUnusedLocals: true`
   - `noUnusedParameters: true`
   - `noImplicitReturns: true`

### Verification

- [ ] `pnpm typecheck` passes with strict mode
- [ ] All tests pass
- [ ] Dev server starts
- [ ] Production deployment works

---

## Phase 9: Test Files

**Duration**: 2-3 days  
**Risk**: Low

Convert test files last since they depend on implementation files.

### Conversion Order

1. `__tests__/helpers.js` -> `__tests__/helpers.ts`
2. `__tests__/factories/*.js` -> `__tests__/factories/*.ts`
3. `__tests__/setup.js` -> `__tests__/setup.ts`
4. Individual test files (can be done incrementally)

### Test Type Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { MockInstance } from 'vitest';

describe('Feature', () => {
  let mockFn: MockInstance;

  beforeEach(() => {
    mockFn = vi.fn();
  });

  it('should work', async () => {
    // implementation
  });
});
```

### Verification

- [ ] `pnpm test` passes
- [ ] Test coverage unchanged

---

## Estimated Timeline

| Phase                  | Duration | Cumulative |
| ---------------------- | -------- | ---------- |
| 1. Infrastructure      | 1 day    | 1 day      |
| 2. Core Infrastructure | 2 days   | 3 days     |
| 3. Middleware          | 2 days   | 5 days     |
| 4. Library Utilities   | 2 days   | 7 days     |
| 5. Authentication      | 1 day    | 8 days     |
| 6. Durable Objects     | 2 days   | 10 days    |
| 7. API Routes          | 4 days   | 14 days    |
| 8. Entry Point         | 1 day    | 15 days    |
| 9. Test Files          | 3 days   | 18 days    |

**Total estimated time**: 15-18 working days (~3-4 weeks)

---

## Risk Mitigation

### High-Risk Areas

1. **Durable Objects** - Complex async state, WebSocket handling
   - Mitigation: Extensive manual testing, keep JS fallback ready

2. **Authentication** - Critical path, OAuth complexity
   - Mitigation: Test auth flows thoroughly before/after

3. **Yjs Integration** - Real-time sync with external library
   - Mitigation: Test WebSocket connections and sync

### Rollback Strategy

- Each phase should be a separate PR
- Keep the main branch stable
- Feature flag TypeScript entry point if needed

### Testing Strategy

- Run full test suite after each file conversion
- Manual smoke testing after each phase
- Test in staging before production deployment

---

## Success Criteria

1. [ ] All 155 files converted to TypeScript
2. [ ] `pnpm typecheck` passes with strict mode
3. [ ] All tests pass (same coverage)
4. [ ] No runtime behavior changes
5. [ ] Dev server works
6. [ ] Production deployment successful
7. [ ] No increase in bundle size (minimal)

---

## Post-Conversion Improvements

After conversion is complete, consider:

1. **Add return type annotations** to all exported functions
2. **Create barrel exports** (`index.ts`) for each directory
3. **Add JSDoc** for public APIs
4. **Enable `strictNullChecks`** fully
5. **Add path aliases** for common imports
6. **Consider `zod` inference** for request/response types
7. **Add API client generation** from OpenAPI spec

---

## Notes

- Wrangler handles TypeScript compilation natively - no separate build step needed
- Vitest supports TypeScript out of the box
- Drizzle schema types are automatically inferred
- Better Auth provides full TypeScript support
- The `worker-configuration.d.ts` file provides all Cloudflare bindings types
