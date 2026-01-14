# Billing and Org Routes Command Pattern Refactor

## Goals

- Maintainability: Extract business logic from route handlers
- Testability: Pure functions with clear dependencies
- TypeScript: Convert to TypeScript during refactor
- Centralized Authorization: Move policies to `/policies/` folder

## Current State Analysis

### Billing Routes

The billing routes are split across multiple sub-routes:

| File                               | Purpose                   | Business Logic Location  |
| ---------------------------------- | ------------------------- | ------------------------ |
| `subscription.js`                  | Read-only queries         | In route handlers        |
| `checkout.js`                      | Checkout session creation | In route handlers        |
| `webhooks.js`                      | Webhook processing        | Delegates to `handlers/` |
| `handlers/checkoutHandlers.js`     | Grant creation/extension  | Already extracted        |
| `handlers/subscriptionHandlers.js` | Subscription events       | Already extracted        |
| `handlers/invoiceHandlers.js`      | Invoice events            | Already extracted        |
| `webhookRouter.js`                 | Routes events to handlers | Already extracted        |
| `helpers/orgContext.js`            | Org resolution            | Helper utilities         |
| `helpers/ownerGate.js`             | Owner authorization       | Should move to policies  |

### Org Routes

The org routes delegate to Better Auth as a service boundary:

| Operation         | Current Pattern             | Notes                          |
| ----------------- | --------------------------- | ------------------------------ |
| CRUD ops          | Delegates to Better Auth    | Appropriate pattern            |
| Member management | Better Auth + custom policy | Uses `requireOrgMemberRemoval` |

### Existing Command Pattern

Commands follow this signature:

```javascript
export async function commandName(env, actor, params) {
  // 1. Validation
  // 2. Authorization (via policies)
  // 3. Database operations
  // 4. Side effects (fire-and-forget)
  return { resultData };
}
```

## Architecture Decision

### What to Move to Commands

1. **Billing Commands** (`commands/billing/`)
   - `createSingleProjectCheckout.ts` - Extract from `checkout.js`
   - `processCheckoutSession.ts` - Move from `handlers/checkoutHandlers.js`
   - Keep other webhook handlers in `handlers/` (they're processing external events, not user commands)

2. **Billing Policies** (`policies/billing.ts`)
   - `requireOrgOwner()` - Move from `helpers/ownerGate.js`
   - `canManageBilling()` - New policy for billing access
   - `requireBillingAccess()` - Assertion version

### What NOT to Move

1. **Better Auth Delegations** - Org CRUD operations that delegate to Better Auth should remain in routes. Better Auth is a service boundary.

2. **Read-only Queries** - Subscription status, usage queries are simple reads, not commands.

3. **Webhook Event Handlers** - The existing `handlers/` pattern works well for webhook processing. These are triggered by external events, not user actions.

## Implementation Plan

### Phase 1: Billing Policies

Create `policies/billing.ts` with owner/billing access policies.

### Phase 2: Single Project Checkout Command

Extract `createSingleProjectCheckout` from `checkout.js` to `commands/billing/`.

### Phase 3: Checkout Session Processing

Move `handleCheckoutSessionCompleted` from `handlers/checkoutHandlers.js` to `commands/billing/processCheckoutSession.ts`.

### Phase 4: Route Updates

Update `checkout.js` to use new commands.

### Phase 5: TypeScript Conversion

Convert all modified files to TypeScript.

## File Changes

### New Files

```
commands/billing/
  index.ts
  createSingleProjectCheckout.ts
  processCheckoutSession.ts

policies/
  billing.ts (new)
```

### Modified Files

```
routes/billing/checkout.js -> checkout.ts
routes/billing/handlers/checkoutHandlers.js (import from commands)
policies/index.js -> index.ts (add billing exports)
commands/index.js -> index.ts (add billing exports)
```

### Deleted Files

```
routes/billing/helpers/ownerGate.js (moved to policies)
```

## Command Signatures

### createSingleProjectCheckout

```typescript
interface CreateSingleProjectCheckoutParams {
  orgId: string;
}

interface CreateSingleProjectCheckoutResult {
  url: string;
  sessionId: string;
}

export async function createSingleProjectCheckout(
  env: Env,
  actor: { id: string; stripeCustomerId: string },
  params: CreateSingleProjectCheckoutParams,
): Promise<CreateSingleProjectCheckoutResult>;
```

### processCheckoutSession

```typescript
interface CheckoutSessionResult {
  handled: boolean;
  result: string;
  ledgerContext?: Record<string, unknown>;
  error?: string;
}

export async function processCheckoutSession(
  env: Env,
  session: Stripe.Checkout.Session,
  ctx: { db: Database; logger: Logger },
): Promise<CheckoutSessionResult>;
```

## Testing Strategy

- Unit tests for commands in isolation
- Integration tests for route -> command -> database flow
- Mock Stripe API for checkout session tests
