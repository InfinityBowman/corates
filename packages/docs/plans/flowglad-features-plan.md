# Flowglad Features Implementation Plan

**Date:** 2026-01-08
**Based on:** flowglad-comparison-audit-2026-01.md, flowglad-ui-checkout-audit-2026-01.md
**Goal:** Bring Flowglad's best features to CoRATES billing and checkout

---

## Priority Summary

| Feature                   | Impact | Effort | Priority |
| ------------------------- | ------ | ------ | -------- |
| Discount/Promo Codes      | High   | Low    | P1       |
| Usage Metrics Display     | High   | Low    | P1       |
| Better Error Messages     | Medium | Low    | P1       |
| Integration Billing Tests | High   | Medium | P2       |
| Flexible Pricing Config   | Medium | Medium | P2       |
| Address/Tax Collection    | Medium | Low    | P3       |
| Embedded Stripe Elements  | Low    | High   | P4       |

---

## Phase 1: Quick Wins (1-2 weeks)

### 1.1 Discount/Promo Code Support

**Backend: Add coupon validation endpoint**

Location: `packages/workers/src/routes/billing/checkout.js`

```javascript
// POST /api/billing/validate-coupon
billingCheckoutRoutes.post('/validate-coupon', requireAuth, async c => {
  const { code } = await c.req.json();
  const stripe = new Stripe(c.env.STRIPE_SECRET_KEY);

  try {
    // Try promotion code first (user-facing codes)
    const promoCodes = await stripe.promotionCodes.list({
      code,
      active: true,
      limit: 1,
    });

    if (promoCodes.data.length > 0) {
      const promo = promoCodes.data[0];
      const coupon = promo.coupon;
      return c.json({
        valid: true,
        promoCodeId: promo.id,
        code: promo.code,
        percentOff: coupon.percent_off,
        amountOff: coupon.amount_off,
        currency: coupon.currency,
        duration: coupon.duration,
        durationMonths: coupon.duration_in_months,
        expiresAt: promo.expires_at,
      });
    }

    return c.json({ valid: false, error: 'Invalid or expired code' });
  } catch (error) {
    return c.json({ valid: false, error: 'Code not found' });
  }
});
```

**Backend: Pass promo code to checkout session**

```javascript
// Modify POST /checkout to accept promoCodeId
const { tier, interval, promoCodeId } = body;

// In Better Auth upgradeSubscription call:
body: {
  plan: tier,
  annual: interval === 'yearly',
  referenceId: orgId,
  discounts: promoCodeId ? [{ promotion_code: promoCodeId }] : undefined,
  // ...rest
}
```

**Frontend: Add promo code input to PricingTable**

Location: `packages/web/src/components/billing/PricingTable.jsx`

```jsx
const [promoCode, setPromoCode] = createSignal('');
const [promoValidation, setPromoValidation] = createSignal(null);
const [validatingPromo, setValidatingPromo] = createSignal(false);

const validatePromoCode = async () => {
  if (!promoCode().trim()) return;
  setValidatingPromo(true);
  try {
    const result = await apiFetch.post('/api/billing/validate-coupon', {
      code: promoCode().trim(),
    });
    setPromoValidation(result);
  } catch {
    setPromoValidation({ valid: false, error: 'Failed to validate' });
  } finally {
    setValidatingPromo(false);
  }
};

// In JSX, add above plans grid:
<div class='mb-6 flex items-center gap-2'>
  <input
    type='text'
    placeholder='Promo code'
    value={promoCode()}
    onInput={e => setPromoCode(e.target.value)}
    class='rounded-lg border px-3 py-2 text-sm'
  />
  <button onClick={validatePromoCode} disabled={validatingPromo()}>
    Apply
  </button>
  <Show when={promoValidation()?.valid}>
    <span class='text-sm text-green-600'>{promoValidation().percentOff}% off applied</span>
  </Show>
</div>;
```

**Tasks:**

- [ ] Add `POST /api/billing/validate-coupon` endpoint
- [ ] Add `promoCodeId` param to checkout session creation
- [ ] Add promo code input UI to PricingTable
- [ ] Show discount in price display
- [ ] Test with Stripe test promo codes

---

### 1.2 Usage Metrics Display

**Frontend: Add UsageCard component**

Location: `packages/web/src/components/billing/UsageCard.jsx`

```jsx
export default function UsageCard(props) {
  const percentage = () => Math.min(100, (props.used / props.limit) * 100);
  const isNearLimit = () => percentage() >= 80;

  return (
    <div class='rounded-lg border p-4'>
      <div class='mb-2 flex justify-between text-sm'>
        <span class='text-gray-600'>{props.label}</span>
        <span class={isNearLimit() ? 'font-medium text-amber-600' : 'text-gray-900'}>
          {props.used} / {props.limit === -1 ? 'Unlimited' : props.limit}
        </span>
      </div>
      <Show when={props.limit !== -1}>
        <div class='h-2 overflow-hidden rounded-full bg-gray-100'>
          <div
            class={`h-full transition-all ${isNearLimit() ? 'bg-amber-500' : 'bg-blue-500'}`}
            style={{ width: `${percentage()}%` }}
          />
        </div>
      </Show>
    </div>
  );
}
```

**Backend: Add usage endpoint**

Location: `packages/workers/src/routes/billing/subscription.js`

```javascript
// GET /api/billing/usage
billingSubscriptionRoutes.get('/usage', requireAuth, async c => {
  const { user, session } = getAuth(c);
  const db = createDb(c.env.DB);

  const { orgId } = await resolveOrgIdWithRole({ db, session, userId: user.id });

  // Count projects
  const projectCount = await db
    .select({ count: sql`count(*)` })
    .from(projects)
    .where(eq(projects.orgId, orgId))
    .then(r => r[0]?.count ?? 0);

  // Count collaborators (unique users across all projects)
  const collaboratorCount = await db
    .select({ count: sql`count(distinct ${projectMembers.userId})` })
    .from(projectMembers)
    .innerJoin(projects, eq(projectMembers.projectId, projects.id))
    .where(eq(projects.orgId, orgId))
    .then(r => r[0]?.count ?? 0);

  return c.json({
    projects: Number(projectCount),
    collaborators: Number(collaboratorCount),
  });
});
```

**Frontend: Add to billing page**

Location: `packages/web/src/components/billing/SubscriptionCard.jsx`

```jsx
// Add useUsage primitive or inline query
const usage = createQuery(() => ({
  queryKey: ['billing', 'usage'],
  queryFn: () => apiFetch.get('/api/billing/usage'),
}));

// In JSX, after subscription details:
<Show when={usage.data && !isFree()}>
  <div class='mt-4 grid grid-cols-2 gap-3'>
    <UsageCard label='Projects' used={usage.data.projects} limit={quotas()['projects.max'] ?? -1} />
    <UsageCard label='Collaborators' used={usage.data.collaborators} limit={quotas()['collaborators.max'] ?? -1} />
  </div>
</Show>;
```

**Tasks:**

- [ ] Create UsageCard component
- [ ] Add `GET /api/billing/usage` endpoint
- [ ] Integrate usage display into SubscriptionCard
- [ ] Add quota limits from useSubscription
- [ ] Style near-limit warnings

---

### 1.3 Better Stripe Error Messages

**Shared: Add error mapping**

Location: `packages/shared/src/errors/stripeErrors.js`

```javascript
export const STRIPE_ERROR_MESSAGES = {
  // Card errors
  card_declined: 'Your card was declined. Please try a different payment method.',
  expired_card: 'Your card has expired. Please use a different card.',
  incorrect_cvc: 'The security code (CVC) is incorrect.',
  processing_error: 'An error occurred while processing your card. Please try again.',
  incorrect_number: 'The card number is incorrect.',

  // Authentication
  authentication_required: 'Additional authentication required. Please complete the verification.',

  // Rate limits
  rate_limit: 'Too many requests. Please wait a moment and try again.',

  // Generic
  default: 'Payment failed. Please try again or use a different payment method.',
};

export function getStripeErrorMessage(error) {
  if (error?.code && STRIPE_ERROR_MESSAGES[error.code]) {
    return STRIPE_ERROR_MESSAGES[error.code];
  }
  if (error?.decline_code) {
    return STRIPE_ERROR_MESSAGES[error.decline_code] || STRIPE_ERROR_MESSAGES.default;
  }
  return STRIPE_ERROR_MESSAGES.default;
}
```

**Backend: Return user-friendly errors**

Location: `packages/workers/src/routes/billing/checkout.js`

```javascript
import { getStripeErrorMessage } from '@corates/shared';

// In catch block:
catch (error) {
  if (error.type === 'StripeCardError' || error.type === 'StripeInvalidRequestError') {
    const userMessage = getStripeErrorMessage(error);
    logger.stripe('checkout_error', {
      orgId,
      userId: user.id,
      stripeCode: error.code,
      stripeDeclineCode: error.decline_code,
    });
    return c.json({
      statusCode: 400,
      code: 'PAYMENT_FAILED',
      userMessage,
      stripeCode: error.code,
    }, 400);
  }
  throw error;
}
```

**Frontend: Display specific errors**

Location: `packages/web/src/components/billing/PricingTable.jsx`

```javascript
// Replace generic error handling:
catch (error) {
  const userMessage = error.userMessage || 'Checkout failed. Please try again.';
  showToast.error('Payment Error', userMessage);
  setLoadingTier(null);
}
```

**Tasks:**

- [ ] Create stripeErrors.js in shared package
- [ ] Update checkout endpoints to return userMessage
- [ ] Update PricingTable error handling
- [ ] Test with Stripe test cards (4000000000000002 for decline)

---

## Phase 2: Enhanced Testing & Config (2-3 weeks)

### 2.1 Integration Billing Tests

**Goal:** Real webhook flow tests without mocks

**Setup: Test fixtures**

Location: `packages/workers/src/__tests__/billing/fixtures.js`

```javascript
import Stripe from 'stripe';

export async function createTestStripeCustomer(stripe, email) {
  return stripe.customers.create({
    email,
    metadata: { test: 'true' },
  });
}

export async function createTestSubscription(stripe, customerId, priceId) {
  return stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    payment_behavior: 'default_incomplete',
  });
}

export function buildWebhookEvent(type, data, secret) {
  const payload = JSON.stringify({
    id: `evt_test_${Date.now()}`,
    type,
    data: { object: data },
  });
  const signature = stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
  });
  return { payload, signature };
}
```

**Test: Webhook flow**

Location: `packages/workers/src/__tests__/billing/webhook-flow.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import { env } from 'cloudflare:test';
import { resetTestDatabase } from '../helpers/db.js';
import { buildWebhookEvent } from './fixtures.js';

describe('Billing Webhook Flow', () => {
  beforeEach(async () => {
    await resetTestDatabase(env.DB);
  });

  it('processes checkout.session.completed and creates subscription record', async () => {
    // Arrange: Create org and user
    const orgId = await createTestOrg(env.DB);

    // Act: Send webhook
    const { payload, signature } = buildWebhookEvent(
      'checkout.session.completed',
      {
        id: 'cs_test_123',
        customer: 'cus_test_123',
        subscription: 'sub_test_123',
        metadata: { orgId },
      },
      env.STRIPE_WEBHOOK_SECRET_AUTH,
    );

    const response = await app.request('/api/billing/webhook/auth', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'stripe-signature': signature,
      },
      body: payload,
    });

    // Assert: Subscription created
    expect(response.status).toBe(200);
    const sub = await db.query.orgAccessSubscriptions.findFirst({
      where: eq(orgAccessSubscriptions.orgId, orgId),
    });
    expect(sub).toBeDefined();
    expect(sub.stripeSubscriptionId).toBe('sub_test_123');
  });

  it('deduplicates webhook events via ledger', async () => {
    // Send same event twice, verify only one record created
  });
});
```

**Tasks:**

- [ ] Create billing test fixtures
- [ ] Add webhook flow integration tests
- [ ] Add ledger deduplication tests
- [ ] Add entitlement resolution tests
- [ ] Create `pnpm test:billing-int` script

---

### 2.2 Flexible Pricing Configuration

**Goal:** Slug-based feature/usage config without schema changes

**Config: pricing.json**

Location: `packages/shared/src/plans/pricing.json`

```json
{
  "features": {
    "project.create": {
      "description": "Create new projects",
      "plans": ["trial", "starter_team", "team", "unlimited_team", "single_project"]
    },
    "export.pdf": {
      "description": "Export to PDF",
      "plans": ["starter_team", "team", "unlimited_team"]
    },
    "collaboration.realtime": {
      "description": "Real-time collaboration",
      "plans": ["team", "unlimited_team"]
    }
  },
  "usageMeters": {
    "projects.max": {
      "description": "Maximum projects",
      "limits": {
        "free": 1,
        "trial": 3,
        "single_project": 1,
        "starter_team": 5,
        "team": 20,
        "unlimited_team": -1
      }
    },
    "collaborators.max": {
      "description": "Maximum collaborators per project",
      "limits": {
        "free": 1,
        "trial": 3,
        "single_project": 5,
        "starter_team": 10,
        "team": 25,
        "unlimited_team": -1
      }
    }
  }
}
```

**Shared: Unified access checker**

Location: `packages/shared/src/plans/access.js`

```javascript
import pricingConfig from './pricing.json';

export function hasFeature(tier, featureSlug) {
  const feature = pricingConfig.features[featureSlug];
  if (!feature) return false;
  return feature.plans.includes(tier);
}

export function getUsageLimit(tier, meterSlug) {
  const meter = pricingConfig.usageMeters[meterSlug];
  if (!meter) return -1;
  return meter.limits[tier] ?? meter.limits.free ?? 0;
}

export function checkUsage(tier, meterSlug, currentUsage, requested = 1) {
  const limit = getUsageLimit(tier, meterSlug);
  if (limit === -1) return true; // Unlimited
  return currentUsage + requested <= limit;
}
```

**Backend: Middleware using config**

```javascript
import { hasFeature, checkUsage } from '@corates/shared/plans';

export function requireFeature(featureSlug) {
  return async (c, next) => {
    const tier = c.get('subscription')?.tier ?? 'free';
    if (!hasFeature(tier, featureSlug)) {
      return c.json({ error: 'Feature not available on your plan' }, 403);
    }
    await next();
  };
}
```

**Tasks:**

- [ ] Create pricing.json config
- [ ] Create unified access.js checker
- [ ] Refactor entitlements.js to use config
- [ ] Update middleware to use config
- [ ] Sync frontend useSubscription with config

---

### 2.3 Stateless Billing Architecture

**Goal:** Query Stripe as the source of truth instead of maintaining a local subscription table  
**Effort:** 3-4 days  
**Risk:** Low (dual-path migration with rollback)

---

#### Why Stateless?

**Current State:** CoRATES stores subscription state in `orgAccessSubscriptions` table, synchronized via webhooks.

**Problems with local state:**

| Issue                  | Impact                                    | Frequency        |
| ---------------------- | ----------------------------------------- | ---------------- |
| Webhook delays         | User sees wrong plan for 1-5 seconds      | Common           |
| Webhook failures       | User stuck on wrong plan until manual fix | Rare but painful |
| State drift            | Local != Stripe after edge cases          | Occasional       |
| Multiple subscriptions | Complex upsert logic                      | Future blocker   |
| Testing complexity     | Must seed DB + mock webhooks              | Every test       |

**Stateless approach:** Query Stripe directly, cache briefly, invalidate on webhooks.

---

#### Cache Strategy: Workers KV

**Why Workers KV:**

| Option          | Consistency           | Speed   | Complexity | Shared Across Isolates |
| --------------- | --------------------- | ------- | ---------- | ---------------------- |
| In-Memory Map   | Per-isolate only      | Fastest | Lowest     | No                     |
| **Workers KV**  | Eventually consistent | Fast    | Low        | Yes                    |
| Durable Objects | Strong                | Medium  | Medium     | Yes                    |

**Workers KV is the right choice because:**

- **Shared across all isolates** - Every request sees the same cache
- **Built-in TTL** - Automatic expiration, no cleanup code needed
- **Eventually consistent** - Fine for billing (worst case: 60s stale, same as our TTL)
- **Simple API** - Just `get()` and `put()` with JSON
- **Global edge cache** - Fast reads from nearest Cloudflare PoP

**Why not In-Memory Map:**

- Workers spin up multiple isolates - each has separate memory
- Isolates are evicted unpredictably - cache disappears
- No sharing between requests hitting different isolates
- Cold starts always miss cache

**KV Namespace Setup:**

Add to `wrangler.jsonc`:

```jsonc
{
  "kv_namespaces": [
    {
      "binding": "SUBSCRIPTION_CACHE",
      "id": "<create-via-wrangler>",
    },
  ],
}
```

Create namespace:

```bash
pnpm wrangler kv:namespace create SUBSCRIPTION_CACHE
pnpm wrangler kv:namespace create SUBSCRIPTION_CACHE --preview
```

---

#### Implementation

##### Step 1: Create Cache Utility

**File:** `packages/workers/src/lib/subscriptionCache.js`

```javascript
/**
 * Workers KV-based subscription cache
 *
 * Why KV:
 * - Shared across all Worker isolates (unlike in-memory Map)
 * - Built-in TTL expiration (no cleanup code needed)
 * - Eventually consistent (fine for 60s cache window)
 * - Global edge caching for fast reads
 */

const CACHE_TTL_SECONDS = 60; // 60 seconds
const KEY_PREFIX = 'sub:'; // Namespace prefix for subscription keys

/**
 * Get cached subscription for a Stripe customer
 * @param {KVNamespace} kv - Workers KV binding (env.SUBSCRIPTION_CACHE)
 * @param {string} customerId - Stripe customer ID (cus_xxx)
 * @returns {Promise<object|null>} Cached subscription or null if missing/expired
 */
export async function get(kv, customerId) {
  try {
    const cached = await kv.get(`${KEY_PREFIX}${customerId}`, { type: 'json' });
    return cached;
  } catch (error) {
    console.error('[SubscriptionCache] Get failed:', { customerId, error: error.message });
    return null;
  }
}

/**
 * Store subscription in cache
 * @param {KVNamespace} kv - Workers KV binding
 * @param {string} customerId - Stripe customer ID
 * @param {object|null} subscription - Stripe subscription object or null
 */
export async function set(kv, customerId, subscription) {
  try {
    await kv.put(`${KEY_PREFIX}${customerId}`, JSON.stringify(subscription), {
      expirationTtl: CACHE_TTL_SECONDS,
    });
  } catch (error) {
    // Log but don't throw - cache write failures are non-critical
    console.error('[SubscriptionCache] Set failed:', { customerId, error: error.message });
  }
}

/**
 * Invalidate cache for a customer (called from webhooks)
 * @param {KVNamespace} kv - Workers KV binding
 * @param {string} customerId - Stripe customer ID
 */
export async function invalidate(kv, customerId) {
  try {
    await kv.delete(`${KEY_PREFIX}${customerId}`);
    console.log(`[SubscriptionCache] Invalidated: ${customerId}`);
  } catch (error) {
    console.error('[SubscriptionCache] Invalidate failed:', { customerId, error: error.message });
  }
}

// Note: No clear() or stats() needed for KV
// - KV handles TTL expiration automatically
// - Use Wrangler CLI or dashboard to inspect KV contents if needed
```

---

##### Step 2: Create Stripe Subscription Fetcher

**File:** `packages/workers/src/lib/stripeSubscription.js`

```javascript
/**
 * Fetch subscription from Stripe with KV caching
 */
import Stripe from 'stripe';
import * as cache from './subscriptionCache.js';

/**
 * Get active subscription for a Stripe customer
 * Uses KV cache with 60s TTL, falls back to Stripe API
 *
 * @param {object} params
 * @param {Stripe} params.stripe - Stripe client instance
 * @param {KVNamespace} params.kv - Workers KV binding (env.SUBSCRIPTION_CACHE)
 * @param {string} params.customerId - Stripe customer ID (cus_xxx)
 * @param {boolean} params.forceRefresh - Skip cache and fetch from Stripe
 * @returns {Promise<Stripe.Subscription|null>}
 */
export async function getSubscription({ stripe, kv, customerId, forceRefresh = false }) {
  if (!customerId) {
    return null;
  }

  // Check KV cache first (unless force refresh)
  if (!forceRefresh) {
    const cached = await cache.get(kv, customerId);
    if (cached !== null) {
      console.log('[StripeSubscription] Cache hit:', customerId);
      return cached;
    }
  }

  // Fetch from Stripe
  console.log('[StripeSubscription] Cache miss, fetching from Stripe:', customerId);
  try {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
      expand: ['data.items.data.price'], // Include price details
    });

    const subscription = subscriptions.data[0] ?? null;

    // Cache the result (even if null - means no active subscription)
    await cache.set(kv, customerId, subscription);

    return subscription;
  } catch (error) {
    console.error('[StripeSubscription] Failed to fetch:', {
      customerId,
      error: error.message,
    });

    // On Stripe error, try cache as fallback (may return stale data)
    const stale = await cache.get(kv, customerId);
    if (stale) {
      console.warn('[StripeSubscription] Returning potentially stale cache due to Stripe error');
      return stale;
    }

    return null;
  }
}

/**
 * Invalidate subscription cache (called from webhooks)
 * @param {KVNamespace} kv - Workers KV binding
 * @param {string} customerId - Stripe customer ID
 */
export async function invalidateSubscription(kv, customerId) {
  await cache.invalidate(kv, customerId);
}

/**
 * Pre-warm cache with subscription data (called after checkout)
 * @param {KVNamespace} kv - Workers KV binding
 * @param {string} customerId - Stripe customer ID
 * @param {Stripe.Subscription} subscription - Subscription object
 */
export async function warmCache(kv, customerId, subscription) {
  await cache.set(kv, customerId, subscription);
}
```

---

##### Step 3: Create Price-to-Plan Mapping

**File:** `packages/workers/src/lib/priceToPlan.js`

```javascript
/**
 * Map Stripe price IDs to CoRATES plan tiers
 *
 * This is the single source of truth for price -> plan mapping.
 * Update this when adding new plans or changing Stripe prices.
 */

// Price IDs from Stripe Dashboard
// Format: price_xxx for live, price_test_xxx for test mode
const PRICE_TO_PLAN = {
  // Team Monthly
  [process.env.STRIPE_PRICE_TEAM_MONTHLY]: 'team',
  // Team Yearly
  [process.env.STRIPE_PRICE_TEAM_YEARLY]: 'team',
  // Unlimited Team Monthly
  [process.env.STRIPE_PRICE_UNLIMITED_MONTHLY]: 'unlimited_team',
  // Unlimited Team Yearly
  [process.env.STRIPE_PRICE_UNLIMITED_YEARLY]: 'unlimited_team',
  // Starter Team (if exists)
  [process.env.STRIPE_PRICE_STARTER_MONTHLY]: 'starter_team',
  [process.env.STRIPE_PRICE_STARTER_YEARLY]: 'starter_team',
};

// Fallback: Parse plan from price metadata or product name
const PRODUCT_NAME_TO_PLAN = {
  'Team Plan': 'team',
  'Unlimited Team Plan': 'unlimited_team',
  'Starter Team Plan': 'starter_team',
  'Single Project': 'single_project',
};

/**
 * Map a Stripe price ID to a CoRATES plan tier
 * @param {string} priceId - Stripe price ID
 * @param {object} price - Full Stripe price object (optional, for fallback)
 * @returns {string} Plan tier ('free', 'team', 'unlimited_team', etc.)
 */
export function mapPriceIdToPlan(priceId, price = null) {
  // Direct mapping
  if (PRICE_TO_PLAN[priceId]) {
    return PRICE_TO_PLAN[priceId];
  }

  // Fallback: Check price metadata
  if (price?.metadata?.plan) {
    return price.metadata.plan;
  }

  // Fallback: Check product name
  if (price?.product?.name) {
    const planFromName = PRODUCT_NAME_TO_PLAN[price.product.name];
    if (planFromName) {
      return planFromName;
    }
  }

  // Unknown price - log warning and return free
  console.warn('[PriceToPlan] Unknown price ID:', priceId);
  return 'free';
}

/**
 * Get plan tier from a Stripe subscription object
 * @param {Stripe.Subscription} subscription
 * @returns {string} Plan tier
 */
export function getPlanFromSubscription(subscription) {
  if (!subscription || subscription.status !== 'active') {
    return 'free';
  }

  const item = subscription.items?.data?.[0];
  if (!item) {
    return 'free';
  }

  return mapPriceIdToPlan(item.price.id, item.price);
}
```

---

##### Step 4: Update Billing Resolver

**File:** Modify `packages/workers/src/lib/billingResolver.js`

```javascript
import { getSubscription, invalidateSubscription } from './stripeSubscription.js';
import { getPlanFromSubscription } from './priceToPlan.js';
import Stripe from 'stripe';

/**
 * Resolve org's current plan tier using Stripe as source of truth
 *
 * Flow:
 * 1. Get org's Stripe customer ID from database
 * 2. Fetch subscription from Stripe (with KV caching)
 * 3. Map subscription to plan tier
 *
 * @param {object} params
 * @param {D1Database} params.db - Database connection
 * @param {string} params.orgId - Organization ID
 * @param {object} params.env - Environment with STRIPE_SECRET_KEY and SUBSCRIPTION_CACHE
 * @returns {Promise<{plan: string, subscription: object|null}>}
 */
export async function resolveOrgPlan({ db, orgId, env }) {
  // 1. Get org's Stripe customer ID
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
    columns: {
      stripeCustomerId: true,
      // Keep these for grants/trials (not changing those)
    },
  });

  if (!org?.stripeCustomerId) {
    // No Stripe customer = free tier
    // (Could also check for grants/trials here)
    return { plan: 'free', subscription: null };
  }

  // 2. Fetch subscription from Stripe (with KV cache)
  const stripe = new Stripe(env.STRIPE_SECRET_KEY);
  const subscription = await getSubscription({
    stripe,
    kv: env.SUBSCRIPTION_CACHE,
    customerId: org.stripeCustomerId,
  });

  // 3. Map to plan tier
  const plan = getPlanFromSubscription(subscription);

  return { plan, subscription };
}

/**
 * MIGRATION: Dual-path resolver for transition period
 * Compares local DB state with Stripe and logs mismatches
 *
 * Use this during migration, then switch to resolveOrgPlan()
 */
export async function resolveOrgPlanDualPath({ db, orgId, env }) {
  // Get from both sources
  const [localResult, stripeResult] = await Promise.all([
    resolveOrgPlanFromDb({ db, orgId }), // Existing function
    resolveOrgPlan({ db, orgId, env }), // New Stripe-based
  ]);

  // Compare and log mismatches
  if (localResult.plan !== stripeResult.plan) {
    console.warn('[BillingResolver] Plan mismatch detected', {
      orgId,
      localPlan: localResult.plan,
      stripePlan: stripeResult.plan,
      stripeSubId: stripeResult.subscription?.id,
    });
  }

  // Return Stripe result (source of truth)
  return stripeResult;
}

// Re-export for webhook use
export { invalidateSubscription };
```

---

##### Step 5: Update Webhooks to Invalidate Cache

**File:** Modify `packages/workers/src/routes/billing/webhooks.js`

```javascript
import { invalidateSubscription, warmCache } from '@/lib/stripeSubscription.js';

// In webhook handler switch statement:
// Note: c.env.SUBSCRIPTION_CACHE is the KV binding

case 'customer.subscription.created': {
  const subscription = event.data.object;
  const customerId = subscription.customer;

  // Warm KV cache with new subscription (faster than waiting for next request)
  await warmCache(c.env.SUBSCRIPTION_CACHE, customerId, subscription);

  logger.info('Subscription created', {
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
  });
  break;
}

case 'customer.subscription.updated': {
  const subscription = event.data.object;
  const customerId = subscription.customer;

  // Invalidate KV cache so next request gets fresh data
  await invalidateSubscription(c.env.SUBSCRIPTION_CACHE, customerId);

  logger.info('Subscription updated', {
    customerId,
    subscriptionId: subscription.id,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  });
  break;
}

case 'customer.subscription.deleted': {
  const subscription = event.data.object;
  const customerId = subscription.customer;

  // Invalidate KV cache - next request will see no active subscription
  await invalidateSubscription(c.env.SUBSCRIPTION_CACHE, customerId);

  logger.info('Subscription deleted', {
    customerId,
    subscriptionId: subscription.id,
  });
  break;
}

// Also handle payment failures (subscription might become past_due)
case 'invoice.payment_failed': {
  const invoice = event.data.object;
  const customerId = invoice.customer;

  // Invalidate KV so we fetch current subscription status
  await invalidateSubscription(c.env.SUBSCRIPTION_CACHE, customerId);

  logger.warn('Payment failed', {
    customerId,
    invoiceId: invoice.id,
  });
  break;
}
```

---

##### Step 6: Update Middleware to Use New Resolver

**File:** Modify `packages/workers/src/middleware/requireEntitlement.js`

```javascript
import { resolveOrgPlan } from '@/lib/billingResolver.js';

export function requireEntitlement(entitlement) {
  return async (c, next) => {
    const orgId = c.get('orgId');

    // Use new Stripe-based resolver
    const { plan } = await resolveOrgPlan({
      db: createDb(c.env.DB),
      orgId,
      env: c.env,
    });

    // Store plan in context for downstream use
    c.set('plan', plan);

    // Check entitlement
    const hasAccess = checkEntitlement(plan, entitlement);
    if (!hasAccess) {
      return c.json(
        {
          code: 'ENTITLEMENT_REQUIRED',
          message: `This feature requires ${entitlement}`,
          currentPlan: plan,
        },
        403,
      );
    }

    await next();
  };
}
```

---

#### Testing Strategy

##### Unit Tests

**File:** `packages/workers/src/lib/__tests__/subscriptionCache.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as cache from '../subscriptionCache.js';

// Mock KV namespace
function createMockKV() {
  const store = new Map();
  return {
    get: vi.fn(async (key, opts) => {
      const value = store.get(key);
      if (opts?.type === 'json' && value) {
        return JSON.parse(value);
      }
      return value ?? null;
    }),
    put: vi.fn(async (key, value, opts) => {
      store.set(key, value);
    }),
    delete: vi.fn(async key => {
      store.delete(key);
    }),
    _store: store, // For test inspection
  };
}

describe('SubscriptionCache (KV)', () => {
  let mockKV;

  beforeEach(() => {
    mockKV = createMockKV();
  });

  it('returns null for missing entry', async () => {
    const result = await cache.get(mockKV, 'cus_missing');
    expect(result).toBeNull();
  });

  it('stores and retrieves subscription', async () => {
    const sub = { id: 'sub_123', status: 'active' };
    await cache.set(mockKV, 'cus_123', sub);

    const result = await cache.get(mockKV, 'cus_123');
    expect(result).toEqual(sub);
  });

  it('sets TTL on cache entries', async () => {
    const sub = { id: 'sub_123' };
    await cache.set(mockKV, 'cus_123', sub);

    expect(mockKV.put).toHaveBeenCalledWith('sub:cus_123', JSON.stringify(sub), {
      expirationTtl: 60,
    });
  });

  it('invalidates entry', async () => {
    await cache.set(mockKV, 'cus_123', { id: 'sub_123' });
    await cache.invalidate(mockKV, 'cus_123');

    expect(mockKV.delete).toHaveBeenCalledWith('sub:cus_123');
  });
});
```

##### Integration Tests

**File:** `packages/workers/src/lib/__tests__/billingResolver.integration.test.js`

```javascript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { resolveOrgPlan } from '../billingResolver.js';
import * as cache from '../subscriptionCache.js';

// Mock Stripe
vi.mock('stripe', () => ({
  default: vi.fn(() => ({
    subscriptions: {
      list: vi.fn(),
    },
  })),
}));

describe('resolveOrgPlan', () => {
  beforeEach(() => {
    cache.clear();
    vi.clearAllMocks();
  });

  it('returns free for org without Stripe customer', async () => {
    const result = await resolveOrgPlan({
      db: mockDb({ stripeCustomerId: null }),
      orgId: 'org_1',
      env: mockEnv,
    });

    expect(result.plan).toBe('free');
    expect(result.subscription).toBeNull();
  });

  it('returns plan from active subscription', async () => {
    mockStripeSubscriptions([
      {
        id: 'sub_123',
        status: 'active',
        items: { data: [{ price: { id: 'price_team_monthly' } }] },
      },
    ]);

    const result = await resolveOrgPlan({
      db: mockDb({ stripeCustomerId: 'cus_123' }),
      orgId: 'org_1',
      env: mockEnv,
    });

    expect(result.plan).toBe('team');
  });

  it('uses cache on second call', async () => {
    const stripeMock = mockStripeSubscriptions([{ id: 'sub_123', status: 'active' }]);

    await resolveOrgPlan({
      db: mockDb({ stripeCustomerId: 'cus_123' }),
      orgId: 'org_1',
      env: mockEnv,
    });
    await resolveOrgPlan({
      db: mockDb({ stripeCustomerId: 'cus_123' }),
      orgId: 'org_1',
      env: mockEnv,
    });

    expect(stripeMock.subscriptions.list).toHaveBeenCalledTimes(1);
  });
});
```

---

#### Migration Plan

##### Day 1: Add Infrastructure

```
Morning:
- [ ] Create KV namespace: pnpm wrangler kv:namespace create SUBSCRIPTION_CACHE
- [ ] Create preview namespace: pnpm wrangler kv:namespace create SUBSCRIPTION_CACHE --preview
- [ ] Add KV binding to wrangler.jsonc
- [ ] Create subscriptionCache.js (KV-based)
- [ ] Create stripeSubscription.js
- [ ] Create priceToPlan.js

Afternoon:
- [ ] Write unit tests for cache with mock KV
- [ ] Add resolveOrgPlanDualPath() to billingResolver
- [ ] Deploy to staging (dual-path mode)
```

##### Day 2: Webhook Integration

```
Morning:
- [ ] Update webhook handlers to invalidate cache
- [ ] Add warmCache() call after checkout
- [ ] Test webhook -> cache invalidation flow

Afternoon:
- [ ] Run dual-path in staging
- [ ] Monitor logs for mismatches
- [ ] Fix any price-to-plan mapping issues
```

##### Day 3: Switch to Stripe-First

```
Morning:
- [ ] Review mismatch logs from Day 2
- [ ] Fix any edge cases found
- [ ] Update middleware to use new resolver

Afternoon:
- [ ] Deploy Stripe-first to staging
- [ ] End-to-end test: checkout -> subscription -> feature access
- [ ] Verify cache invalidation works
```

##### Day 4: Production & Cleanup

```
Morning:
- [ ] Deploy to production
- [ ] Monitor for 2-4 hours
- [ ] Verify no user-facing issues

Afternoon:
- [ ] Remove dual-path code
- [ ] Update documentation
- [ ] Plan local table removal (Phase 3)
```

---

#### Rollback Strategy

If issues arise after deploying:

```javascript
// In billingResolver.js - add feature flag
const USE_STRIPE_BILLING = process.env.USE_STRIPE_BILLING !== 'false';

export async function resolveOrgPlan({ db, orgId, env }) {
  if (!USE_STRIPE_BILLING) {
    // Fallback to local DB
    return resolveOrgPlanFromDb({ db, orgId });
  }

  // ... Stripe-based implementation
}
```

To rollback: Set `USE_STRIPE_BILLING=false` in wrangler.jsonc and redeploy.

---

#### Monitoring & Observability

Add metrics to track:

```javascript
// In stripeSubscription.js
export async function getSubscription(stripe, customerId, options = {}) {
  const cacheHit = !options.forceRefresh && cache.get(customerId) !== null;

  // Log for observability
  console.log('[Billing] Subscription lookup', {
    customerId,
    cacheHit,
    forceRefresh: options.forceRefresh,
  });

  // ... rest of implementation
}
```

Dashboard queries (for future analytics):

- Cache hit rate
- Stripe API calls per minute
- Mismatches between local and Stripe (during migration)
- Average latency for subscription lookups

---

#### Files Summary

**New Files:**
| File | Purpose | Lines |
|------|---------|-------|
| `lib/subscriptionCache.js` | In-memory cache with TTL | ~80 |
| `lib/stripeSubscription.js` | Fetch + cache subscription | ~60 |
| `lib/priceToPlan.js` | Map Stripe prices to plans | ~50 |
| `lib/__tests__/subscriptionCache.test.js` | Cache unit tests | ~40 |
| `lib/__tests__/billingResolver.integration.test.js` | Integration tests | ~80 |

**Modified Files:**
| File | Changes |
|------|---------|
| `lib/billingResolver.js` | Add `resolveOrgPlan()`, dual-path |
| `routes/billing/webhooks.js` | Add cache invalidation |
| `middleware/requireEntitlement.js` | Use new resolver |

**Total:** ~400 lines of new/modified code

---

#### Tasks Checklist

- [ ] Create `subscriptionCache.js` with TTL and invalidation
- [ ] Create `stripeSubscription.js` with Stripe fetcher
- [ ] Create `priceToPlan.js` mapping (update with real price IDs)
- [ ] Add `resolveOrgPlan()` to billingResolver
- [ ] Add `resolveOrgPlanDualPath()` for migration
- [ ] Update webhooks to invalidate cache
- [ ] Add `warmCache()` after checkout completion
- [ ] Write unit tests for cache
- [ ] Write integration tests for resolver
- [ ] Deploy dual-path to staging
- [ ] Monitor for 24h and fix mismatches
- [ ] Switch to Stripe-first
- [ ] Deploy to production
- [ ] Remove dual-path code after 1 week
- [ ] Document price ID mapping for future plans

---

## Phase 3: Address & Tax (1 week)

### 3.1 Address Collection at Checkout

**Backend: Enable in checkout session**

```javascript
// In checkout session creation:
const session = await stripe.checkout.sessions.create({
  // ... existing params
  billing_address_collection: 'required',
  customer_update: {
    address: 'auto',
  },
  tax_id_collection: {
    enabled: true,
  },
});
```

**Backend: Store address from webhook**

```javascript
// In checkout.session.completed handler:
const { customer_details } = event.data.object;
if (customer_details?.address) {
  await db
    .update(organizations)
    .set({
      billingAddress: JSON.stringify(customer_details.address),
      taxIds: JSON.stringify(customer_details.tax_ids || []),
    })
    .where(eq(organizations.id, orgId));
}
```

**Tasks:**

- [ ] Enable billing_address_collection in checkout
- [ ] Add billingAddress column to organizations table
- [ ] Store address from webhook
- [ ] Display address in subscription management (optional)

---

## Phase 4: Embedded Checkout (Optional - 4+ weeks)

### 4.1 Stripe Elements Integration

**Only if needed:** Replace redirect with embedded form.

**When to do this:**

- Users complain about leaving the app
- Need custom checkout flow
- Need to handle 3D Secure in-app
- Want to show discounts inline

**Complexity:**

- Requires PaymentIntent creation endpoint
- Must handle 3D Secure modal
- More error states to manage
- PCI compliance considerations

**Recommendation:** Keep redirect model unless user feedback demands embedded checkout.

---

## Implementation Order

```
Week 1:
  - 1.1 Promo codes (backend + frontend)
  - 1.3 Error messages

Week 2:
  - 1.2 Usage metrics display
  - Start 2.1 integration tests

Week 3:
  - 2.1 Complete integration tests
  - 2.2 Pricing config (start)

Week 4:
  - 2.2 Pricing config (complete)
  - 3.1 Address collection

Week 5+:
  - Polish and testing
  - Phase 4 only if needed
```

---

## Success Metrics

- [ ] Promo code redemption rate tracked
- [ ] Checkout error rate < 2%
- [ ] Usage display visible on billing page
- [ ] Integration tests passing for all webhook flows
- [ ] Pricing changes deployable without schema migrations

---

## Files to Create/Modify

**New files:**

- `packages/shared/src/errors/stripeErrors.js`
- `packages/shared/src/plans/pricing.json`
- `packages/shared/src/plans/access.js`
- `packages/web/src/components/billing/UsageCard.jsx`
- `packages/workers/src/__tests__/billing/webhook-flow.test.js`
- `packages/workers/src/__tests__/billing/fixtures.js`

**Modified files:**

- `packages/workers/src/routes/billing/checkout.js` - promo codes, errors
- `packages/workers/src/routes/billing/subscription.js` - usage endpoint
- `packages/web/src/components/billing/PricingTable.jsx` - promo UI
- `packages/web/src/components/billing/SubscriptionCard.jsx` - usage display
- `packages/web/src/lib/entitlements.js` - use config
- `packages/workers/src/middleware/entitlements.js` - use config
