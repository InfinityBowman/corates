# Sync pending-mutation visibility: implementation plan

Status: implemented 2026-08-09 (all four phases). Written 2026-08-09, revised same
day after review (corrected e2e sleep audit, bfcache-safe unload guard, 0.x version
range, Linear-style indicator). @cf-sync/client 0.1.1 not yet published: corates
temporarily consumes a packed tarball via a pnpm-workspace.yaml override -- remove
it and reinstall once 0.1.1 is on the registry. Implementation deltas from the text
below: checklist/reconcile routes render no project header, so an invisible
`data-sync-pending` marker in ProjectView covers them for waitForSynced; the
concurrent-crdt setup also waits before its mid-test login switch, not only before
closing the context.

## Problem

The sync client holds an outbox of mutations that have been applied optimistically
but not yet confirmed by the Durable Object. Nothing anywhere can observe it.

Consequences today:

- A user who edits and closes the tab before the ack has work queued in IndexedDB.
  It replays on their next visit, so it is usually deferred rather than lost -- but
  it is lost if they never return on that profile, use a private window, clear site
  data, or the browser evicts IndexedDB (Safari is most aggressive).
- On a flaky or offline connection the outbox legitimately holds work for minutes.
  That is the design working, and there is no indication it is happening.
- A collaborator waiting on that work sees nothing and cannot distinguish "queued on
  someone else's machine" from "the app lost it". This already happened once: the
  stranded-backlog incident resolved on 2026-07-13 only after the affected user
  reconnected.
- E2E tests have no signal to wait on, so durability waits are hardcoded sleeps
  (`persistence-recovery.spec.ts:104,158` wait for the outbox to flush; its other
  sleeps guard different things -- see Phase 4) and `concurrent-crdt.spec.ts` needs
  a structural workaround to keep an outbox alive.

This is an observability gap, not a durability bug -- with one exception: there is no
`beforeunload` guard, so the app silently allows walking away from unsent work.

## Why this cannot be solved in corates alone

`SyncClient`'s public surface is `status`, `hydrated`, `whenHydrated`, `cursor`,
`workspaceId`, `clientId`, `app`, `schema`, `mutate`, `presence`, `subscribeStatus`,
`subscribeHydrated`, `onBinary`. Nothing exposes the outbox, and the omission is
deliberate -- the `SyncStatus` doc comment in `packages/client/src/types.ts` reads
"one value describing the pipe, not any individual mutation".

Tracking the promises app-side does not work. Outbox entries restored from IndexedDB
are reconstructed with `resolve: noop` (`packages/client/src/client.ts:645`), so after
any reload the promises are gone while the work is still queued. Outbox length is the
only measure that is correct across a reload, and only the engine can see it.

## Phase 1 -- `@cf-sync/client` (repo: `cf-sync-engine`)

Additive and non-breaking. No wire-format change, so `@cf-sync/protocol`,
`@cf-sync/server`, and `@cf-sync/yjs` are untouched and no deploy coordination is
needed.

In `packages/client/src/client.ts`:

1. Add `#pendingListeners = new Set<(pending: number) => void>()` alongside the
   existing `#statusListeners` (`:121`).
2. Add `get pending(): number { return this.#outbox.length }`. Both unpushed entries
   (`id: null`, queued before the connection synced) and pushed-but-unconfirmed ones
   count -- the question being answered is "not durably on the server yet".
3. Add `readonly subscribePending = (listener: (pending: number) => void) => ...`,
   copying the shape of `subscribeStatus` (`:360`) exactly. Keep it an arrow property
   so it drops into `useSyncExternalStore` unbound, and document it the same way.
4. Add a private `#notifyPending()` and call it wherever `#outbox` changes.
   `#settleEntry` (`:1442`) is the removal chokepoint -- the shutdown loop (`:516`,
   inside `#shutdown()`, reached from both `stop()` and `destroy()`), the confirm
   sweep (`:1419`), and the fatal path (`:1652`) all go through it, so
   instrumenting it plus the two growth sites covers everything:
   - `:653` -- hydration prepends restored entries
   - `:945` -- `mutate()` pushes a new entry
   - `:1442` -- `#settleEntry` removes one entry
     Emit only when the count actually changed, so listeners do not churn.
5. Optional, and only if a call site wants it: `whenIdle(): Promise<void>` resolving
   when `pending` hits 0. Skip unless something needs it -- `subscribePending` covers
   the UI and the tests.

Export nothing new from `packages/client/src/index.ts`; these are members of the
already-exported `SyncClient`.

Tests in `packages/client/test/` (follow `persistence.test.ts` and
`startup-replay.test.ts`, which already drive the outbox):

- `pending` is 0 on a fresh client, 1 after a `mutate` that has not been confirmed,
  back to 0 after the confirm poke.
- `subscribePending` fires on both transitions and stops firing after unsubscribe.
- **The reload case, which is the whole reason this lives in the engine**: mutate with
  a store attached, stop the client before confirmation, construct a new client over
  the same store, and assert `pending` is 1 after hydration -- the restored entry has
  no promise but must still count.
- `destroy()` drops `pending` to 0.

Then publish. corates consumes `@cf-sync/client ^0.1.0` from the registry, not a
workspace link, so the app cannot use this until it ships. Version carefully: for
0.x packages a caret range does not cross the minor, so `0.2.0` falls outside
`^0.1.0`. Either publish as `0.1.x` or bump the range in corates' package.json as
part of Phase 2. The global `minimumReleaseAge` rule has a standing exception for
Jacob's own `cf-sync-*` packages, so the 4-day wait does not apply. To iterate
before publishing, point a pnpm override at the sibling checkout.

## Phase 2 -- corates: store plumbing and the `beforeunload` guard

This phase is where the one real safety gap gets closed. Do not skip ahead to the UI.

1. `packages/web/src/stores/projectStore.ts`: add `pending: number` to
   `ConnectionMachineState` (`:17`), defaulted to 0 in `INITIAL_CONNECTION` (`:22`).
   Add a `setPending(projectId, pending)` action next to `setConnectionState` (`:152`)
   rather than widening that setter -- phase and pending change on different events.
2. `packages/web/src/project/ConnectionPool.ts`: in `startConnection`, subscribe
   alongside the existing status/hydrated subscriptions (`:223-225`) and push the
   unsubscribe onto `entry._cleanupHandlers` the same way:

   ```ts
   entry._cleanupHandlers.push(
     workspace.client.subscribePending(pending => {
       if (cancelled()) return;
       useProjectStore.getState().setPending(projectId, pending);
     }),
   );
   ```

   Seed it with the current value immediately after, mirroring the existing
   `applyStatus(workspace.client.status)` call.

3. Add the `beforeunload` guard. `ConnectionPool` already owns a `pagehide` listener
   at module scope (`:468-470`); put the wiring beside it, but do not register the
   listener permanently -- a page with a `beforeunload` handler is ineligible for
   back/forward cache in Safari and Firefox. Add the listener when total pending
   across the registry transitions from 0 to positive and remove it when it returns
   to 0 (the `subscribePending` subscriptions from step 2 are the natural trigger).
   The handler itself just calls `preventDefault()`. Note that browsers show their
   own generic wording -- a custom string is ignored -- so this is a speed bump, not
   a message channel.

Verify by hand: throttle the network to offline in devtools, make an edit, confirm the
store's pending count rises and the tab refuses to close silently.

## Phase 3 -- corates: the indicator

Linear-style: show nothing while healthy, surface only the exceptional state. This
is what Linear and Notion both do -- no "Saving...", no "Saved", just an offline or
unsent-work badge when something is actually wrong. A "Saved" ticker is the Google
Docs pattern, and it makes a promise this app cannot keep (see the wording note
below). Silence makes no promise.

Place it in `ProjectHeader` (`packages/web/src/components/project/ProjectHeader.tsx`),
near `ProjectHeaderActions` (`:128`). An always-rendered status container (empty and
invisible in the healthy state -- Phase 4 needs the element to exist) with one badge
that appears when:

- pending > 0 and phase is not `synced` -- "Offline -- changes pending", or
- pending has been continuously above 0 for ~10s while `synced` -- "Unsent changes"
  (the pipe looks fine but work is not landing; this is the stranded-backlog shape)

Everything else renders nothing. The ~10s escalation timer lives in the component,
driven by the raw store value -- not in the store and not in the engine.

**Why no "Saved" state.** The pending count covers mutations only. Reconciliation
notes travel the Yjs binary lane, which has no ack at all (see Out of scope), so any
positive confirmation ("Saved", "All changes saved") would be lying about notes. An
indicator that only ever warns about unsent mutations is scoped to exactly what
`pending` measures. If users turn out to want positive confirmation, a muted synced
state can be added later -- adding reassurance is easy, walking back a false promise
is not.

## Phase 4 -- corates: e2e

1. Expose pending to the DOM rather than widening a global. `window.__connectionPool`
   is gated on `import.meta.env.DEV` (`ConnectionPool.ts:472`) and therefore does not
   exist on staging, where the suite actually runs. Put a `data-sync-pending`
   attribute on the always-rendered status container from Phase 3 -- Playwright then
   gets auto-retrying `toHaveAttribute` for free and no debug global ships in the
   production bundle. The attribute carries the raw pending count, not any debounced
   or escalated display state, so tests never wait out UI timers.
2. Add `waitForSynced(page)` to `packages/web/e2e/shared-steps.ts`, asserting
   `data-sync-pending="0"`.
3. Replace the true durability sleeps with it: `persistence-recovery.spec.ts:104` and
   `:158`, both of which wait for the outbox to flush to the server. The other four
   sleeps in that file are not replaceable and stay:
   - `:212` and `:241` wait for the engine's IndexedDB snapshot flush before a
     reload. Pending hitting 0 means the server confirmed -- a different property --
     and `:241` is taken while the page is offline, where pending never reaches 0
     and `waitForSynced` would hang until timeout.
   - `:335` and `:341` belong to the negative-repro test for the "No active project
     connection" bug: `:335` deliberately waits past any sync window to prove the
     failure is not a race, and `:341` follows a mutation that is expected to fail.
     Leave the small UI-settle sleeps in `concurrent-crdt.spec.ts:59,94` and
     `realtime-collaboration.spec.ts` alone too -- none of these are durability waits.
4. Revisit `concurrent-crdt.spec.ts`. The setup context is currently held open through
   the whole cycle purely so its outbox can drain (added 2026-08-09, PR #544). With a
   real signal it can go back to closing early, right after `await waitForSynced(setupPage)`.

## Out of scope

The Yjs binary lane has no acknowledgement of any kind. `sendUpdate` goes out via
`client.sendBinary(...)` (`cf-sync-engine/packages/yjs/src/client.ts:181`), whose
signature is `sendBinary(bytes): void`, and `YjsFieldHandle` exposes only `doc`,
`text`, `canWrite`, `writeBlocked`, `whenSynced`, `subscribe`, `release`. `whenSynced`
resolves on the first STATE and stays resolved, so it answers "can I render this
field", not "is my edit safe". Recovery is the STATE push-back on reconnect.

Giving notes a pending count needs a real protocol change -- an ack frame or a
server-echoed state vector -- across `@cf-sync/protocol`, `@cf-sync/server`, and
`@cf-sync/yjs`. Do it only if notes are observed going missing. Until then it is a
known blind spot that Phase 3's wording has to respect.

## Sequencing

Phase 1 gates everything. Phase 2 is the only phase that fixes a real safety gap and
should not wait on the UI work. Phases 3 and 4 are independent of each other once 2
lands.
