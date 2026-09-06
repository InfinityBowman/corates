# Pricing restructure rollout (issue #659)

Status: complete (2026-09-06). Kept as the record of what was done and why.
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

## 3. Migrate the one paying subscriber (done 2026-09-06)

Subscription `sub_1Ti84CCoCKvs2wg8VYLidG7W` was on Starter Team at $8/month.
It now carries the Team monthly price with the permanent coupon `T5SdjMlE`
($22 off), so the next invoice on 2026-09-14 previews at $8. No proration was
charged. The old live products are archived.

## 4. Prod D1 (done 2026-09-06)

```sql
UPDATE subscription SET plan = 'team' WHERE plan = 'starter_team';
UPDATE subscription SET plan = 'enterprise' WHERE plan = 'unlimited_team';
DELETE FROM subscription WHERE plan = 'team' AND status = 'incomplete';
```

One row each. The webhook had not rewritten the subscriber's row after the
Stripe change, so the SQL did it.

## 5. Deploy (done 2026-09-06)

Shipped as #668, with #673 and #674 fixing the e2e suite (plan names, and a
direct price change in place of the customer portal flow) and #676 moving to
lookup keys. Production verified after each deploy.

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
- **`stripe-purchases` worker.** Retired in #672 along with its CI deploy
  steps and `STRIPE_WEBHOOK_SECRET_PURCHASES`. Subscription status already
  synced through Better Auth; the worker's dunning email and Stripe customer
  sync went with it.
- **Grafana billing dashboard.** Panels for
  `billing.single_project_checkout_initiated` and `billing.trial_started`
  will go flat and can be removed.
