# Stripe payment implementation plan

This plan covers implementing Stripe subscriptions for CoRATES.

## Summary

- Add a `subscriptions` table (or org-scoped equivalent) in D1.
- Implement Workers routes for:
  - checkout session creation
  - customer portal session creation
  - webhook handling
  - reading current subscription state
- Implement frontend billing UI (pricing table, current subscription card, upgrade flow).
- Add entitlement checks on the backend and feature gating on the frontend.
- Make webhook handling idempotent and treat Stripe as the source of truth.

## Canonical source

The full detailed plan currently lives at:

- `docs/plans/stripe-implementation.plan.md`
