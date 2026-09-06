# Sync Engine Guide

This guide explains how collaborative editing works in CoRATES on the
`@cf-sync` engine: a row-based sync plane served by a Durable Object, with
Yjs retained only for the one surface that needs character-level merging.

It replaces the old Yjs/y-websocket guide. The ProjectDoc Durable Object,
the y-dexie project Y.Doc mirror, and the store-mirroring sync manager it
described were retired in the sync-engine rewrite; the one-time migration is
documented in `packages/docs/plans/sync-engine-cutover.md`.

## Overview

- **App definition** (`packages/shared/src/sync`): the schema (tables and
  row shapes), named mutators, presence schema, and derivation helpers. Both
  sides consume the same `syncApp` - `createWorkspaceDO(syncApp)` in the
  worker, `createWorkspace({ app: syncApp })` in the browser.
- **Server** (`packages/workers/src/sync`): one WorkspaceDO per project holds
  the authoritative rows in DO storage. `authorize` checks D1 membership on
  connect and stamps `role` / `writeAllowed` onto the session. Admin seams
  (`kickWorkspaceUser`, `refreshWorkspaceSessions`, `teardownWorkspace`)
  let commands close or refresh live sessions.
- **Client** (`packages/web/src/project`): `ConnectionPool` owns ref-counted
  sessions. Reads go through the workspace-data hooks (live queries over the
  engine's collections); writes go through `client.mutate.*` - optimistic
  apply, a durable outbox, and rollback plus a toast on rejection.
- **Persistence**: DO storage on the server; one `cf-sync:<projectId>`
  IndexedDB database per project on the client (plus a per-tab clientId in
  sessionStorage). Both are tracked in Dexie (`syncCaches`) and wiped on
  logout and membership revocation.

## One authority per fact

Collaborative content (studies, checklists, answers, outcomes, pdfs,
annotations, reconciliations) lives in workspace rows: live, local,
offline-capable. Identity and membership are D1-authoritative, read through
React Query, and never mirrored into the workspace. Membership changes
refresh-disconnect the project's sessions; clients treat a re-sync as the
poke to refetch the members query.

## Writes: named mutators, not row puts

Direct row writes are disabled. Every write is a named mutation (for example
`checklist.updateAnswer`, `study.update`, `reconciliation.saveProgress`)
defined once in `packages/shared/src/sync/mutators.ts`, validated with Zod,
and executed on both the optimistic client apply and the authoritative
server apply. Rejections roll back the optimistic overlay and surface
through the pool's rejection toast.

Answer storage is flat-keyed: one `answers` row per field (for example
`q1.answers`, `sectionB.b1.comment`), expanded from section-level updates by
`expandAnswerUpdate`. Updates carry only the fields that changed - rows are
last-writer-wins upserts, so partial updates are what keep concurrent edits
to different fields of the same question from clobbering each other.

## Where Yjs still lives

Reconciliation consolidated notes are the one surface with concurrent
free-text editing, and they run on per-field Y.Docs attached to the
session's binary lane (the `yjsFields` extension; field id = the answer row
id). Finalizing a reconciliation serializes each field's text back into its
answer row. Everything else that was once Y.Text is a plain string row.

Presence (cursor positions, who is viewing) uses the engine's presence
channel, throttled and never stored.

## Local practice

Local projects (ids prefixed `local-`) have no engine session. Their rows
live in local-only collections, persisted to the Dexie `localProjects`
store by the pool on every mutation, and mutated by the same shared mutator
functions via `applyLocalMutation`. Legacy local Y.Docs are converted to
rows once on first load (`loadLegacyLocalRows`).

## Related

- `packages/docs/plans/sync-engine-cutover.md` - the completed one-time
  migration runbook, kept as a historical record
- [State Management Guide](/guides/state-management) - store patterns
- [Architecture Diagrams](/architecture/diagrams) - visual architecture
