# Stripe Integration Audit

**Date:** 2026-01-19
**Status:** Complete
**Scope:** Full review of Stripe usage across local dev and production

---

## Executive Summary

The CoRATES Stripe integration is well-architected with solid security patterns, comprehensive observability, and good separation of concerns. The two-phase webhook verification model and ledger-based audit trail are notable strengths. However, there are opportunities to improve the developer experience, consolidate duplicated code, and enhance maintainability.

**Overall Assessment:** 7.5/10 - Solid foundation with room for polish

---

## Current Architecture Overview

### Billing Model

- **Org-scoped subscriptions** via Better Auth Stripe plugin
- **Three subscription tiers:** starter_team ($8/mo), team ($29/mo), unlimited_team ($59/mo)
- **One-time purchase:** single_project ($39 for 6 months)
- **Grant system:** Trial (14 days) and single_project grants provide temporary access

### Key Components

1. **Better Auth Stripe Plugin** - Handles subscription lifecycle, customer creation, webhooks
2. **Custom Webhook Handler** - Two-phase verification for one-time purchases
3. **Billing Resolver** - Determines effective access (subscription > grant > free)
4. **Admin Tools** - Customer lookup, portal generation, invoice viewing

---

## Strengths (What's Working Well)

### 1. Two-Phase Webhook Verification

**Location:** `packages/workers/src/routes/billing/webhooks.ts`

The trust-minimal ledger pattern is excellent:

- Phase 1: Store hash + signature presence before verification
- Phase 2: Verify signature, then process and update ledger
- Deduplication by both payload hash and Stripe event ID
- Test events rejected in production

This provides strong security and observability.

### 2. Comprehensive Webhook Ledger

**Location:** `packages/workers/src/db/stripeEventLedger.ts`

The `stripeEventLedger` table captures:

- All webhook attempts (even failures)
- Processing status and errors
- Linking IDs (orgId, customerId, subscriptionId, checkoutSessionId)
- Full audit trail for debugging

### 3. Centralized Pricing Configuration

**Location:** `packages/shared/src/plans/`

Plan definitions are properly centralized:

- `pricing.ts` - Price amounts
- `plans.ts` - Entitlements and quotas
- `stripe.ts` - Stripe product/price mapping
- `catalog.ts` - UI display configuration

Changes only need to be made in one place.

### 4. Automatic Setup Script

**Location:** `packages/workers/scripts/setup-stripe-test.mjs`

The setup script automatically:

- Creates Stripe products and prices
- Updates `.env` file with price IDs
- Attempts to fetch webhook secrets from Stripe CLI
- Supports dry-run and force modes

This significantly reduces setup friction.

### 5. Plan Change Validation

**Location:** `packages/workers/src/lib/billingResolver.ts`

The `validatePlanChange` function prevents downgrades that would exceed quotas:

- Checks current project/collaborator usage
- Returns clear violation messages
- Frontend shows user-friendly dialog

---

## Areas for Improvement

### 1. Pricing Mismatch Between Docs and Code

**Issue:** The pricing model document and actual code have discrepancies.

| Plan                  | pricing-model.md | pricing.ts      |
| --------------------- | ---------------- | --------------- |
| Unlimited Team        | $49/mo, $490/yr  | $59/mo, $590/yr |
| Starter Team projects | 2-3              | 3               |

**Impact:** Confusion during planning and pricing decisions.

**Recommendation:**

- Sync `packages/docs/plans/pricing-model.md` with actual `pricing.ts` values
- Add a comment in pricing.ts referencing the pricing model doc
- Consider generating pricing-model.md from code

### 2. Duplicate Stripe Client Instantiation

**Issue:** `new Stripe()` is created in multiple locations:

- `packages/workers/src/auth/config.ts:213`
- `packages/workers/src/routes/billing/webhooks.ts:78`
- `packages/workers/src/routes/billing/checkout.ts:201`
- `packages/workers/src/routes/admin/stripe-tools.ts:420`
- Multiple other locations

**Impact:**

- Inconsistency risk if API version needs updating
- Repeated boilerplate code

**Recommendation:** Create a shared Stripe client factory:

```typescript
// packages/workers/src/lib/stripe.ts
export function createStripeClient(env: Env): Stripe {
  if (!env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY not configured');
  }
  return new Stripe(env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-12-15.clover',
  });
}
```

### 3. Two Separate Webhook Endpoints

**Issue:** There are two webhook endpoints with overlapping event types:

1. `/api/auth/stripe/webhook` - Better Auth plugin (subscription lifecycle)
2. `/api/billing/purchases/webhook` - Custom (one-time purchases)

Both handle some of the same events (customer, subscription updates).

**Impact:**

- Requires creating two webhooks in Stripe Dashboard
- Two webhook secrets to manage
- Potential duplicate processing of some events
- More complex debugging

**Recommendation:**

- Document clearly which events each endpoint handles
- Consider consolidating to single endpoint with routing logic
- At minimum, ensure no event overlap in Stripe Dashboard configuration

### 4. Missing Webhook Event Handlers

**Issue:** Some handlers just log without action:

- `customerHandlers.ts` - `customer.updated` and `customer.deleted` only log
- `paymentIntentHandlers.ts` - Most handlers only log
- `invoiceHandlers.ts` - Some handlers only log

**Impact:** Potential missed business logic (e.g., updating local customer data).

**Recommendation:**

- Either implement proper handling or explicitly document why no action needed
- Consider adding TODO comments for future implementation
- Remove empty handlers if they're not needed

### 5. Environment Variable Sprawl

**Issue:** 11+ Stripe-related environment variables:

```
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET_AUTH
STRIPE_WEBHOOK_SECRET_PURCHASES
STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY
STRIPE_PRICE_ID_STARTER_TEAM_YEARLY
STRIPE_PRICE_ID_TEAM_MONTHLY
STRIPE_PRICE_ID_TEAM_YEARLY
STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY
STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY
STRIPE_PRICE_ID_SINGLE_PROJECT
```

**Impact:** Easy to misconfigure, tedious to set up in production.

**Recommendation:**
Consider using Stripe Product metadata instead of environment variables for price IDs:

- Store plan ID in product metadata: `{ "corates_plan": "starter_team" }`
- Look up products at runtime by metadata
- Only need `STRIPE_SECRET_KEY` and webhook secrets

Alternative: Create a validation script that checks all required env vars are set.

### 6. No Stripe Customer Portal Configuration

**Issue:** No mention of configuring the Stripe Customer Portal in the dashboard.

The portal allows customers to:

- Update payment methods
- View invoices
- Cancel subscriptions
- Change plans

**Recommendation:** Add to `stripe-setup.md`:

- Customer Portal configuration steps
- Which actions to enable/disable
- Branding settings

### 7. Missing Proration Handling Documentation

**Issue:** No documentation on how plan upgrades/downgrades handle proration.

Better Auth Stripe plugin likely uses Stripe's default proration, but this should be explicit.

**Recommendation:**

- Document proration behavior in `stripe-setup.md`
- Verify Better Auth plugin settings for proration
- Consider showing proration preview on frontend before checkout

### 8. No Failed Payment Recovery Flow

**Issue:** While `PaymentIssueBanner.jsx` exists, there's no documented recovery flow.

**Recommendation:**

- Document what happens when payment fails
- Implement email notifications for failed payments
- Add retry UI in the billing settings
- Consider Stripe's dunning management features

### 9. Test Coverage Gaps

**Issue:** Limited test coverage for edge cases:

- Grant extension when grant already expired
- Concurrent webhook deliveries
- Price ID mismatch scenarios
- Customer deletion handling

**Recommendation:** Add tests for:

- `processCheckoutSession` with various edge cases
- Webhook deduplication behavior
- Billing resolver with expired grants

### 10. No Stripe Metrics/Monitoring

**Issue:** While webhook ledger provides observability, there's no business metrics tracking.

**Recommendation:** Consider tracking:

- Monthly Recurring Revenue (MRR)
- Churn rate
- Conversion rate (trial to paid)
- Average Revenue Per User (ARPU)

Can use Stripe's built-in analytics or implement custom tracking.

---

## Local Development vs Production

### Current Setup

| Aspect          | Local Dev                | Production                       |
| --------------- | ------------------------ | -------------------------------- |
| API Keys        | `sk_test_*` in `.env`    | `sk_live_*` via wrangler secrets |
| Webhook Secrets | Stripe CLI `whsec_*`     | Dashboard-generated `whsec_*`    |
| Products/Prices | Created via setup script | Manually created in Dashboard    |
| Test Mode       | Allowed                  | Rejected (livemode check)        |
| Ledger          | Local D1                 | Production D1                    |

### Good Practices in Place

1. Test events rejected in production (livemode check)
2. Separate webhook secrets for each endpoint
3. Setup script for local environment
4. Environment-based configuration

### Improvements Needed

**1. Production Price ID Setup**

Current flow requires manual Dashboard creation and `wrangler secret put` for each price.

**Recommendation:** Create a production setup checklist:

```markdown
## Production Stripe Setup Checklist

1. [ ] Create products in Stripe Dashboard (live mode)
2. [ ] Copy price IDs
3. [ ] Run: wrangler secret put STRIPE*PRICE_ID*\* --env production (for each)
4. [ ] Create webhooks in Dashboard
5. [ ] Configure Customer Portal
6. [ ] Test with Stripe test cards
```

**2. Missing CI/CD Integration**

No mention of Stripe testing in CI.

**Recommendation:**

- Use Stripe test mode keys in CI
- Add integration tests that hit Stripe API
- Use Stripe CLI for webhook testing in CI

**3. No Staging Environment**

Production is the only deployment target.

**Recommendation:** Consider:

- Staging environment with test mode Stripe
- Preview deployments with isolated Stripe configuration
- Environment-specific webhook endpoints

---

## Security Assessment

### Strengths

1. Webhook signature verification before processing
2. No sensitive data in logs (linking IDs only)
3. Rate limiting on checkout/portal endpoints
4. Owner-only access for billing operations
5. Idempotency via unique constraints

### Concerns

**1. Webhook Secret in Auth Config**

The webhook secret is passed to Better Auth plugin. Ensure it's not logged or exposed.

**2. No IP Allowlisting**

Webhooks are open to any source. While signature verification protects against tampering, IP allowlisting adds defense in depth.

**Recommendation:** Consider Cloudflare WAF rules to restrict webhook endpoints to Stripe IPs.

**3. Customer ID Exposure**

Stripe customer IDs appear in admin API responses. While internal, ensure admin routes are properly protected.

---

## Code Quality Observations

### Well Done

- Consistent use of domain errors
- OpenAPI schema for billing routes
- Zod validation on request bodies
- Comprehensive TypeScript types

### Could Improve

- Some `@ts-expect-error` comments for OpenAPIHono return types
- Inconsistent logging (some use `logger.stripe`, some use `logger.info`)
- Mixed use of `.js` and `.ts` extensions in imports

---

## Recommendations Priority Matrix

| Priority | Recommendation                    | Effort | Impact |
| -------- | --------------------------------- | ------ | ------ |
| High     | Sync pricing docs with code       | Low    | High   |
| High     | Create Stripe client factory      | Low    | Medium |
| Medium   | Document webhook event routing    | Low    | High   |
| Medium   | Add production setup checklist    | Low    | High   |
| Medium   | Implement failed payment recovery | Medium | High   |
| Low      | Consider single webhook endpoint  | High   | Medium |
| Low      | Add Stripe business metrics       | Medium | Medium |
| Low      | Reduce environment variables      | Medium | Low    |

---

## Action Items

### Immediate (This Week)

1. Update `pricing-model.md` to match actual `pricing.ts` values
2. Create shared Stripe client factory module
3. Add Customer Portal configuration to `stripe-setup.md`

### Short-term (This Month)

4. Document webhook event routing between two endpoints
5. Implement proper customer.updated/deleted handlers
6. Add production setup checklist

### Medium-term (This Quarter)

7. Evaluate consolidating webhook endpoints
8. Add integration tests for billing flows
9. Implement failed payment recovery flow

---

## Appendix: File Reference

| Component                   | Location                                               |
| --------------------------- | ------------------------------------------------------ |
| Pricing config              | `packages/shared/src/plans/pricing.ts`                 |
| Plan definitions            | `packages/shared/src/plans/plans.ts`                   |
| Stripe product mapping      | `packages/shared/src/plans/stripe.ts`                  |
| Auth config (Stripe plugin) | `packages/workers/src/auth/config.ts`                  |
| Webhook handler             | `packages/workers/src/routes/billing/webhooks.ts`      |
| Checkout routes             | `packages/workers/src/routes/billing/checkout.ts`      |
| Billing resolver            | `packages/workers/src/lib/billingResolver.ts`          |
| Admin Stripe tools          | `packages/workers/src/routes/admin/stripe-tools.ts`    |
| Setup script                | `packages/workers/scripts/setup-stripe-test.mjs`       |
| Setup guide                 | `packages/docs/guides/stripe-setup.md`                 |
| Frontend billing API        | `packages/web/src/api/billing.js`                      |
| Pricing table component     | `packages/web/src/components/billing/PricingTable.jsx` |
