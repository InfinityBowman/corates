---
title: Local-First Sync Strategy (CoRATES)
date: 2026-01-07
author: Team
---

## Summary

This document describes a pragmatic strategy to keep the `web` client and the `workers` backend in sync for a local-first application. It covers which data must stay synchronized, recommended synchronization primitives (CRDTs, event-log, snapshots), contract and versioning practices, offline/queue handling, security considerations, testing, and a small rollout roadmap.

**Goals**

- Preserve local-first UX (work offline, seamless conflict resolution for collaborative docs).
- Keep client and server types and validation in strict alignment.
- Minimize forced client upgrades while retaining a safe migration path.
- Maintain robust security (auth, SSRF, input validation) and observability for sync problems.

## Scope

- Applies to `packages/web` (client) and `packages/workers` (server) in this repo.
- Emphasizes document-level collaboration, operation queues (mutations), auth/session state, derived indexes and query caches, and attachments.

## What must stay in sync (priority order)

- Live collaborative documents and checklist state (CRDT — Yjs)
- Operation queues / mutation logs (client-driven commands)
- Auth/session & user profile state (authoritative on server)
- Query cache / persisted IndexedDB snapshots (client caches)
- Derived server-side indexes, summaries, and search
- Attachments and signed URL availability

## Recommended primitives and when to use them

- CRDTs (Yjs): document bodies, checklist items, real-time multi-user edits.
- Event-log / append-only ops: user actions that are not easy CRDTs (e.g., domain-specific commands, exports, server-only transforms).
- Snapshot + deltas: large state (search indexes, generated summaries) where streaming every op is expensive.
- REST endpoints: commands, file upload, server reconciliation, and metadata.
- Optional GraphQL: read-heavy aggregations if the UI requires highly flexible client-shaped queries. Not recommended for primary CRDT sync.

## Contracts and validation

- Keep canonical DTOs and Zod schemas in `packages/shared` and import them from both `web` and `workers`.
- Publish and maintain `openapi.json` from the `workers` package; generate TypeScript clients and runtime validators for the web build in CI.
- Server must validate every incoming payload with Zod and fail fast with clear error codes (use the existing error helpers).

## Versioning, compatibility and forcing updates

- Use semantic API versioning for breaking changes and keep changes additive-first.
- Add a small metadata endpoint `/api/metadata` or `/api/compat` that returns:
  - `apiVersion` (server)
  - `minSupportedClient` (semver)
  - `features`/capabilities
- Client reports its `clientVersion` on requests (header) and performs a boot-time check. If the server responds that the client is too old, the client shows a blocking upgrade UI.
- Service worker & BroadcastChannel based approach: server changes `minSupportedClient` — SW detects it and broadcasts a force-reload message to all tabs. This is less disruptive than immediate hard-blocks.
- Server-side adapters: provide temporary acceptance of legacy payloads for a migration window, translating to the canonical model.

## Offline-first & operation queue

- Persist a local operation queue in IndexedDB (attach idempotency keys and causal metadata).
- On reconnect, replay queued operations in order to a reconciliation endpoint (server validates and returns canonical state/checkpoint).
- Provide per-op status (pending, syncing, applied, failed) and UI feedback for conflicts or retries.

## Query cache hygiene

- On auth or session changes, clear in-memory query cache (`queryClient.clear()`), clear persisted caches (`clearPersistedQueryCache()`), and trigger `session().refetch()` (already implemented in `better-auth-store`).
- Expose a `cacheVersion` server-side value in `/api/metadata`; clients can force invalidate persisted caches if `cacheVersion` changes.

## Security

- Server-side must re-validate everything (Zod), never trust client
- Keep SSRF protection for proxy endpoints (already implemented in `packages/workers/src/lib/ssrf-protection.js`).
- Require auth for mutation endpoints, and rate-limit or challenge suspicious sync clients.

## CI / Developer workflows

- Generate and commit client types from `openapi.json` during CI; fail PRs if generated types diverge.
- Add unit tests that exercise generated client against a local worker (or mocked OpenAPI responses).
- Linting and schema checks: enforce Zod schemas for incoming request validation in `workers`.

## Testing and monitoring

- Integration tests for:
  - Yjs document sync via Durable Objects or WebSocket relay
  - Offline queue replay and idempotency checks
  - Version negotiation and forced upgrade flows
- Add telemetry for: client-version distribution, number of queued ops per client, sync failure rates, backlog size, and time-to-replay.

## Migration & rollout strategy

1. Add `minSupportedClient` to `/api/metadata` and ship server-side capability flags.
2. Add client-side boot check + non-blocking UI banner for deprecation.
3. For breaking changes: provide server-side adapter accepting old payloads for a 2–8 week window while migrating clients.
4. After the window, bump `minSupportedClient` and use SW/BroadcastChannel to force updates.

## Roadmap (concrete next steps)

1. Inventory repo: list endpoints, identify which domains use Yjs vs REST (I can generate this list).
2. Move canonical Zod DTOs to `packages/shared` and import them in server & client.
3. Add `/api/metadata` and expose `minSupportedClient` and `cacheVersion`.
4. Add CI job that regenerates client types from `openapi.json` and fails if uncommitted.
5. Implement an IndexedDB-backed op queue library and a server reconciliation endpoint.
6. Add monitoring for client-version and sync metrics.

## Risks & tradeoffs

- CRDTs (Yjs) add complexity but are the best UX for real-time document collaboration.
- GraphQL can simplify client query shapes but complicates offline persistence and cache invalidation for local-first apps.
- Forcing upgrades is disruptive; prefer staged rollout with server adapters and telemetry-driven cutoff.

## Appendix: recommended endpoints

- `GET /api/metadata` → { apiVersion, minSupportedClient, cacheVersion, features }
- `POST /api/sync/ops` → accept op batches and return { checkpoint }
- `POST /api/reconcile/doc/:id` → server reconciliation for doc snapshots

---

If you want, I can: (A) generate the endpoint inventory now, (B) move selected Zod schemas to `packages/shared`, or (C) scaffold `/api/metadata` and CI typegen. Which should I start?
