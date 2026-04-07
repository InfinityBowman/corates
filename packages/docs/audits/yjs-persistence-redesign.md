# Yjs Persistence Redesign — ProjectDoc Storage

**Status:** Implemented, tests green, lint/typecheck clean
**Date:** 2026-04-04, revised 2026-04-07 with chunked-snapshot design
**Scope:** `packages/workers/src/durable-objects/ProjectDoc.ts` and its test suite
**Related:** `yjs-sync-pipeline-redesign-a.md` (supersedes the persistence section)

## Revision — 2026-04-07

The original design (single compacted row) hit a ceiling at the 2 MB per-row
DO SQLite limit, which meant projects with > ~100 rich-comment checklists
would fail to compact and eventually brick. Research into partykit's
production Yjs-on-DO implementation revealed the fix: **chunk snapshots
across multiple rows** using a `kind` column and a contiguous-run load
pattern. Decision 2 has been updated; a new "Snapshot chunking" subsection
describes the write and load paths; the Cloudflare limits section now notes
that 2 MB is per-row not per-cell.

We also considered migrating to `y-partyserver` (the Cloudflare-maintained
successor to `y-partykit`) instead of extending our own code. The conclusion
was to stay with our own DO for now — y-partyserver doesn't ship built-in
persistence so we'd still write the chunking layer, `partyserver` is still
pre-1.0 with active breaking changes, and the migration cost (splitting
auth between worker and DO, rewriting tests, ~225 lines of DO code changes)
is not justified right now. A follow-up migration should be revisited once
`partyserver` hits 1.0 or we have non-feature bandwidth.

## Verification Summary

All pre-implementation checks have been run against the actual codebase on branch `yjs-persistence-redesign`. Findings that amended the plan:

- **Sentry is NOT wired into Durable Objects.** `Sentry.withSentry` in `packages/workers/src/index.ts:397` only wraps the fetch handler. All DO code (`ProjectDoc.ts`, `UserSession.ts`) uses plain `console.error`. The plan originally promised "Sentry alerts on persistence failures" — that promise has been removed. Persistence errors log via an injectable `PersistenceLogger` that delegates to `console.error`/`console.warn`, which surface in `wrangler tail` and production log persistence. Wiring DO-wide Sentry instrumentation is a separate follow-up that should touch all existing `console.error` calls in DOs uniformly, not just persistence.

- **`ctx.storage.transactionSync` and `ctx.storage.sql` are confirmed** in the workers-types definitions (`experimental/index.d.ts:759,761`). Signature: `transactionSync<T>(closure: () => T): T`. Synchronous callback only — no `await` inside the transaction closure. Throws propagate up and roll back. Compaction must therefore be fully synchronous: in the chunked-snapshot design (post-revision) compaction is just `Y.encodeStateAsUpdate(doc)` followed by N synchronous SQL `INSERT`s wrapped in a single `transactionSync`.

- **`SqlStorageValue = ArrayBuffer | string | number | null`** — no `Uint8Array` in the valid binding types. Yjs updates (which are `Uint8Array`) must be converted to `ArrayBuffer` at the bind site. Reads come back as `ArrayBuffer` and must be wrapped with `new Uint8Array(ab)` before passing to `Y.applyUpdate` or `Y.mergeUpdates`. See the binding helper in Decision 2.

- **`runInDurableObject` + `state.storage.sql` has no existing usage in the test suite.** Type definitions say it should work, but we'll confirm empirically with a smoke test as the very first test in Decision 8's sub-step order.

- **Existing persistence code paths reviewed.** `initializeDoc` is called from fetch, all RPC methods, all WebSocket lifecycle methods, and all dev methods. The idempotent `if (!this.doc)` guard must be preserved. The `doc.on('update')` handler both broadcasts and persists — only the persist side changes. `awareness.on('update')` does NOT persist and should stay that way. `schedulePersistenceIfNoConnections` can be deleted entirely once writes are synchronous — every RPC mutation already persists via the `doc.on('update')` handler. `persistTimer` and `persistPending` fields can be deleted.

---

## Table of Contents

1. [Verification Summary](#verification-summary)
2. [Problem Statement](#problem-statement)
3. [Background and Confirmed Constraints](#background-and-confirmed-constraints)
4. [Decision 1 — Storage Model](#decision-1--storage-model)
5. [Decision 2 — Schema Design](#decision-2--schema-design)
6. [Decision 3 — Compaction Trigger](#decision-3--compaction-trigger)
7. [Decision 4 — Write Scheduling](#decision-4--write-scheduling)
8. [Decision 5 — Migration Strategy](#decision-5--migration-strategy)
9. [Decision 6 — Error Handling](#decision-6--error-handling)
10. [Decision 7 — Testing Strategy](#decision-7--testing-strategy)
11. [Decision 8 — Implementation Order](#decision-8--implementation-order)
12. [Out of Scope](#out-of-scope)
13. [Verification Results](#verification-results)

---

## Problem Statement

Two real users on two real projects have reported data loss after page refresh: studies and checklists they created or edited disappear after a reload. Investigation traced this to the server-side Yjs persistence layer in `ProjectDoc.ts`.

The current implementation has multiple compounding issues:

1. **Full state rewrite on every flush.** `flushPersistence()` calls `Y.encodeStateAsUpdate(doc)` and writes the entire encoded document on every debounced write. Cost scales with document size, not edit size.

2. **`Array.from(fullState)` inflated storage.** The Uint8Array was being converted to a regular JS Array of numbers before storage, inflating size 3-4x. Already fixed in the previous round of work, but the underlying full-state-write architecture remains.

3. **No error handling on `storage.put()`.** A single failure was silent, with `persistPending` set to `false` before the write attempt so the system thought it had succeeded. Already fixed defensively, but the failure mode would never have been detected by users or telemetry.

4. **`setTimeout`-based debouncing.** `setTimeout` does not survive Durable Object hibernation. The existing audit `yjs-sync-pipeline-redesign-a.md` already flagged this.

5. **Unawaited promise inside `setTimeout`.** `flushPersistence()` returned a promise that was never awaited inside the `setTimeout` callback, so any rejection became an unhandled promise rejection. Already fixed defensively.

This redesign replaces the entire persistence layer with an incremental-update + periodic-compaction model backed by the Durable Object's SQLite storage API. The goal is to make storage cost proportional to edit size (not document size), eliminate the silent-failure modes, and give us headroom for documents up to 10 GB per project.

---

## Background and Confirmed Constraints

### `ProjectDoc` is already SQLite-backed

`packages/workers/wrangler.jsonc:13-26` declares `ProjectDoc` in `new_sqlite_classes`. The KV-style `ctx.storage.put`/`get` API still works, but it's running on SQLite under the hood. We can use the SQL API directly via `ctx.storage.sql.exec(...)`.

### Storage limits (verified against Cloudflare docs)

| Backend                      | Per key+value combined | Per SQL row | Per DO total |
| ---------------------------- | ---------------------- | ----------- | ------------ |
| **SQLite-backed (our case)** | **2 MB**               | **2 MB**    | **10 GB**    |
| KV-backed (legacy, not us)   | 128 KiB                | n/a         | unlimited    |

The 2 MB limit is **per row**, not per cell. This is subtle but important: a row
with `(seq, kind, payload, created_at)` has the payload BLOB competing with the
other columns for the same 2 MB budget. In practice the other columns are tens
of bytes so effective payload headroom is ~1.99 MB, but the design must assume
per-row not per-cell.

The full 10 GB per DO is real and usable — the 2 MB limit only applies to a
single row. A document larger than 2 MB must be split across multiple rows
(see "Snapshot chunking" below).

Sources:

- [SQLite-backed Durable Objects general limits](https://developers.cloudflare.com/durable-objects/platform/limits/)
- [Access Durable Objects Storage](https://developers.cloudflare.com/durable-objects/best-practices/access-durable-objects-storage/)
- [SQLite Storage API](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/)
- [Zero-latency SQLite in Durable Objects](https://blog.cloudflare.com/sqlite-in-durable-objects/)

### Prior art: PartyKit / y-partyserver

PartyKit (now owned by Cloudflare as `cloudflare/partykit`) hit this exact
problem and solved it with fixed-size value chunking at the storage primitive
layer. Their `y-partykit/src/storage.ts` `levelPut` slices every value into
128 KiB chunks under keys like `prefix#000`, `prefix#001`, ...; `levelGet`
does a range scan and concatenates.

The chunked-snapshot design below is the same pattern adapted for a
SQL-backed DO: we use a `kind` column + `seq` ordering instead of a
key-suffix scheme, but the shape is identical — one logical snapshot
becomes N consecutive rows at the storage layer, and the load path
reassembles them transparently.

Source: [`packages/y-partykit/src/storage.ts`](https://raw.githubusercontent.com/partykit/partykit/main/packages/y-partykit/src/storage.ts)
(in the `partykit/partykit` repo; the newer `cloudflare/partykit`
`y-partyserver` package intentionally leaves persistence to the user and
does not ship built-in storage).

### Cost model

- DO SQLite writes: $1.00 per million rows written
- DO SQLite reads: $0.001 per million rows read
- DO storage: $0.20 per GB-month

For a realistic active project (~2 writes/sec averaged over 4 hours/day of editing): roughly $0.87/month per active project at the synchronous-write rate. At small scale this is well under any meaningful cost concern. The cost analysis informed Decision 4.

### Client-side persistence stays as-is

Client uses `y-dexie` over IndexedDB. `y-dexie` already does incremental persistence internally and doesn't have the same bug as the server. Client and server can use different storage backends because Yjs sync protocol is the contract. Browser IndexedDB has effectively unlimited size, so there is no analogous limit pressure on the client. Client-side initialization race conditions are a separate problem to be fixed in a follow-up PR (see [Out of Scope](#out-of-scope)).

---

## Decision 1 — Storage Model

**Question:** Re-encode the full document on every flush, or append incremental updates?

### Options considered

- **A. Full state on every flush** (current). Each write rewrites the whole document. Cost scales with document size.
- **B. Incremental updates only, no compaction.** Append every Y.Doc update as its own row. Loads grow linearly forever as edit history accumulates.
- **C. Incremental updates with periodic compaction.** Append updates as small rows; periodically merge them into a single compacted snapshot row.

### Decision: **C — Incremental updates with periodic compaction**

This is the canonical Yjs persistence pattern (`y-leveldb`, `y-redis`, `y-sqlite`). It is the only option that delivers all three of: bounded write cost per edit, bounded load time, and headroom for documents that grow over months of editing. Compaction adds complexity but the threshold-based policy (Decision 3) keeps it simple and isolated to one method.

---

## Decision 2 — Schema Design

**Question:** What does the SQL schema look like?

### Options considered

- **A. Single table, uniform rows.** Snapshots and incrementals live in the same table. A snapshot is just a "bigger" update.
- **B. Separate snapshot + updates tables.** Explicit separation between the snapshot and unsnapshotted increments.
- **C. Single table with a `type` column** distinguishing snapshots from updates.

### Decision: **A + C hybrid — Single table with a `kind` column**

```sql
CREATE TABLE IF NOT EXISTS yjs_updates (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'update',
  payload    BLOB NOT NULL,
  created_at INTEGER NOT NULL
);
```

`kind` is one of:

- `'update'`: an independent Y.Doc update from `doc.on('update')`. Each row is a self-contained, individually-applyable update.
- `'snapshot'`: a slice of a larger encoded snapshot from `Y.encodeStateAsUpdate(doc)`. A contiguous run of `'snapshot'` rows must be concatenated into one buffer before applying. Used during compaction (Decision 3) and migration (Decision 5) to handle documents that exceed the 2 MB per-row limit.

### Rationale

- **Yjs treats incrementals and full snapshots as the same byte format.** `Y.encodeStateAsUpdate(doc)` returns the same kind of bytes as a small diff. We exploit this for the load path: any single row can be applied with `Y.applyUpdate` directly, _unless_ it's a snapshot chunk.
- **Compaction is `DELETE then INSERT N rows`** in one table within `transactionSync`. Partial failure rolls back cleanly.
- **The load path is one query plus a small state machine** that gathers consecutive snapshot chunks. ~30 lines of straightforward code.
- **It mirrors the partykit pattern** (key-prefix range scan + concatenate), adapted for a SQL backend.
- **`created_at` is cheap and useful** for debugging, time-based queries, and "last edit" diagnostics.

### Why we did NOT use the original "uniform rows" approach (option A alone)

The original design treated snapshots and updates identically, with no `kind`
column. That design works only when an entire compacted snapshot fits in a
single 2 MB row. For projects with ~100+ rich-comment checklists (~5 MB
encoded), compaction would silently fail every time, and we'd accumulate
unbounded `kind='update'` rows. Adding the `kind` column lets compaction
_always_ succeed regardless of snapshot size, at the cost of one TEXT column
per row (negligible).

### Binding Uint8Array to BLOB columns

`SqlStorageValue = ArrayBuffer | string | number | null`. Yjs updates are `Uint8Array`, so bindings must convert to `ArrayBuffer` explicitly. A small helper keeps this out of every call site:

```typescript
function uint8ArrayToBuffer(u8: Uint8Array): ArrayBuffer {
  // If the Uint8Array is a view over a larger buffer, slice it.
  // Yjs-encoded updates are typically standalone, so this is usually a no-op path.
  if (u8.byteOffset === 0 && u8.byteLength === u8.buffer.byteLength) {
    return u8.buffer as ArrayBuffer;
  }
  return u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
}
```

Reads return `ArrayBuffer` from BLOB columns; wrap with `new Uint8Array(ab)` before passing to Yjs.

### What we are not doing

- **No separate metadata table.** Anything we need (row count, last compaction, oldest row) is one cheap aggregate query against `yjs_updates`.
- **No additional indexes.** `seq` is the primary key so ordering is already indexed.
- **No `id` UUID column.** `seq` is monotonic and unique by definition.

### Snapshot chunking

Because a single SQL row is capped at 2 MB, an encoded snapshot that exceeds
that size must be split across multiple rows. Chunk size is a constant:

```typescript
const SNAPSHOT_CHUNK_SIZE = 512 * 1024; // 512 KiB
```

512 KiB is well under the 2 MB cell limit (leaves ample headroom for the
`kind`, `seq`, `created_at` columns). It's bigger than partykit's 128 KiB
because SQL rows have lower per-row overhead than KV entries, and larger
chunks mean fewer rows to scan during cold load.

**Compaction path:**

```typescript
private writeSnapshotChunked(snapshot: Uint8Array): void {
  const chunks = this.chunkSnapshot(snapshot); // slice by SNAPSHOT_CHUNK_SIZE
  const now = Date.now();
  this.ctx.storage.transactionSync(() => {
    this.ctx.storage.sql.exec('DELETE FROM yjs_updates');
    for (const chunk of chunks) {
      this.ctx.storage.sql.exec(
        "INSERT INTO yjs_updates (kind, payload, created_at) VALUES ('snapshot', ?, ?)",
        uint8ArrayToBuffer(chunk),
        now,
      );
    }
  });
}
```

Both DELETE and the N INSERTs happen in a single `transactionSync`. If any
INSERT fails (e.g. a forced-failure test trigger), the whole transaction
rolls back and the pre-compaction rows remain intact — the load path can
still reconstruct the doc from the original updates.

**Load path:**

```typescript
private loadUpdatesIntoDoc(): void {
  const cursor = this.ctx.storage.sql.exec<{ kind: string; payload: ArrayBuffer }>(
    'SELECT kind, payload FROM yjs_updates ORDER BY seq',
  );

  let snapshotChunks: Uint8Array[] = [];
  const flushSnapshot = () => {
    if (snapshotChunks.length === 0) return;
    // Concatenate the chunks and apply as one update. Yjs guarantees this
    // works because encodeStateAsUpdate produces a contiguous byte blob
    // with no internal offsets, so slicing and reconcatenating preserves
    // byte identity.
    const combined = concat(snapshotChunks);
    Y.applyUpdate(this.doc!, combined);
    snapshotChunks = [];
  };

  for (const row of cursor) {
    const bytes = new Uint8Array(row.payload);
    if (row.kind === 'snapshot') {
      snapshotChunks.push(bytes);
    } else {
      flushSnapshot();
      Y.applyUpdate(this.doc!, bytes);
    }
  }
  flushSnapshot();
}
```

The load path walks rows in `seq` order:

- `'update'` rows are applied individually
- Contiguous runs of `'snapshot'` rows are gathered and applied as one update after the run ends

The "contiguous run" design matters because after compaction, the table
has the form `[snapshot, snapshot, ..., snapshot, update, update, ...]` —
all snapshot chunks at the lowest seq values, all new incremental updates
after. The load state machine naturally handles that shape with one
buffer + one applyUpdate per snapshot + one applyUpdate per remaining update.

**Foundation: byte-identical slice/concat.** This design relies on `Y.applyUpdate(concat(slice(encodeStateAsUpdate(doc), N, M) for each chunk))` producing the original doc. Verified directly against Yjs source in `src/utils/encoding.js` and covered by a foundation unit test ("Yjs encoding: slice/concat round-trip") that tests chunk sizes down to 1 byte to prove the varint decoder survives any boundary position.

---

## Decision 3 — Compaction Trigger

**Question:** When do we compact?

### Options considered

- **A. Threshold-based (row count).** Compact synchronously after the insert that crosses N rows.
- **B. Time-based (recurring alarm).** Compact every X minutes regardless of activity.
- **C. Size-based (total accumulated bytes).** Track byte totals; compact when threshold crossed.
- **D. On idle.** Compact when the last WebSocket disconnects.
- **E. Hybrid combinations.**

### Decision: **A + D (hybrid)**

- **Primary:** Threshold-based at **500 rows**, checked after each insert. Compaction runs synchronously inside the write that crossed the line.
- **Secondary:** Opportunistic compaction in `webSocketClose` when the last connection drops, but only if there is a meaningful amount to compact (`> 50` rows). Piggybacks on the existing flush-on-disconnect logic.

### Constants

```typescript
const COMPACTION_ROW_THRESHOLD = 500; // primary trigger
const OPPORTUNISTIC_COMPACTION_MIN = 50; // secondary trigger floor
```

### Rationale

- **Threshold is a direct proxy for cold-load cost.** What we care about is "how slow is the next cold start?" That is a function of row count, not elapsed time. 500 small Yjs updates apply to a warm doc in well under a second on local SQLite.
- **Predictable and bounded.** Cold loads will never apply more than ~500 small updates plus one snapshot, regardless of how active the project is.
- **Synchronous compaction is fine at our scale.** DO operations are single-threaded so compaction briefly blocks other edits, but tens of milliseconds is imperceptible. Single-threaded execution also eliminates any race condition during compaction — nothing else can run on the DO during the transaction.
- **Self-tuning.** Heavy projects compact often; quiet projects compact rarely. No wasted compaction work on dormant documents.
- **On-idle (D) catches the long tail.** A project edited in short bursts may never hit 500 rows in a single session. The on-idle trigger handles those cases for free during natural quiet periods.

### What we rejected

- **Time-based alarms:** Wastes compute on dormant projects; doesn't compact rapidly-edited projects fast enough. Also costs alarm invocations against billing.
- **Size-based:** Strictly more accurate than row count but requires either an aggregate `SUM` query before each insert (expensive) or a separate counter row (sync-fragile). The added complexity is not justified — 500 small Yjs updates is always a small amount of data in practice.

---

## Decision 4 — Write Scheduling

**Question:** Debounce writes, schedule via alarms, or write synchronously?

### Options considered

- **A. Keep `setTimeout` (current).** Lost on hibernation; "safe enough" only because `webSocketClose` flushes synchronously.
- **B. Switch to DO alarms.** Survives hibernation, deploys, crashes. One alarm slot per DO.
- **C. Synchronous insert per Y.Doc update, no debouncing.**
- **D. In-memory accumulator + alarm-based flush.** Batches updates, survives hibernation, but introduces an in-memory window where updates can be lost.

### Decision: **C — Synchronous insert on every Y.Doc update**

```typescript
this.doc.on('update', (update: Uint8Array, origin: unknown) => {
  // Broadcast to other clients (existing behavior)
  this.broadcastBinary(message, origin as WebSocket | null);

  // Persist immediately, synchronously, to local SQLite
  try {
    this.ctx.storage.sql.exec(
      'INSERT INTO yjs_updates (update, created_at) VALUES (?, ?)',
      uint8ArrayToBuffer(update), // SqlStorageValue requires ArrayBuffer
      Date.now(),
    );
    this.maybeCompact();
  } catch (err) {
    this.logger.error('persistence_insert_failed', { error: err });
  }
});
```

### Rationale

- **It is what `y-leveldb` and `y-redis` do.** The most-deployed Yjs persistence layers in production. Neither bothers batching. Local storage is fast enough that the optimization is not worth the complexity.
- **It is the only option that loses zero data the server received.** Options A, B, and D all have a window where updates exist in memory but not on disk. Option C eliminates that window entirely. The whole purpose of this redesign is to stop losing data, so optimizing for data safety should win unless cost is unacceptable.
- **No in-memory state, no alarm scheduling, no flush coordination.** The entire write path is one INSERT. Compaction is the only stateful part.
- **The hibernation problem disappears entirely.** No `setTimeout`, no alarms, no scheduled work. Each update is durable the instant it is processed. The DO can hibernate immediately after any handler returns and lose nothing.
- **Cost is acceptable.** Roughly 5x more writes than batched, but realistic load is ~$0.87/month per active project at the synchronous rate. Not a meaningful cost driver at our scale.
- **Batching is a trivially-added optimization later.** If writes ever dominate cost, adding an in-memory accumulator is ~20 lines isolated to one method. We don't need to design for it now.

### What this removes from the existing code

- `schedulePersistence()`
- `flushPersistence()` (in its current form — the name may be reused for the inline insert)
- `persistTimer`, `persistPending`, `PERSIST_DEBOUNCE_MS`
- The `flush on last disconnect` branch in `webSocketClose` becomes a no-op for normal updates (compaction may still happen there opportunistically)

### Honest disclosure

In the original conversation, I first recommended Option D (in-memory accumulator + alarms) and was over-confident about both the cost savings from batching and the safety net from Yjs eventual consistency. Pushed back, reconsidered, and revised to Option C. The cost savings from batching at our scale are real but small (~$0.70/month per active project), and the "clients re-sync lost updates on reconnect" argument is true in the common case but not bulletproof — incognito users lose IndexedDB on tab close, and a new collaborator joining first would receive stale state. Option C eliminates both concerns by never having an in-memory window.

---

## Decision 5 — Migration Strategy

**Question:** How do we handle existing data in the legacy `yjs-state` KV blob?

**Context:** Two real users with two real projects exist on the current system. Their data must not be lost.

### Options considered

- **A. Inline lazy migration on first wake post-deploy.**
- **B. One-time backfill script** that iterates D1 project IDs and RPCs each DO.
- **C. Dual-read forever.** Every load checks both formats.
- **D. Don't migrate; accept data loss** for existing projects.

### Decision: **A — Inline lazy migration**

```typescript
private async migrateLegacyState(): Promise<void> {
  // Idempotent: skip if table already has rows
  const existing = this.ctx.storage.sql
    .exec('SELECT seq FROM yjs_updates LIMIT 1').one();

  if (existing) {
    // Already migrated; just clean up legacy key if it lingered from a
    // partial-failure on a previous attempt
    await this.ctx.storage.delete('yjs-state');
    return;
  }

  const legacyState = await this.ctx.storage.get('yjs-state');
  if (!legacyState) return;

  // Handle both legacy formats: Uint8Array (post-fix) and number[] (original)
  const legacyBytes =
    legacyState instanceof Uint8Array
      ? legacyState
      : new Uint8Array(legacyState as number[]);

  // VALIDATE before insert. We would rather find out about corruption here,
  // where we have full context (project ID, byte length, source format),
  // than later during a normal load.
  try {
    const probeDoc = new Y.Doc();
    Y.applyUpdate(probeDoc, legacyBytes);
    probeDoc.destroy();
  } catch (err) {
    const projectId = this.ctx.id.toString();
    this.logger.error('migration_legacy_state_corrupt', {
      projectId,
      byteLength: legacyBytes.length,
      error: err,
    });
    // Throw so the connection fails loudly. Do NOT delete the legacy key --
    // we want to keep the original bytes for forensics.
    throw new Error(
      `ProjectDoc migration failed for project ${projectId}: legacy state corrupt`,
    );
  }

  try {
    this.ctx.storage.sql.exec(
      'INSERT INTO yjs_updates (update, created_at) VALUES (?, ?)',
      uint8ArrayToBuffer(legacyBytes),  // BLOB binding requires ArrayBuffer
      Date.now(),
    );
  } catch (err) {
    const projectId = this.ctx.id.toString();
    this.logger.error('migration_insert_failed', {
      projectId,
      byteLength: legacyBytes.length,
      error: err,
    });
    throw err;
  }

  // Only delete the legacy key after the new row is committed.
  // If this delete fails, next wake will see a populated table and skip the
  // insert path entirely (the early-return at the top), then retry the delete.
  try {
    await this.ctx.storage.delete('yjs-state');
  } catch (err) {
    this.logger.warn('migration_legacy_delete_failed', {
      projectId: this.ctx.id.toString(),
      error: err,
    });
    // Non-fatal -- next wake will retry.
  }
}
```

### Rationale

- **Idempotent.** The `LIMIT 1` check makes re-running safe. The unconditional `DELETE` self-heals partial failures.
- **Lazy.** Projects nobody opens never migrate, never consume any compute. We pay only for projects users actually return to.
- **Local to the DO.** No external coordination, no script to run during deploy, no RPC fan-out. Each DO is responsible for its own data.
- **Bounded ongoing cost.** One extra `SELECT seq LIMIT 1` and one extra `delete('yjs-state')` per DO load forever. Both sub-millisecond on local SQLite. After every active project has been touched at least once post-deploy, the legacy key is gone everywhere and only the cheap probes remain. We can remove the migration code entirely after a few months once we are confident every active project has been migrated.
- **Composes with the new persistence path.** After migration, the DO is just running the new code. No special "is this a migrated DO" state.

### Failure modes and reporting

The user explicitly asked to know when migration fails and which project ID it failed on. Three distinct failure paths each get their own log entry with project ID:

| Failure                                        | Behavior               | Log                                                                  | Legacy key                       |
| ---------------------------------------------- | ---------------------- | -------------------------------------------------------------------- | -------------------------------- |
| Validation (Y.applyUpdate to probe doc throws) | Throw, fail connection | `logger.error('migration_legacy_state_corrupt', { projectId, ... })` | **Preserved** for forensics      |
| INSERT into `yjs_updates` fails                | Throw, fail connection | `logger.error('migration_insert_failed', { projectId, ... })`        | **Preserved**, retried next wake |
| DELETE of legacy key fails                     | Log warning, continue  | `logger.warn('migration_legacy_delete_failed', { projectId, ... })`  | Stale key, retried next wake     |

All three log lines include the project ID so the affected project is always identifiable via `wrangler tail` or the persisted production logs. When DO-wide Sentry instrumentation lands as a follow-up, these same log lines will automatically become Sentry events without any change to the migration code.

---

## Decision 6 — Error Handling

**Question:** What happens on each failure mode?

### Failure response table

All "log" entries route through the injectable `PersistenceLogger` (see below), which delegates to `console.error`/`console.warn` in production. Those surface in `wrangler tail` and persisted production logs (`wrangler.jsonc:124-129`). Sentry reporting for DO errors is not currently wired — see the Verification Summary at the top. A separate follow-up should address DO-wide Sentry instrumentation.

| Failure                  | Response                                                     | Log level                     | Continues serving?            | Recovery path                  |
| ------------------------ | ------------------------------------------------------------ | ----------------------------- | ----------------------------- | ------------------------------ |
| INSERT on update         | Log + continue                                               | `error`                       | Yes                           | Client re-syncs on reconnect   |
| SELECT on init           | Throw, fail connection                                       | `error`                       | No (this load)                | Client retries                 |
| Compaction transaction   | Wrap in `transactionSync`; on failure, log + skip compaction | `error`                       | Yes (with un-compacted state) | Retried next threshold trigger |
| Migration: validate fail | Throw, fail connection, **keep legacy key**                  | `error` (includes project ID) | No, until manually fixed      |
| Migration: insert fail   | Throw, fail connection, **keep legacy key**                  | `error` (includes project ID) | No, until next wake           |
| Migration: delete fail   | Continue                                                     | `warn` (includes project ID)  | Yes                           |

### Compaction must be transactional

```typescript
private compact(): void {
  try {
    this.ctx.storage.transactionSync(() => {
      const cursor = this.ctx.storage.sql.exec(
        'SELECT update FROM yjs_updates ORDER BY seq',
      );
      const updates: Uint8Array[] = [];
      for (const row of cursor) {
        updates.push(row.update as Uint8Array);
      }
      const merged = Y.mergeUpdates(updates);

      this.ctx.storage.sql.exec('DELETE FROM yjs_updates');
      this.ctx.storage.sql.exec(
        'INSERT INTO yjs_updates (update, created_at) VALUES (?, ?)',
        merged,
        Date.now(),
      );
    });
  } catch (err) {
    this.logger.error('compaction_failed', { error: err });
    // Pre-compaction rows are still present (transaction rolled back).
    // Compaction will be retried the next time the threshold is crossed.
  }
}
```

**This is non-negotiable.** Compaction without `transactionSync` is a footgun: if `DELETE` succeeds but `INSERT` fails, the entire document is gone with no recovery.

### Logger interface

```typescript
interface PersistenceLogger {
  warn(event: string, ctx: Record<string, unknown>): void;
  error(event: string, ctx: Record<string, unknown>): void;
}
```

Production implementation delegates to `console.warn` / `console.error` with a structured message format (event name + JSON context). Tests inject a recording instance and assert against captured calls. No Sentry coupling — DOs don't currently route to Sentry (see Verification Summary), and adding that is out of scope for this PR.

The interface exists for three reasons: (1) keeps test assertions clean without needing to spy on `console`, (2) gives us a single place to later swap in Sentry or a structured logger when that follow-up happens, and (3) lets us include the project ID consistently in every log line without repeating string interpolation at each call site.

### What we rejected

- **Marking the DO as "broken" and refusing edits.** A single transient failure would lock out users until manual intervention. Optimistic-with-monitoring is the right default.
- **Aggressive retry loops on INSERT failures.** Local SQLite does not need retries the way a network call does. If a write actually fails, retrying immediately is unlikely to succeed.
- **Recovering from `initializeDoc` failures with empty state.** Silent data loss is worse than a visible error.

---

## Decision 7 — Testing Strategy

**Principle:** Real SQLite, real DO state, real Y.Doc operations. Mock as little as possible. Where failure injection is needed, use real SQL triggers / constraint violations rather than mocking the storage interface.

### What gets mocked

Exactly two things:

1. **The injectable `PersistenceLogger` interface** — so we can assert warnings and errors without coupling tests to the Sentry SDK.
2. _Nothing else._

### Failure injection without mocks

For tests that need to exercise INSERT failure or compaction rollback paths, install a real SQL trigger temporarily:

```sql
CREATE TRIGGER fail_insert BEFORE INSERT ON yjs_updates
BEGIN SELECT RAISE(FAIL, 'forced'); END;
```

The trigger causes real SQLite errors. The transaction really rolls back. The test drops the trigger when done. Real behavior, no storage interface mocks.

For migration corruption, seed real garbage bytes into the legacy key:

```typescript
state.storage.put('yjs-state', new Uint8Array([0xff, 0xff, 0xff]));
```

`Y.applyUpdate` will actually throw on it. Real failure path, no mocks.

### Test layout

```
packages/workers/src/durable-objects/__tests__/
├── ProjectDoc.test.ts                     (existing, unchanged)
├── ProjectDoc.rpc.test.ts                 (existing, helper update only)
├── ProjectDoc.ws-auth.test.ts             (existing, unchanged)
└── ProjectDoc.persistence.test.ts         (NEW)
```

### `ProjectDoc.persistence.test.ts` — coverage outline

**Schema**

- Creates `yjs_updates` table on first init
- `CREATE TABLE IF NOT EXISTS` is idempotent across reloads

**Write path**

- A single Y.Doc update inserts one row
- Multiple updates create multiple rows with monotonically increasing `seq`
- INSERT failure (real SQL trigger) logs to the injected logger and does not throw

**Cold load path**

- Empty table produces a fresh empty Y.Doc
- Single row reconstructs state correctly
- Many rows applied in `seq` order produce the same final state as applying them in real time
- SELECT failure throws and fails the connection

**Compaction**

- Triggers at the row threshold (configurable for tests, e.g. 5 instead of 500)
- After compaction: row count is 1, document state is preserved
- **Compaction is transactional**: install a fail-on-INSERT trigger after seeding rows, force compaction, assert all original rows still exist (rollback worked)
- Opportunistic compaction in `webSocketClose` when count exceeds the secondary threshold

**Migration**

- Legacy `Uint8Array` state migrates correctly
- Legacy `number[]` state (original `Array.from` format) migrates correctly
- Idempotent: running migration twice does not duplicate rows
- Already-migrated DO (table populated, legacy key still present) → cleanup-only path runs
- Corrupt legacy state → throws, **legacy key is preserved**, logger.error called with project ID
- INSERT failure during migration → throws, legacy key preserved, logger.error called
- DELETE failure during migration → does not throw, retries next wake, logger.warn called
- Empty state (no legacy key, empty table) → no-op

**Regression**

- Build a Y.Doc with realistic CoRATES content (50 studies, AMSTAR2 checklist with all 52 questions answered each), persist via the new path, verify cold load reconstructs identically. Sanity-check storage size to catch any future regression that re-introduces inflation like the original `Array.from` bug.

### Existing test updates

`ProjectDoc.rpc.test.ts:39` has a helper:

```typescript
function decodeYDocFromStorage(storedState: unknown) {
  const doc = new Y.Doc();
  Y.applyUpdate(doc, new Uint8Array(storedState as ArrayLike<number>));
  return doc;
}
```

…called from 5 test cases that read `state.storage.get('yjs-state')`. Both need to change:

```typescript
function decodeYDocFromStorage(state: DurableObjectState) {
  const doc = new Y.Doc();
  const cursor = state.storage.sql.exec<{ update: ArrayBuffer }>('SELECT update FROM yjs_updates ORDER BY seq');
  for (const row of cursor) {
    // BLOB columns return ArrayBuffer; wrap before applying
    Y.applyUpdate(doc, new Uint8Array(row.update));
  }
  return doc;
}
```

And the 5 callers updated to pass `state` instead of `storedState`. Test assertions stay the same.

`ProjectDoc.test.ts` and `ProjectDoc.ws-auth.test.ts` should pass unchanged.

### E2E coverage

Add `packages/web/e2e/persistence-recovery.spec.ts` using existing Playwright patterns (`seedDualReviewerScenario`, `setupProjectWithStudy` from `e2e/helpers.ts`).

Minimum scenario:

```typescript
test('Project state survives refresh after edits', async ({ context, page }) => {
  const scenario = await seedSingleReviewerScenario();
  const projectId = await setupProjectWithStudy(context, page, scenario, 'Persistence E2E');

  // Make real edits: add a study, open a checklist,
  // answer several questions, leave half-finished.

  await page.reload();
  await page.waitForLoadState('networkidle');

  // Verify everything is still present:
  // - study exists
  // - checklist exists
  // - answers are still set
});
```

This is the test that would have caught the original "I refresh and my studies disappear" report from a real user perspective. It exercises the entire stack: client → WebSocket → DO → SQLite → migration of legacy data → reload → re-sync → render.

If a second e2e test is worth adding, it would be a migration scenario specifically: seed a DO with legacy `yjs-state` data via fixture, open the project, verify it loads, edit, refresh, verify it still loads. Validates the migration path under real browser conditions.

### What we will not test

- **Exact compaction timing.** Test the _condition_ (compaction reduces row count to 1) and the _trigger_ (compaction is invoked when count exceeds threshold), not the precise interleaving.
- **Sentry call signatures.** Mock the logger interface, not Sentry itself.
- **Y.Doc internals.** Yjs has its own test suite.
- **Real DO hibernation.** The `cloudflare:test` framework cannot simulate true hibernation. We can simulate "fresh DO instance" by creating a new stub, which is the closest equivalent.

### Estimated test count

- ~22 new unit tests in `ProjectDoc.persistence.test.ts`
- 5 existing tests updated in `ProjectDoc.rpc.test.ts`
- 1-2 new e2e tests in `persistence-recovery.spec.ts`
- Total ProjectDoc unit tests goes from 21 to ~43

---

## Decision 8 — Implementation Order

### Single PR for the persistence redesign

All of Decisions 1-7 ship in one PR. Reasons:

1. **Atomicity requirement.** Schema, migration, read path, and write path must ship together or the system is internally inconsistent.
2. **Compaction is small** (~40 lines including the transaction wrapper). Splitting it out for a follow-up means carrying it as TODO debt while shipping with known suboptimal behavior.
3. **Tests should ship with the code they test.** Splitting tests into a follow-up PR is a recipe for them never being written.
4. **Two real users on two projects = low blast radius.** Even if something goes wrong, rollback impact is small. We are optimizing for "fix the bug, ship the fix, verify with real users," not for parallel deploys at scale.

### Sub-step commit order within the PR

```
0. SMOKE TEST: verify cloudflare:test exposes state.storage.sql
   - Write a minimal test that calls state.storage.sql.exec('SELECT 1')
     inside runInDurableObject and asserts it returns a cursor.
   - No existing test uses state.storage.sql, so this is the first
     moment we find out if the test framework supports it.
   - If it does not work, stop and find an alternative inspection strategy
     before continuing.

1. Add yjs_updates schema + migrateLegacyState (with tests)
   - DO still uses old yjs-state for reads/writes
   - New table created and migration runs; data is dual-stored briefly
   - Migration tests pass, including the Uint8Array/number[] format matrix
     and the preserve-legacy-key-on-error branches

2. Switch read path to yjs_updates
   - initializeDoc reads from new table
   - Old yjs-state still being written (briefly inconsistent with reads)
   - Read tests pass (empty, single row, many rows, failure-injected)

3. Switch write path to synchronous SQL INSERT
   - Remove schedulePersistence, persistTimer, persistPending, flushPersistence
   - Remove schedulePersistenceIfNoConnections callers (no longer needed --
     RPCs mutate the doc which fires doc.on('update') which inserts inline)
   - doc.on('update') inserts inline using uint8ArrayToBuffer helper
   - Write tests pass; everything is now consistent
   - This is the moment of full cutover

4. Add compaction (threshold + opportunistic + transactional)
   - Compaction tests pass, especially the rollback test using a real
     SQL trigger to force a mid-transaction failure

5. Add PersistenceLogger interface and wire error handling
   - Injectable logger, delegates to console.warn/error in production
   - NO Sentry wiring (DOs don't have Sentry today; separate follow-up)
   - Failure-injection tests pass, using recording logger for assertions

6. Update the 5 existing rpc test callers
   - decodeYDocFromStorage takes DurableObjectState, wraps ArrayBuffer
     with new Uint8Array before Y.applyUpdate
   - Existing 21 tests pass

7. Add e2e test
   - persistence-recovery.spec.ts passes against dev server
```

Each commit is an atomically reversible step within the PR. Step 0 is a "fail fast" check: if the test framework can't access SQL, we need to know before writing any other test. Steps 1-2 still leave the system functional even though they are intermediate states. Step 3 is the moment of full cutover.

### Separate follow-up PR: client-side initialization race

The client-side bugs identified in earlier investigation live in `packages/web/src/project/ConnectionPool.ts:102-191`:

- Dexie load is fire-and-forget (`.then()` without `await`)
- WebSocket connects immediately, in parallel with Dexie load
- Sync manager observers attach to an empty Y.Doc before persisted state is applied
- `PERSISTENCE_LOADED` event is defined in `connectionReducer.ts` but never dispatched

These contribute to the same user-visible symptom ("refresh and stuff disappears") but live entirely on the client and have nothing to do with the server persistence redesign. They should be a separate PR because:

- Different file, different package, different reviewer mental model
- Independent risk — each can be reviewed and rolled back on its own
- Different test surface (Dexie + ConnectionPool vs DO storage)
- Doesn't gate the server fix

**Order:** Server persistence PR first, then the client init race fix. The server bug has the bigger blast radius (affects all clients of an affected project), and the client fix is easier to verify once the server is solid.

---

## Out of Scope

The following are explicitly _not_ part of this work, even though they are related:

1. **Removing the migration code.** That is a future cleanup once we are confident every active project has been migrated. For now the migration code lives in `initializeDoc` permanently as a cheap probe.

2. **The wider sync pipeline redesign in `yjs-sync-pipeline-redesign-a.md`.** We are implementing the persistence parts only, not the React hook redesign or the Connection refactor. The audit doc should be updated to mark the persistence section as "implemented" once this ships, and to mark the alarm-based proposal as "obsolete — synchronous writes used instead."

3. **Switching to alarms.** Discussed and rejected in Decision 4. Synchronous writes do not need scheduling.

4. **Client-side initialization race fixes.** Separate follow-up PR.

5. **Decision 6 from the previous round (the duplicate `checklist-status.ts` between `packages/shared` and `packages/web`).** Unrelated cleanup.

6. **Switching client-side persistence away from Dexie.** Discussed and rejected; Dexie is fine for the client.

---

## Verification Results

All four pre-implementation checks have been run on branch `yjs-persistence-redesign`. Results:

1. **`cloudflare:test` exposes `state.storage.sql`** — Confirmed via type definitions in `@cloudflare/workers-types/experimental/index.d.ts:759`. `DurableObjectStorage.sql: SqlStorage` is part of the standard interface that `runInDurableObject` exposes. No existing test in the suite uses it, so an empirical smoke test is scheduled as sub-step 0 in Decision 8 to confirm at runtime.

2. **Sentry helper in workers package** — Confirmed: **there is none for Durable Objects**. `@sentry/cloudflare` is only used in `packages/workers/src/index.ts:397` via `Sentry.withSentry(workerHandler)`, which wraps the fetch handler exclusively. All DO code uses plain `console.error`. The plan has been updated: persistence errors log via `PersistenceLogger` to `console.*`, which surface in `wrangler tail` and persisted production logs. DO-wide Sentry instrumentation is out of scope for this PR.

3. **Existing `ProjectDoc` persistence code** — Re-read in full. Findings baked into the plan:
   - `initializeDoc()` is called from every entry point (`fetch`, RPC methods, WebSocket lifecycle methods, dev methods) because DOs wake with `this.doc === null`. The idempotent `if (!this.doc)` guard must stay.
   - `doc.on('update', ...)` both broadcasts and persists. Only the persist side changes; broadcast is unchanged.
   - `awareness.on('update', ...)` does NOT persist and must not start.
   - `schedulePersistenceIfNoConnections` can be deleted — RPCs mutate the doc which fires `doc.on('update')` which in the new design inserts synchronously.
   - `persistTimer`, `persistPending`, `PERSIST_DEBOUNCE_MS` all deleted.
   - `webSocketClose` keeps its awareness cleanup; the persistence branch becomes opportunistic compaction (Decision 3).

4. **`transactionSync` API signature** — Confirmed: `transactionSync<T>(closure: () => T): T` at `@cloudflare/workers-types/experimental/index.d.ts:761`. Synchronous callback only. Throws roll back the transaction. Compaction must be fully synchronous inside the closure (no `await`). Compaction already is — it's just `SELECT`, `Y.mergeUpdates`, `DELETE`, `INSERT`.

### Bonus finding

`SqlStorageValue = ArrayBuffer | string | number | null` (`experimental/index.d.ts:3824`). Yjs updates are `Uint8Array`, which is not in the binding type. Must convert to `ArrayBuffer` at the bind site via `uint8ArrayToBuffer(...)` helper (see Decision 2). BLOB reads return `ArrayBuffer` and must be wrapped with `new Uint8Array(ab)` before passing to Yjs APIs.
