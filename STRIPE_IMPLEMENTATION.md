# Stripe Payment Implementation Plan

This document outlines the implementation plan for adding Stripe payments to CoRATES.

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Frontend      │────▶│   Workers API   │────▶│     Stripe      │
│   (packages/web)│     │ (packages/workers)    │     API         │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                               │
                               ▼
                        ┌─────────────────┐
                        │   D1 Database   │
                        │  (subscriptions)│
                        └─────────────────┘
```

## Database Schema

Add a new migration for subscription data:

**File:** `packages/workers/migrations/0002_subscriptions.sql`

```sql
CREATE TABLE subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  tier TEXT NOT NULL DEFAULT 'free', -- 'free', 'pro', 'team', 'enterprise'
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'trialing'
  current_period_start INTEGER,
  current_period_end INTEGER,
  cancel_at_period_end INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch())
);

CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
```

## Backend Implementation (packages/workers)

### File Structure

```
packages/workers/src/
├── routes/
│   └── billing/
│       ├── index.js          # Route registration
│       ├── checkout.js       # Create checkout sessions
│       ├── portal.js         # Customer portal
│       ├── webhooks.js       # Stripe webhooks
│       └── subscription.js   # Get/manage subscription
├── middleware/
│   └── subscription.js       # Permission middleware
├── config/
│   └── stripe.js             # Stripe config & price IDs
└── db/
    └── subscriptions.js      # DB queries
```

### API Endpoints

| Endpoint                    | Method | Description                    |
| --------------------------- | ------ | ------------------------------ |
| `/api/billing/checkout`     | POST   | Create Stripe Checkout session |
| `/api/billing/portal`       | POST   | Create Customer Portal session |
| `/api/billing/subscription` | GET    | Get current subscription       |
| `/api/billing/webhook`      | POST   | Handle Stripe webhooks         |

### Webhook Events to Handle

- `checkout.session.completed` - User completed checkout
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription changed (upgrade/downgrade)
- `customer.subscription.deleted` - Subscription canceled
- `invoice.payment_failed` - Payment failed
- `invoice.paid` - Invoice paid successfully

## Frontend Implementation (packages/web)

### File Structure

```
packages/web/src/
├── components/
│   ├── billing/
│   │   ├── PricingTable.jsx      # Display pricing tiers
│   │   ├── SubscriptionCard.jsx  # Current subscription info
│   │   ├── UpgradeButton.jsx     # Trigger checkout
│   │   └── ManageButton.jsx      # Open customer portal
│   └── zag/
│       └── Dialog.jsx            # For confirmation modals (if needed)
├── routes/
│   └── settings/
│       └── billing.jsx           # Billing settings page
├── lib/
│   └── billing.js                # API calls for billing
└── primitives/
    └── useSubscription.js        # Subscription state/permissions
```

### Key Components

1. **PricingTable** - Display tiers with features comparison
2. **SubscriptionCard** - Show current plan, renewal date, status
3. **UpgradeButton** - Redirects to Stripe Checkout
4. **ManageButton** - Opens Stripe Customer Portal (for cancellation, payment methods)

## Subscription Tiers

| Tier       | Price  | Features                              |
| ---------- | ------ | ------------------------------------- |
| Free       | $0     | Basic features, limited projects      |
| Pro        | $X/mo  | Unlimited projects, advanced features |
| Team       | $X/mo  | Collaboration, team management        |
| Enterprise | Custom | SSO, dedicated support                |

> TODO: Define specific pricing and feature limits based on pricing-model.md

## Permission System

### Backend Middleware

```js
// middleware/subscription.js
import { getSubscription } from '../db/subscriptions.js';

const TIER_LEVELS = {
  free: 0,
  pro: 1,
  team: 2,
  enterprise: 3,
};

export const requireTier = minTier => async (c, next) => {
  const userId = c.get('userId');
  const subscription = await getSubscription(c.env.DB, userId);

  if (TIER_LEVELS[subscription?.tier || 'free'] < TIER_LEVELS[minTier]) {
    return c.json({ error: 'Upgrade required', requiredTier: minTier }, 403);
  }

  await next();
};
```

### Frontend Hook

```js
// primitives/useSubscription.js
import { createResource } from 'solid-js';
import { fetchSubscription } from '@/lib/billing';

const FEATURE_ACCESS = {
  'unlimited-projects': ['pro', 'team', 'enterprise'],
  'team-collaboration': ['team', 'enterprise'],
  sso: ['enterprise'],
  // Add more features as needed
};

export function useSubscription() {
  const [subscription] = createResource(fetchSubscription);

  const canAccess = feature => {
    const tier = subscription()?.tier || 'free';
    return FEATURE_ACCESS[feature]?.includes(tier) ?? false;
  };

  const isPro = () => ['pro', 'team', 'enterprise'].includes(subscription()?.tier);
  const isTeam = () => ['team', 'enterprise'].includes(subscription()?.tier);
  const isEnterprise = () => subscription()?.tier === 'enterprise';

  return { subscription, canAccess, isPro, isTeam, isEnterprise };
}
```

## Implementation Phases

### Phase 1: Backend Foundation

- [x] Add `stripe` package to workers
- [x] Add subscriptions table to database schema
- [x] Add Stripe config with price IDs (`src/config/stripe.js`)
- [x] Implement subscription DB queries (`src/db/subscriptions.js`)
- [x] Implement `/api/billing/checkout` endpoint
- [x] Implement `/api/billing/portal` endpoint
- [x] Implement `/api/billing/webhook` endpoint
- [x] Implement `/api/billing/subscription` endpoint
- [x] Implement `/api/billing/plans` endpoint
- [x] Add subscription middleware (`src/middleware/subscription.js`)
- [ ] Add environment variables (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, APP_URL)
- [ ] Update Stripe price IDs in config
- [ ] Test with Stripe CLI

### Phase 2: Core Frontend

- [x] Create `useSubscription` primitive (`src/primitives/useSubscription.js`)
- [x] Create billing API functions (`src/api/billing.js`)
- [x] Build `PricingTable` component
- [x] Build `SubscriptionCard` component
- [x] Build `UpgradePrompt` component
- [x] Create billing settings page route (`/settings/billing`)
- [x] Add billing link to settings page

### Phase 3: Portal & Management

- [x] Implement `/api/billing/portal` endpoint (done in Phase 1)
- [x] Implement `/api/billing/subscription` GET endpoint (done in Phase 1)
- [x] Build `SubscriptionCard` component (done in Phase 2)
- [x] Build manage subscription button (integrated in SubscriptionCard)
- [ ] Add cancellation confirmation dialog (handled by Stripe Portal)

### Phase 4: Permissions & Gating

- [x] Create backend `requireTier` middleware
- [x] Create backend `requireFeature` middleware
- [ ] Apply middleware to protected routes
- [x] Add `canAccess` checks to frontend (`useSubscription` primitive)
- [x] Build upgrade prompt component
- [x] Handle expired/past-due subscription states (in SubscriptionCard)

### Phase 5: Polish & Edge Cases

- [ ] Handle webhook retries (idempotency)
- [x] Add loading states and error handling
- [x] Handle failed payments gracefully (status indicators)
- [x] Add subscription status indicators in UI
- [ ] Test upgrade/downgrade flows
- [ ] Test cancellation and reactivation

## Environment Variables

### wrangler.toml (public vars)

```toml
[vars]
STRIPE_PUBLISHABLE_KEY = "pk_test_..."
```

### Secrets (via `wrangler secret put`)

```bash
wrangler secret put STRIPE_SECRET_KEY
# Enter: sk_test_...

wrangler secret put STRIPE_WEBHOOK_SECRET
# Enter: whsec_...
```

## Stripe Dashboard Setup

1. Create products and prices in Stripe Dashboard
2. Configure Customer Portal settings
3. Set up webhook endpoint URL
4. Enable required webhook events
5. Get API keys and webhook signing secret

## Testing

### Local Development

```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login to Stripe
stripe login

# Forward webhooks to local server
stripe listen --forward-to localhost:8787/api/billing/webhook

# Trigger test events
stripe trigger checkout.session.completed
```

### Test Cards

| Card Number      | Scenario             |
| ---------------- | -------------------- |
| 4242424242424242 | Successful payment   |
| 4000000000000341 | Attaching card fails |
| 4000000000009995 | Insufficient funds   |

## Key Considerations

- **Idempotency**: Store and check webhook event IDs to handle retries
- **Security**: Always verify webhook signatures
- **Sync**: Stripe is source of truth; local DB is cache for performance
- **UX**: Show clear loading/error states during checkout flow
- **Graceful Degradation**: Handle Stripe API failures gracefully

## References

- [Stripe Checkout Documentation](https://stripe.com/docs/payments/checkout)
- [Stripe Customer Portal](https://stripe.com/docs/billing/subscriptions/integrating-customer-portal)
- [Stripe Webhooks](https://stripe.com/docs/webhooks)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)
