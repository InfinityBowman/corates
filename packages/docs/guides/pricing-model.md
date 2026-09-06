# CoRATES pricing model

Status: current
Last updated: 2026-09-06

Source of truth for the tiers, prices, and quotas shown in the app. Code that
must match this document: `packages/shared/src/plans/` (plans, pricing,
catalog, Stripe metadata). Issue #659 has the discussion behind the restructure.

## Positioning

CoRATES is an affordable, accessible alternative to premium systematic review
tools. Individuals appraise for free, small teams pay a flat annual price with no
per-seat billing, and consultancies and institutions are quoted by contact.

Annual is the default billing interval and is priced so the per-month figure
shown on the card is a whole number. Monthly is twelve months for the price of
ten; the UI states that as the percentage saved (17%) rather than a dollar
amount.

## Tiers

| Tier       | Price                   | Projects  | Collaborators | Notes                                          |
| ---------- | ----------------------- | --------- | ------------- | ---------------------------------------------- |
| Free       | $0                      | 1         | 3             | Unlimited studies. Solo appraisals unlimited.  |
| Team       | $300/year or $30/month  | 3         | Unlimited     | Most popular. Shown as $25/month annually.     |
| Lab        | $900/year or $90/month  | 10        | Unlimited     | Priority support. Shown as $75/month annually. |
| Enterprise | Contact us, annual only | Unlimited | Unlimited     | Provisioned by hand in the admin UI.           |

Enterprise covers two shapes, quoted rather than sold self-serve. The card and
FAQ show no number, only "Annual billing only"; these are internal quoting
anchors:

- **Consultancy**, around $2,500/year. Unlimited projects, everything in Lab,
  priority support, invoice billing.
- **Institution**, around $6,000/year. Site-wide access for every lab and
  course. Room to discount for smaller schools and go higher for large ones.

A **course license** is arranged by contact and presented as discounted, with
$200/semester as the internal anchor. It can be
provisioned as an Enterprise or Lab subscription with a period end matching the
term.

Collaborators never pay. A collaborator is any non-owner member of the owning
organization.

## What every tier keeps

- Solo appraisals in the browser stay unlimited and free, with no account.
- Completed appraisals stay readable and exportable on every tier. A lapsed
  subscription drops the org to Free quotas but does not lock existing projects.
- Plan changes that would leave an org over quota are blocked until the org
  reduces usage (see `validatePlanChange`).

## Plan ids

`PlanId` is `free | team | lab | enterprise`. The id is stored in the
`subscription.plan` column and in the Better Auth Stripe plugin's plan list, so
renaming an id or changing its quotas changes what existing subscribers get.
Introduce a new id rather than repurposing one.

Enterprise has no Stripe price. Admins create the subscription row directly
from the org page in the admin UI.

## Grants

`trial` and `single_project` grants still exist in the schema and the billing
resolver, but they are no longer sold. Admins can issue them from the org page
for support cases. The self-serve trial and the one-time single project
purchase were removed when Free gained a project.

## Stripe

Two products, each with a monthly and a yearly price:

| Plan | Product name | Env vars                                                      |
| ---- | ------------ | ------------------------------------------------------------- |
| Team | CoRATES Team | `STRIPE_PRICE_ID_TEAM_MONTHLY`, `STRIPE_PRICE_ID_TEAM_YEARLY` |
| Lab  | CoRATES Lab  | `STRIPE_PRICE_ID_LAB_MONTHLY`, `STRIPE_PRICE_ID_LAB_YEARLY`   |

Test mode products are created by `pnpm stripe:setup` in `packages/web`, which
reads the price amounts from `@corates/shared/plans`. See
[stripe-setup.md](./stripe-setup.md) for production.

## Not built yet

These were discussed in #659 and deliberately left off the cards until they
ship:

- Project archiving. Quotas count every project in the org. "Concurrent
  projects" wording waits on an archive feature.
- Roles beyond owner/member, audit log export, SSO, invoicing automation.
- A cross-org cap on free projects. Each org resolves billing separately, so a
  user who creates extra organizations gets a free project in each.
