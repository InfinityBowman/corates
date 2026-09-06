# Stripe Production Setup

This guide covers setting up Stripe for CoRATES billing and subscriptions.

## 1. Create Stripe Products & Prices

In your [Stripe Dashboard](https://dashboard.stripe.com/products), create products for each plan.

### Product Configuration

For each product, configure:

| Field       | Required    | Notes                                                 |
| ----------- | ----------- | ----------------------------------------------------- |
| Name        | Yes         | Shows on checkout, invoices, and receipts             |
| Description | Recommended | 1-2 sentences describing the plan benefits            |
| Image       | Optional    | Square image (512x512 recommended), shows on checkout |

### Example Product Setup

**Team**

- Name: `CoRATES Team`
- Description: `For small teams running a few reviews. Up to 3 projects, unlimited collaborators.`
- Prices: $30/month, $300/year
- Image: Your logo or a plan-specific icon

**Lab**

- Name: `CoRATES Lab`
- Description: `For active labs and review groups. Up to 10 projects, unlimited collaborators.`
- Prices: $90/month, $900/year

Enterprise has no Stripe product. Admins create the subscription row from the org page in the admin UI.

### Price IDs

After creating products, add prices and copy the Price IDs:

| Plan | Monthly Price ID               | Yearly Price ID               |
| ---- | ------------------------------ | ----------------------------- |
| Team | `STRIPE_PRICE_ID_TEAM_MONTHLY` | `STRIPE_PRICE_ID_TEAM_YEARLY` |
| Lab  | `STRIPE_PRICE_ID_LAB_MONTHLY`  | `STRIPE_PRICE_ID_LAB_YEARLY`  |

## 2. Create Webhooks

You need **two** webhook endpoints in Stripe:

### Webhook 1 - Auth/Subscription Events

Used by Better Auth stripe plugin for subscription lifecycle.

- **URL:** `https://corates.org/api/auth/stripe/webhook`
- **Events:**
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- **Secret:** Copy signing secret to `STRIPE_WEBHOOK_SECRET_AUTH`

### Webhook 2 - Purchase Events

Used for one-time purchases and additional billing events.

- **URL:** `https://corates.org/api/billing/webhooks/stripe`
- **Events:**
  - `checkout.session.completed`
  - `invoice.paid`
  - `invoice.payment_failed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
- **Secret:** Copy signing secret to `STRIPE_WEBHOOK_SECRET_PURCHASES`

## 3. Get API Keys

From [Stripe API Keys](https://dashboard.stripe.com/apikeys):

- Copy your **Secret key** (starts with `sk_live_` for production)
- This becomes `STRIPE_SECRET_KEY`

## 4. Set Production Secrets

Run these commands from `packages/workers`:

```bash
# Core Stripe secret
wrangler secret put STRIPE_SECRET_KEY --env production

# Webhook secrets (one for each endpoint)
wrangler secret put STRIPE_WEBHOOK_SECRET_AUTH --env production
wrangler secret put STRIPE_WEBHOOK_SECRET_PURCHASES --env production

# Price IDs
wrangler secret put STRIPE_PRICE_ID_TEAM_MONTHLY --env production
wrangler secret put STRIPE_PRICE_ID_TEAM_YEARLY --env production
wrangler secret put STRIPE_PRICE_ID_LAB_MONTHLY --env production
wrangler secret put STRIPE_PRICE_ID_LAB_YEARLY --env production
```

## 5. Configure Customer Portal

The Stripe Customer Portal allows users to manage their subscriptions, update payment methods, and view invoices.

1. Go to [Customer Portal Settings](https://dashboard.stripe.com/settings/billing/portal)

2. **Branding:**
   - Upload your logo
   - Set brand colors to match CoRATES
   - Add support email and phone (optional)

3. **Features to Enable:**
   - Update subscriptions: **Yes** (allows plan changes)
   - Cancel subscriptions: **Yes** (with cancellation reasons)
   - Update payment methods: **Yes**
   - View invoice history: **Yes**

4. **Subscription Cancellation:**
   - Allow customers to cancel: **Yes**
   - Cancellation reasons: Enable and add relevant options
   - Prorate cancellations: **Yes** (recommended)

5. **Plan Switching:** leave off. Plan changes for existing subscribers are
   made in-app by swapping the price on the subscription, so the portal's
   product list does not need to track price changes.

6. **Save Configuration**

The portal URL is generated dynamically via the `/api/billing/portal` endpoint.

## Environment Variables Reference

| Variable                          | Description                                        |
| --------------------------------- | -------------------------------------------------- |
| `STRIPE_SECRET_KEY`               | Stripe API secret key (`sk_live_*` or `sk_test_*`) |
| `STRIPE_WEBHOOK_SECRET_AUTH`      | Signing secret for auth webhook endpoint           |
| `STRIPE_WEBHOOK_SECRET_PURCHASES` | Signing secret for purchases webhook endpoint      |
| `STRIPE_PRICE_ID_TEAM_MONTHLY`    | Price ID for Team monthly plan                     |
| `STRIPE_PRICE_ID_TEAM_YEARLY`     | Price ID for Team yearly plan                      |
| `STRIPE_PRICE_ID_LAB_MONTHLY`     | Price ID for Lab monthly plan                      |
| `STRIPE_PRICE_ID_LAB_YEARLY`      | Price ID for Lab yearly plan                       |
