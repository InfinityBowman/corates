# Sync Design

Status: Draft
Owner: TBD
Last Updated: 2026-04-15

## 1. Goals

This document defines the v1 sync architecture for CoRATES based on the goals captured in `packages/docs/audits/sync.md`.

Primary goals:

1. Build a Durable Object (DO) authoritative sync system for CoRATES app data.
2. Support offline-first clients using local SQLite in the browser.
3. Use server-authoritative last-write-wins (LWW) conflict behavior.
4. Use a mutation log for delta catch-up (not full event sourcing).
5. Start with whole-database sync only in v1 (no partial subscriptions).
6. Make the design suitable for internal use first, with a path to future open-source extraction.

## 2. Scope

In scope for v1:

1. DO SQLite is the canonical source of truth.
2. Browser client keeps a local SQLite mirror (WASM + OPFS-capable stack).
3. Realtime mutation propagation over WebSocket.
4. Offline mutation queue with reconnect replay.
5. Delta catch-up using server sequence numbers.
6. High-level security model and API contract.

Out of scope for v1:

1. Collaborative rich text protocol and cursor presence.
2. CRDT merge semantics.
3. Partial sync and row-level subscriptions.
4. Detailed authz matrix per table/operation.
5. Rollout or phased implementation plan (tracked in a separate document).

## 3. Design Principles

1. Keep canonical state in relational tables, not in an append-only event model.
2. Treat the mutation log as a sync transport artifact, not the source of truth.
3. Keep client and server protocol explicit and idempotent.
4. Prefer deterministic server behavior over complex client reconciliation.
5. Minimize protocol surface in v1 to reduce failure modes.

## 4. Architecture Overview

Components:

1. Browser Client
   - Local SQLite mirror for reads and optimistic local writes.
   - Persistent outbound mutation queue for offline operation.
   - WebSocket sync session with reconnect support.
   - Local checkpoint tracking for last acknowledged server sequence.

2. Durable Object Sync Authority
   - Canonical SQLite database for shared app state.
   - Mutation log table with monotonically increasing sequence.
   - Mutation validator and applier.
   - WebSocket broadcast to connected clients.

3. Transport
   - WebSocket for handshake, live mutations, acks, and deltas.

## 5. Data Model (Server)

Canonical tables:

1. Application domain tables (source of truth).
2. Mutation log table for replay and catch-up.
3. Dedupe table for idempotent mutation handling.

Example sync metadata tables:

```sql
CREATE TABLE IF NOT EXISTS sync_mutations (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  ts_ms INTEGER NOT NULL,
  actor_id TEXT NOT NULL,
  table_name TEXT NOT NULL,
  row_id TEXT NOT NULL,
  op_type TEXT NOT NULL, -- upsert | delete | patch
  payload_json TEXT NOT NULL,
  source_client_id TEXT,
  source_mutation_id TEXT
);

CREATE TABLE IF NOT EXISTS sync_dedupe (
  client_id TEXT NOT NULL,
  mutation_id TEXT NOT NULL,
  accepted_seq INTEGER NOT NULL,
  PRIMARY KEY (client_id, mutation_id)
);
```

Notes:

1. Domain tables remain canonical.
2. `sync_mutations` is used for catch-up and auditability.
3. `sync_dedupe` guarantees replay safety for offline retries.

## 6. Client Data Model

The client stores:

1. Local mirror tables (same shape as server canonical domain tables).
2. `last_ack_seq` checkpoint.
3. Persistent outbound queue entries:
   - client_id
   - mutation_id
   - base_seq (optional)
   - ts_ms
   - operation payload

## 7. Protocol

### 7.1 Handshake

On WebSocket connect, client sends:

```json
{
  "type": "hello",
  "clientId": "c_123",
  "lastAckSeq": 1242,
  "schemaVersion": 1
}
```

Server responds with either:

1. `sync_mode: delta` and mutation stream from `seq > lastAckSeq`, or
2. `sync_mode: snapshot` followed by full snapshot and new checkpoint.

Server decides snapshot fallback when replay window is unavailable.

### 7.2 Mutation Envelope

Client mutation message:

```json
{
  "type": "mutation",
  "clientId": "c_123",
  "mutationId": "m_20260415_00001",
  "tsMs": 1776200000000,
  "op": {
    "table": "studies",
    "rowId": "study_42",
    "kind": "upsert",
    "data": {
      "title": "Updated title"
    }
  }
}
```

Server mutation ack:

```json
{
  "type": "ack",
  "clientId": "c_123",
  "mutationId": "m_20260415_00001",
  "status": "accepted",
  "acceptedSeq": 1243
}
```

Server broadcast event:

```json
{
  "type": "applied",
  "seq": 1243,
  "tsMs": 1776200000100,
  "actorId": "user_9",
  "op": {
    "table": "studies",
    "rowId": "study_42",
    "kind": "upsert",
    "data": {
      "title": "Updated title"
    }
  }
}
```

### 7.3 Reconnect Ordering Rule

v1 rule: queued-first then delta.

1. Client reconnects and resumes WebSocket.
2. Client replays queued mutations in original order.
3. Server applies idempotent dedupe and returns acks.
4. Client requests or receives delta from updated checkpoint.
5. Client applies remaining server deltas and commits final `lastAckSeq`.

Rationale:

1. Keeps convergence logic simple with server-authoritative LWW.
2. Ensures reconnect flow remains deterministic and testable.

## 8. Consistency and Conflict Semantics

1. Server is authoritative for final state.
2. Writes are serialized by the DO.
3. Default conflict policy is LWW at the field/row mutation level.
4. Clients may apply optimistic local updates, then reconcile to server-applied events.
5. If local optimistic result differs from server result, server result wins.

## 9. Failure Handling

Failure modes and behavior:

1. Duplicate mutation replay
   - Handled via `(client_id, mutation_id)` dedupe key.
2. Missing replay window
   - Server falls back to snapshot sync.
3. Validation failure
   - Server returns rejected ack with reason; client marks mutation failed.
4. Mid-stream disconnect
   - Client reconnects, replays unsent/unacked mutations, then catches up by seq.

## 10. Security (High Level)

1. Every mutation is authenticated at session level.
2. Every mutation is authorized before apply.
3. Server never trusts client-side row ownership claims.
4. Audit fields (`actor_id`, timestamp) are set server-side.

Detailed per-table authorization rules are deferred to a follow-up security design.

## 11. Operational Constraints and Risks

Known v1 constraints:

1. Whole-database sync only.
2. No collaborative rich text protocol in v1.
3. DO SQLite-only canonical durability assumption for v1.

Known risk:

1. If DO local state loss/corruption occurs, recovery strategy is limited in v1.
2. This is accepted for v1 and should be revisited when durability hardening is prioritized.

## 12. Observability and Success Criteria

Suggested metrics:

1. Mutation ack latency (p50, p95, p99).
2. Reconnect recovery time.
3. Delta replay size and duration.
4. Snapshot fallback rate.
5. Mutation rejection rate.
6. Duplicate mutation rate.

v1 success criteria:

1. Clients converge to identical canonical state after disconnect/reconnect cycles.
2. No duplicate side effects under repeated offline replay.
3. LWW behavior is deterministic under concurrent writes.
4. Snapshot fallback is rare under normal operation.

## 13. Future Extensions

1. Partial sync subscriptions by query/filter.
2. Rich text collaboration layer (cursor presence and CRDT/OT evaluation).
3. Durability hardening beyond DO-local canonical storage assumptions.
4. Extraction path toward reusable OSS sync SDK.
