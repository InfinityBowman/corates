# Pricing restructure rollout (issue #659)

Status: in progress (Stripe products and secrets done, subscriber and D1 pending)
Branch: `feat/pricing-restructure`
Last updated: 2026-09-06

The code on the branch already targets the new tiers. This document is the
runbook for everything outside the repo, in the order it has to happen.

## Production state before rollout

Read from prod D1 and live Stripe on 2026-09-06.

| Item                                                       | Count |
| ---------------------------------------------------------- | ----- |
| Organizations                                              | 42    |
| Projects                                                   | 5     |
| `subscription` rows: `starter_team` active (Stripe, $8/mo) | 1     |
| `subscription` rows: `unlimited_team` active (admin-made)  | 1     |
| `subscription` rows: `team` incomplete (never paid)        | 1     |
| Live `trial` grants, unexpired                             | 2     |

Live Stripe has `CoRATES Team` (`prod_Tp18uRBS70fvE9`) at the old $29/month
and $290/year. The new Team prices are $30/month and $300/year, so both
products need new prices. It has no Lab product.

## 1. Stripe products (done 2026-09-06)

Live account, used by production:

| Product      | Id                    | Monthly price                    | Yearly price                     |
| ------------ | --------------------- | -------------------------------- | -------------------------------- |
| CoRATES Team | `prod_VD9Z0ODxvxyMHb` | `price_1UCjFxCoCKvs2wg8NKRgIKN8` | `price_1UCjFxCoCKvs2wg8f21qUW7i` |
| CoRATES Lab  | `prod_VD9Z9paysc7tka` | `price_1UCjFyCoCKvs2wg8uUrGc7Fz` | `price_1UCjFyCoCKvs2wg8KiVL460U` |

Main account test mode, used by staging (its key is the main account's test
key, not the sandbox that local dev uses):

| Product      | Id                    | Monthly price                    | Yearly price                     |
| ------------ | --------------------- | -------------------------------- | -------------------------------- |
| CoRATES Team | `prod_VD9agijHO2DXpA` | `price_1UCjH5CoCKvs2wg8sh7X4pV4` | `price_1UCjH5CoCKvs2wg8Ez5zFzZv` |
| CoRATES Lab  | `prod_VD9ajygT85CDKY` | `price_1UCjH6CoCKvs2wg8c0xnVt4i` | `price_1UCjH6CoCKvs2wg8cyXrwP63` |

The old live products (`CoRATES Starter Team`, the $29/$290 `CoRATES Team`,
`CoRATES Unlimited`, `CoRATES Single Project`) are still active. Archive them
in the dashboard after the subscriber below has been moved; archiving keeps
existing subscriptions alive.

## 2. Secrets (done 2026-09-06)

The four `STRIPE_PRICE_ID_TEAM_*` and `STRIPE_PRICE_ID_LAB_*` secrets are set
on the web worker for staging and production, and both env files carry them.
The retired `STARTER_TEAM`, `UNLIMITED_TEAM`, and `SINGLE_PROJECT` secrets are
still present on Cloudflare because the currently deployed worker throws
without them. Delete them once the branch is in production:

```bash
for k in STRIPE_PRICE_ID_STARTER_TEAM_MONTHLY STRIPE_PRICE_ID_STARTER_TEAM_YEARLY \
         STRIPE_PRICE_ID_UNLIMITED_TEAM_MONTHLY STRIPE_PRICE_ID_UNLIMITED_TEAM_YEARLY \
         STRIPE_PRICE_ID_SINGLE_PROJECT; do
  npx wrangler secret delete "$k" --env staging
  npx wrangler secret delete "$k" --env production
done
```

## 3. Migrate the one paying subscriber

Subscription `sub_1Ti84CCoCKvs2wg8VYLidG7W` is on Starter Team at $8/month with
the current period ending 2026-09-14. Better Auth resolves the plan from the
price id on every webhook, so once Starter Team's price is no longer in the
plan list, the row would stop syncing. Move the Stripe subscription to the Team
monthly price and grandfather the $8 with a permanent coupon:

```bash
# 1. Coupon that takes the Team monthly price back down to $8
curl -u "$KEY:" https://api.stripe.com/v1/coupons \
  -d amount_off=2200 -d currency=usd -d duration=forever \
  -d name="Grandfathered Starter Team"

# 2. Swap the price, no proration, keep the billing anchor
curl -u "$KEY:" https://api.stripe.com/v1/subscriptions/sub_1Ti84CCoCKvs2wg8VYLidG7W \
  -d "items[0][id]=<subscription item id>" \
  -d "items[0][price]=<STRIPE_PRICE_ID_TEAM_MONTHLY>" \
  -d proration_behavior=none \
  -d "discounts[0][coupon]=<coupon id>"
```

The webhook then rewrites the DB row with `plan = 'team'`. If it does not, the
D1 statement in the next step covers it.

## 4. Prod D1

```sql
UPDATE subscription SET plan = 'team' WHERE plan = 'starter_team';
UPDATE subscription SET plan = 'enterprise' WHERE plan = 'unlimited_team';
DELETE FROM subscription WHERE plan = 'team' AND status = 'incomplete';
```

The second statement keeps the admin-provisioned org on unlimited quotas. The
incomplete row never paid and would otherwise sit in the table under the new
Team id.

Run via `npx wrangler d1 execute corates-db-prod --remote --env production`
from `packages/web`.

## 5. Deploy

Merge to main. Staging deploys first, then e2e, then production.

## Follow-ups not on this branch

- **Workspace rename.** Users should see "workspace" instead of
  "organization", following Linear. That is a copy and route change across the
  app and belongs in its own PR; the internal `organization` tables and
  `orgId` stay.
- **Project archiving.** Needed before the cards can say "concurrent
  projects".
- **Free projects per user.** Each org gets a free project, and users can
  create extra orgs. Decide whether to cap free projects per user or restrict
  the free project to personal orgs.
- **`stripe-purchases` worker.** It only fulfils single-project checkout
  sessions, which can no longer be created. It can be retired along with its
  CI deploy steps and `STRIPE_WEBHOOK_SECRET_PURCHASES`.
- **Grafana billing dashboard.** Panels for
  `billing.single_project_checkout_initiated` and `billing.trial_started`
  will go flat and can be removed.
