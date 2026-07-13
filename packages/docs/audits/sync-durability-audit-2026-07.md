# Sync Durability Audit - July 2026

Motivated by the stranded-backlog incident (a reviewer's checklist answers
repeatedly pushed to the ProjectDoc DO but never surviving eviction, while
statuses persisted fine). This documents every sync failure mode we know
about, which ones are covered by tests, what was changed, and what remains.

## Architecture recap

- Client: y-websocket provider (`packages/web/src/primitives/useProject/connection.ts`)
  over a Y.Doc persisted locally in IndexedDB via DexieYProvider.
- Server: ProjectDoc DO with hibernatable websockets. Updates persist to a
  `yjs_updates` SQLite table as incremental rows (`kind='update'`), compacted
  into 512 KiB chunked snapshots (`kind='snapshot'`) at 500 rows.
- Handshake: on connect the server proactively sends SyncStep2; on the first
  inbound message it sends SyncStep1 so the client pushes anything the server
  lacks (the #521 fix). On hibernation wake it sends SyncStep1 to all
  surviving sockets.

## Failure-mode inventory

Tests live in `packages/workers/src/durable-objects/__tests__/`
(ProjectDoc.backlog-sync.test.ts, ProjectDoc.realws-sync.test.ts,
ProjectDoc.sync-pull.test.ts).

| # | Failure mode | Outcome today | Test |
|---|--------------|---------------|------|
| 1 | Offline backlog pushed via handshake, DO restarts | Survives (persisted row or snapshot) | backlog-sync 1, realws 1 |
| 2 | Backlog update ~1 MB | Survives | backlog-sync 2 |
| 3 | Backlog update > 2.2 MB (SQLite value cap, enforced identically in local workerd) | WAS silently lost on eviction; now persisted via forced chunked snapshot | backlog-sync 3 |
| 4 | Insert fails (SQL error) | WAS silently lost; now forced snapshot fallback | backlog-sync 4 |
| 5 | Insert AND snapshot fallback both fail | Retried on every subsequent update via `forceCompactPending` flag | backlog-sync 5 |
| 6 | Corrupt persisted update row | WAS a permanent "internal error" on every request; now skipped with `persistence_corrupt_update_row` report | backlog-sync 6 |
| 7 | Corrupt snapshot chunk | Fails loudly on EVERY request (doc reset on load failure; previously the first failure left a partial doc in memory that later calls silently served) | backlog-sync 7 |
| 8 | Update whose same-client predecessor was lost | Pending structs: content invisible, but the delete set applies immediately so existing values can read as undefined; handshake heals | backlog-sync 8 |
| 9 | Dead-socket answers + live-session status (the production incident shape) | Status visible, answers absent; reconnect handshake recovers | backlog-sync 9 |
| 10 | True eviction / hibernation wake (evictDurableObject) | Storage reload correct, hibernated sockets wake the DO and keep working | realws 1 |
| 11 | Second client converging on another client's backlog | Converges via proactive SyncStep2 + handshake | realws 2 |
| 12 | Malformed frames (truncated sync payload, unknown type, raw noise, string frame) | Captured and dropped; same socket and healthy peers keep working | realws 3 |
| 13 | Client-side throw while applying server sync or encoding the reply | WAS invisible (y-websocket has no error handling; the client simply never answers SyncStep1, so its edits never push); now captured to Sentry with projectId | manual (client) |

### Not testable locally

| Failure mode | Why | Mitigation |
|--------------|-----|------------|
| Websocket message > 1 MiB through the Cloudflare edge (local workerd allows 32 MiB) | Edge-enforced transport cap | A stranded backlog between ~1 MiB and the SQLite cap can never push over the socket in production. Needs a staging test, and ultimately an HTTP force-push path that bypasses the socket. |
| DO out-of-memory (128 MB isolate) during a huge SyncStep2 apply | Not enforced locally | `getStorageStats()` exposes `memoryUsagePercent`; watch it in the admin dashboard. |
| Real auto-eviction timing under load | Local eviction is only explicit | Covered logically by evictDurableObject tests. |

## Changes made in this pass

1. **Persist before broadcast** (`ProjectDoc.ts` update handler). DO output
   gates hold outgoing messages behind storage writes initiated before the
   send. Persisting first means connected clients can only observe updates
   that durably landed; the old broadcast-first order let clients see state
   that a failed write then discarded.
2. **forceCompact retry flag.** If the snapshot fallback itself fails, the DO
   retries it on every subsequent update instead of waiting for the 500-row
   compaction threshold (an eviction-sized window).
3. **Doc reset on load failure.** A corrupt snapshot now fails consistently
   and loudly instead of leaving a silently-partial doc in memory.
4. **Client sync-handler error capture** (`connection.ts`). Sync message
   handler (type 0) wrapped with Sentry capture, mirroring the existing
   awareness wrap. This closes the biggest diagnosis blind spot from the
   incident: a client that throws mid-handshake looks like a healthy session
   with zero errors.

## Recommended next steps (not yet built)

Ordered by expected value:

1. **State-vector integrity check (self-healing + observable).** After the
   client reaches `synced`, compare the server's advertised state vector with
   the local one. If the server is still missing local state after a grace
   period, capture a Sentry event with both vectors and re-send SyncStep2.
   This turns any future "answers missing server-side" bug, whatever its
   cause, into an alert within minutes instead of a customer report weeks
   later.
2. **Authenticated HTTP force-push/pull endpoint.** Client POSTs its full
   encoded doc state, DO merges; and the reverse for pulls. Bypasses the
   1 MiB edge websocket cap (the one transport failure local tests cannot
   reach) and doubles as the recovery tool for stranded clients.
3. **Completed-but-empty guardrail in the UI.** A checklist in
   reviewer-completed status with zero answers is always a sync defect; the
   reconcile and completed tabs should flag it instead of rendering blank
   panels. Cheap, and it converts silent data loss into a visible state.
4. **Periodic doc export to R2.** A daily (or on-compaction) copy of
   `Y.encodeStateAsUpdate(doc)` per active project gives point-in-time
   disaster recovery for the unrecoverable cases (corrupt snapshot, #7).
5. **Staging transport test.** Script a >1 MiB SyncStep2 push against
   staging.corates.org to pin down the edge cap behavior (close code, client
   observable) so the client can detect and route around it.
6. **Sentry DSN for staging** (currently console-only to Workers Logs) so
   staging soak tests report through the same pipeline as production.

## Operational notes

- Log events to watch: `persistence_update_oversized`,
  `persistence_insert_failed`, `force_compaction_failed`,
  `persistence_corrupt_update_row`, `compaction_failed`. The first two firing
  without a subsequent `force_compaction_failed` means the fallback saved the
  data.
- Admin diagnostic: `GET /api/admin/project-doc-info?projectId=...` dumps the
  DO's view (checklist statuses + answers) for comparison against what a
  client claims to have.
- Test-writing gotchas (also in the durable-objects skill testing reference):
  a live DO instance and its SQL rows survive across tests within a file even
  after clearing KV storage; always use a unique DO name per test.
