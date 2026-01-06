# Better Auth Stripe Client Plugin Migration Plan

## Overview

Migrate from custom billing API routes to Better Auth Stripe client plugin for subscription management operations. This will simplify code, improve integration with Better Auth sessions, and leverage built-in subscription state management.

## Current State

### Backend

- ✅ Better Auth Stripe plugin configured in `packages/workers/src/auth/config.js`
- ✅ Webhook handling at `/api/auth/stripe/webhook`
- ✅ Custom routes at `/api/billing/*` that wrap Better Auth plugin methods

### Frontend

- ❌ Not using Better Auth Stripe client plugin
- ✅ Custom API functions in `packages/web/src/api/billing.js`
- ✅ Components use `redirectToCheckout()` and `redirectToPortal()`
- ✅ Custom `useSubscription` hook for org-scoped billing resolution

## Migration Scope

### What to Migrate (Use Client Plugin)

1. **Subscription Checkout** (`redirectToCheckout`)
   - Current: `POST /api/billing/checkout` → Better Auth `upgradeSubscription`
   - New: `authClient.subscription.upgrade()`
   - Used in: `PricingTable.jsx`

2. **Billing Portal** (`redirectToPortal`)
   - Current: `POST /api/billing/portal` → Better Auth `createBillingPortal`
   - New: `authClient.subscription.billingPortal()`
   - Used in: `BillingPage.jsx`

3. **Subscription Listing** (optional, if needed)
   - New: `authClient.subscription.list()`
   - Currently not used, but available for future features

### What to Keep (Custom Routes)

These provide custom business logic beyond standard subscriptions:

1. **Subscription Status** (`GET /api/billing/subscription`)
   - Provides org-scoped billing resolution (grants, free plans, custom logic)
   - Used by `useSubscription` hook
   - **Keep as-is** - wraps Better Auth data with custom grants/trials

2. **Plan Validation** (`GET /api/billing/validate-plan-change`)
   - Custom validation for quota checks before downgrades
   - **Keep as-is** - business logic specific to our quota system

3. **Single Project Purchase** (`POST /api/billing/single-project/checkout`)
   - One-time purchases, not subscriptions
   - **Keep as-is** - outside Better Auth Stripe plugin scope

4. **Trial Grants** (`POST /api/billing/trial/start`)
   - Custom trial grant system (separate from Stripe trials)
   - **Keep as-is** - custom business logic

5. **Members** (`GET /api/billing/members`)
   - Org member listing
   - **Keep as-is** - uses Better Auth organization plugin

## Migration Steps

### Phase 1: Setup (No Breaking Changes)

1. **Install client plugin package**

   ```bash
   cd packages/web
   pnpm add @better-auth/stripe
   ```

2. **Add plugin to auth client**
   - Update `packages/web/src/api/auth-client.js`
   - Add `stripeClient({ subscription: true })` to plugins array
   - Export `subscription` from `authClient`

3. **Create migration helper functions**
   - Create `packages/web/src/api/billing-stripe.js`
   - Wrapper functions that use client plugin but maintain current API shape
   - Allows gradual migration

### Phase 2: Migrate Checkout Flow

1. **Update `redirectToCheckout` function**
   - Replace `createCheckoutSession` API call with `authClient.subscription.upgrade()`
   - Handle `referenceId` (orgId) from session
   - Maintain plan validation before checkout
   - Update error handling

2. **Update `redirectToPortal` function**
   - Replace `createPortalSession` API call with `authClient.subscription.billingPortal()`
   - Handle `referenceId` (orgId) from session
   - Update error handling

3. **Test checkout flow**
   - Test new subscription creation
   - Test plan upgrades
   - Test plan downgrades (with validation)
   - Test annual vs monthly billing
   - Verify org-scoped subscriptions work correctly

### Phase 3: Update Components

1. **Update `PricingTable.jsx`**
   - Ensure it works with new checkout flow
   - Test all plan change scenarios
   - Verify validation still works

2. **Update `BillingPage.jsx`**
   - Ensure billing portal redirect works
   - Test portal session creation

3. **Update any other components using billing functions**
   - Search codebase for `redirectToCheckout`, `redirectToPortal`
   - Update imports if needed

### Phase 4: Cleanup

1. **Remove deprecated backend routes** (optional)
   - Mark `/api/billing/checkout` and `/api/billing/portal` as deprecated
   - Keep for backwards compatibility initially
   - Remove after confirming no issues

2. **Update documentation**
   - Update API docs if needed
   - Update component docs

3. **Remove migration helper functions**
   - Once fully migrated, remove wrapper functions
   - Use client plugin directly

## Implementation Details

### Getting Org ID for Reference

The client plugin needs `referenceId` (orgId) for org-scoped subscriptions. We need to get this from the session:

```javascript
import { authClient } from '@/api/auth-client.js';
import { useBetterAuth } from '@/api/better-auth-store.js';

// In component or function
const { session } = useBetterAuth();
const orgId = () => session()?.activeOrganizationId;

// Use in subscription calls
await authClient.subscription.upgrade({
  plan: 'team',
  annual: false,
  referenceId: orgId(),
  successUrl: '/settings/billing?success=true',
  cancelUrl: '/settings/billing?canceled=true',
});
```

### Error Handling

Better Auth client plugin returns errors in a different format. Update error handling:

```javascript
const { data, error } = await authClient.subscription.upgrade({...});
if (error) {
  // Handle error - error.message, error.code, etc.
  throw new Error(error.message);
}
```

### Plan Validation Flow

Keep validation before checkout:

```javascript
// 1. Validate plan change
const validation = await validatePlanChange(plan.tier);
if (!validation.valid) {
  // Show validation errors
  return;
}

// 2. Proceed with checkout using client plugin
await authClient.subscription.upgrade({...});
```

## Testing Checklist

### Subscription Operations

- [ ] Create new subscription (free → paid)
- [ ] Upgrade subscription (starter → team)
- [ ] Downgrade subscription (team → starter) - with validation
- [ ] Switch to annual billing
- [ ] Switch to monthly billing
- [ ] Cancel subscription (via billing portal)
- [ ] Restore canceled subscription (if needed)

### Org Scoping

- [ ] Subscription created for correct org
- [ ] Org owner can manage subscription
- [ ] Non-owner cannot manage subscription
- [ ] Switching orgs shows correct subscription

### Error Cases

- [ ] Network errors during checkout
- [ ] Invalid plan name
- [ ] Validation failures (quota exceeded)
- [ ] Stripe API errors

### Edge Cases

- [ ] User with no active org
- [ ] User with multiple orgs
- [ ] Browser back button from Stripe
- [ ] Multiple rapid clicks (idempotency)

## Rollback Plan

If issues arise:

1. **Immediate rollback**: Revert to using custom API routes
2. **Keep both**: Run both implementations in parallel, switch via feature flag
3. **Partial rollback**: Keep client plugin for some operations, revert others

## Timeline Estimate

- **Phase 1 (Setup)**: 30 minutes
- **Phase 2 (Checkout Flow)**: 2-3 hours
- **Phase 3 (Components)**: 1-2 hours
- **Phase 4 (Cleanup)**: 1 hour
- **Testing**: 2-3 hours

**Total**: ~6-9 hours

## Success Criteria

- [ ] All subscription operations work via client plugin
- [ ] No regression in existing functionality
- [ ] Org-scoped subscriptions work correctly
- [ ] Plan validation still works
- [ ] Error handling is robust
- [ ] Code is simpler and more maintainable

## Notes

- Backend routes can be kept for backwards compatibility initially
- The `/api/billing/subscription` endpoint should remain as it provides custom org-scoped billing resolution
- Single project purchases and trial grants are outside Better Auth Stripe plugin scope
- Consider adding subscription listing functionality if needed for admin features
