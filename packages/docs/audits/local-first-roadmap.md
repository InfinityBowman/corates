---
title: Local-First Sync Roadmap (CoRATES)
date: 2026-01-07
author: Team
---

This roadmap turns the strategy from `docs/plans/local-first-sync-strategy.md` into a concrete, time-boxed plan with owners, milestones, and acceptance criteria. It is intentionally pragmatic: ship small, measure, and expand.

Timeline overview

- Immediate (0–2 weeks)
  - Inventory endpoints and sync domains (who owns which endpoints).
  - Add `GET /api/metadata` scaffold returning `{ apiVersion, minSupportedClient, cacheVersion, features }`.
  - Add boot-time client check against `minSupportedClient` and non-blocking UI banner.
  - Move a small set of canonical Zod schemas into `packages/shared` (start with user/session DTOs).

- Short (2–8 weeks)
  - CI: generate TypeScript client from `openapi.json` and fail PRs if out-of-date.
  - Implement `cacheVersion` propagation and persisted query invalidation on change.
  - Implement persistent IndexedDB op-queue library (client) and `/api/sync/ops` endpoint (server).
  - Add telemetry for client-version and op-queue backlog size.

- Medium (2–6 months)
  - Move document sync to Yjs Durable Object relay (if not already), add migration plan for doc schema versions.
  - Add server-side reconciliation endpoints and idempotent replay handling.
  - Add integration tests for offline replay, Yjs sync, and forced-upgrade flows.

- Long (6+ months)
  - Harden monitoring/alerting (alerts for high backlog, deprecated-client usage > X%).
  - Full migration of remaining Zod schemas into `packages/shared` and strict CI gating.
  - Optional: evaluate GraphQL for read-heavy aggregation endpoints (pilot only).

Owners & acceptance criteria

- Infrastructure: @backend-owner — scaffold `/api/metadata`, CI typegen, telemetry hooks.
- Client: @frontend-owner — boot-time version check, SW/BroadcastChannel update path, op-queue client library.
- Sync primitives: @sync-owner — Yjs relay, reconciliation endpoints, doc migrations.

Acceptance criteria (per milestone)

- Inventory & metadata scaffold
  - Inventory file committed listing endpoints and whether they use Yjs/REST.
  - `/api/metadata` responds with valid JSON and is documented in OpenAPI.
  - Client shows non-blocking banner when `clientVersion < minSupportedClient`.

- CI typegen
  - `openapi.json` updates produce regenerated client code via CI job.
  - PRs that don't include the regenerated files fail the CI job.

- Op-queue & replay
  - Client persists ops to IndexedDB and can replay to `/api/sync/ops` with idempotency keys.
  - Server accepts op batches, validates with Zod, and returns a checkpoint.
  - Integration test demonstrates offline queue replay success.

Risks & mitigations

- Risk: Forced upgrades will frustrate users. Mitigation: Use staged rollout, server-side adapters, and telemetry-driven cutoff.
- Risk: Yjs migration complexity. Mitigation: Use schemaVersion metadata and one-time server-side migration handlers.

Next immediate tasks (this sprint)

1. Generate endpoint inventory (owner: @backend-owner).
2. Implement `/api/metadata` scaffold and add to OpenAPI (owner: @backend-owner).
3. Add client boot-time check and non-blocking banner (owner: @frontend-owner).
4. Move `user`/`session` Zod schemas into `packages/shared` and update imports (owner: @shared-owner).

Where to record progress

- Use `docs/plans/local-first-sync-strategy.md` for strategy context.
- Use this roadmap file for milestone status and linking PRs.
- Update the repo TODO (project board) with tickets referenced by milestone.

Questions before we start

- Do you want CI to automatically commit generated clients (and require a PR for that change), or should CI only fail and expect authors to commit regeneration output?
- Who should I list as `@backend-owner`, `@frontend-owner`, and `@sync-owner` (I can default to existing repo leads if you prefer).

---

I can now: (A) generate the endpoint inventory, (B) scaffold `/api/metadata` and add OpenAPI entry, or (C) start moving Zod schemas into `packages/shared`. Which should I do next?
