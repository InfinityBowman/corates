---
title: Local Sync Engine (Non-Yjs Data)
date: 2026-01-07
author: Team
status: draft
---

## Goal

Add offline-first, resilient sync for non-Yjs data (project/org metadata, memberships, settings, op queue, PDF metadata) without adopting Convex or Dexie Cloud. Keep Workers + Drizzle as source of truth, Better Auth for auth, Yjs for collaborative docs.

## Scope

- In scope: project metadata, org membership, user/org settings, op queue for offline mutations, optional PDF cache metadata (not blobs).
- Out of scope: billing/subscription writes, large blobs (PDF content stays in R2), Yjs documents (already handled), admin tooling.

## Requirements

- Offline writes: queue mutations locally; replay with idempotency when online.
- Conflict handling: server authoritative; use last-writer-wins with server timestamps for metadata; strict validation for membership and permissions.
- Pull updates: incremental fetch by `updatedAt` + pagination; staleness detection for UI.
- Local-first reads: serve from IndexedDB; background refresh.
- Security: reuse Better Auth tokens; enforce entitlements on server; no new public sync surface.
- Observability: log retries, drops, conflicts; expose counters for UI diagnostics.
- No legacy data migration needed (app not in production); focus only on forward schema changes.

## Data Model (local Dexie/y-dexie)

- `projects`: id, orgId, name, description, updatedAt
- `memberships`: id, projectId, userId, role, updatedAt
- `settings`: key, value, scope (user/org), updatedAt
- `ops` (mutation queue): id (uuid), endpoint, payload, status (pending|syncing|applied|failed), attempts, lastAttempt, error, createdAt
- `pdfMeta` (optional): id (projectId:studyId:fileName), size, etag/hash, cachedAt

## Architecture Options

### Option A: Dexie local cache + op queue (recommended)

- Local Dexie DB for cache + ops.
- Writes: enqueue op with idempotency key; optimistic local apply; background replay to existing API routes; mark applied/failed.
- Reads: from local cache first; background fetch to refresh.
- Pros: minimal backend change; leverages existing routes and auth; good offline UX.
- Cons: build/maintain queue + retry logic; need careful error handling.

### Option B: y-dexie unified store (if migrating Yjs persistence later)

- Use y-dexie so Y Docs share the same Dexie DB with metadata and ops.
- Pros: single DB for all offline data; easier cleanup per project; consistent tooling.
- Cons: adds y-dexie dependency; requires changing Yjs persistence when/if we opt in.

### Option C: Pull-only cache (no op queue)

- Only cache reads; no offline writes.
- Pros: simplest; no conflict handling.
- Cons: no offline mutations; limited value vs current caching.

### Option D: CRDT for settings/meta (selective)

- Apply small CRDTs (e.g., register LWW) for settings where merges matter; still use op queue for writes.
- Pros: safer merges for user/org preferences.
- Cons: added complexity; likely unnecessary if server LWW suffices.

## Flow (Option A)

1. **Enqueue mutation**: UI calls `enqueueOp({ endpoint, payload, idempotencyKey })`; store in `ops` with status `pending`.
2. **Optimistic apply**: update local Dexie tables to reflect expected state.
3. **Replay worker**: background process drains pending ops; sends to existing Workers endpoints with idempotency key header; marks `syncing` -> `applied` | `failed`.
4. **Pull sync**: periodic `GET /api/orgs/:orgId/projects?updatedAfter=...` and similar for memberships/settings; upsert into Dexie; bump `lastSyncedAt`.
5. **Staleness**: store `lastSyncedAt` per table; UI can show “may be stale” when over threshold.
6. **Backoff & errors**: exponential backoff; cap attempts; surface errors to UI; allow manual retry.

## Conflict Strategy

- Metadata/settings: last writer wins using server `updatedAt`. Client sends `if-unmodified-since` to detect stale writes optionally.
- Membership: server validates permissions; rejects conflicting role/destroy ops; client retries or surfaces error.
- Op idempotency: include `Idempotency-Key` header; server treats duplicates safely.

## Security

- All writes go through existing auth/entitlement checks.
- Do not expose new sync endpoints; reuse existing routes.
- Encrypt nothing locally (unless later needed); keep PII minimal in cache; allow wipe on logout.

## Migrations (forward-only)

- Version Dexie schema; apply forward migrations on load (no legacy data to preserve).
- If adopting y-dexie later, switch persistence without backfilling legacy data (none in production).
- Provide cache reset utility for irrecoverable states.

## Testing

- Unit: op state machine, backoff, idempotency, local upsert logic.
- Integration: offline/online flip, auth expiry mid-replay, conflict rejection paths.
- E2E: simulated network loss while enqueuing and replaying; ensure UI stays consistent.

## Rollout Plan

1. Implement Dexie DB + `ops` queue + basic replay (projects list, memberships).
2. Add pull sync with `updatedAfter` filters; cache-first reads in hooks.
3. Add UI surfacing for pending/failed ops.
4. Expand to settings and pdfMeta (metadata only).
5. Optional: migrate Yjs persistence to y-dexie for single-DB story.

## Pros / Cons (Recommended Option A)

- Pros: Offline write support; reuses existing backend; incremental rollout; modest dependencies.
- Cons: Custom queue logic to maintain; needs thorough error/conflict handling; adds local storage surface area.
