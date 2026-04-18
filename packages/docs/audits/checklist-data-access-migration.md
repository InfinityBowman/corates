# Checklist data access: migration state after `useChecklistAnswers`

## Context

`ChecklistYjsWrapper` now reads answers via `useChecklistAnswers` (issue #480). The broader refactor (issues #481–#483) is not yet done. This doc enumerates the remaining callers of `getChecklistData`, explains what each one uses the data for, and whether it should eventually migrate to the hook or stay imperative.

## Status: is there old code to delete?

No. The only thing #480 removed from `ChecklistYjsWrapper` is the `getChecklistData` destructuring. The function itself is still exported from `createChecklistOperations` and still has four callers. No `refreshKey` remains in the tree (already removed by an earlier pass). Nothing is orphaned.

## Callers of `getChecklistData`

### 1. `project.checklist.getData()` — public typed API

- File: `packages/web/src/project/actions.ts:82-86`
- Shape: one-shot read, imperative, called outside render.
- Currently consumed by `OverviewTab` (see #4 below) — no other direct callers.
- **Keep.** This is the imperative facade. It is the correct home for "grab the answers right now" calls that don't participate in a component's subscription model. Issue #483 will refine its types; the call shape is fine.

### 2. `calculateInterRaterReliability` (utility)

- File: `packages/web/src/lib/inter-rater-reliability.ts:34-39, 84-85`
- Shape: pure function, takes `getChecklistData` as a parameter, loops over every dual-reviewer AMSTAR2 study in a project and reads both reviewers' completed answers.
- **Keep imperative.** A per-checklist subscription hook doesn't fit: this computes across N studies × 2 reviewers in one pass. A hook would require either N×2 hook calls (illegal dynamically) or a second, project-scoped subscription that re-derives the whole table on any change.
- **Optional future sharpening:** if we want this to be live (metrics update as reviewers finalize), expose a `useProjectChecklistVersion(projectId)` hook that bumps on any `reviews` change, add it as a `useMemo` dep, and keep the imperative read inside the memo. That's the minimal cost for reactivity without breaking the computation shape.

### 3. `OverviewTab`

- File: `packages/web/src/components/project/overview-tab/OverviewTab.tsx:171-175`
- Shape: wraps `project.checklist.getData` in a lambda and passes it to `calculateInterRaterReliability`.
- **Keep.** Follows directly from #2.

### 4. `PreviousReviewersView`

- File: `packages/web/src/components/project/completed-tab/PreviousReviewersView.tsx:39, 66, 68`
- Shape: reads two completed-reviewer checklists in `useEffect` on dialog open, stashes them in local state, renders read-only.
- Target checklists have status `REVIEWER_COMPLETED` or later — editing is locked by `isEditable()`.
- **Migrate to `useChecklistAnswers` eventually, low priority.** No correctness bug today (the checklists are locked, so the one-shot read is accurate). Migration value is consistency and killing one more `useEffect` that syncs Y.Doc → local state.
- Blocker: the component reads _two_ checklists. Calling the hook twice conditionally would violate Rules of Hooks. Solution: either (a) always call it twice with `null`-safe IDs, or (b) pass `checklistId` as an argument and split into `<ReviewerPanel checklistId=... />` children so each panel calls the hook once. (b) is cleaner.

### 5. `ReconciliationWrapper`

- File: `packages/web/src/components/project/reconcile-tab/ReconciliationWrapper.tsx:69, 200-217, 219-237, 380-391`
- Shape: reads three checklists (checklist1, checklist2, reconciled), builds UI payloads including reviewer names and createdAt, feeds into the reconciliation view.
- Reactivity **matters here**: during reconciliation both source checklists are typically `REVIEWER_COMPLETED` (locked) but the reconciled checklist is actively edited. If another tab or collaborator writes to the reconciled Y.Doc, this view needs to reflect it.
- Current invalidation: `getChecklistData` is pulled from destructured `ops.checklist` and used as a `useMemo` dep. It is a stable reference — so the memos only re-run when `currentStudy` flips in Zustand, which is the same fragile path #480 just moved away from.
- **Migrate.** Replace the three `useMemo(() => getChecklistData(...))` blocks with three `useChecklistAnswers` calls and spread the returned answers into the existing UI-shape objects. Same transformation as `ChecklistYjsWrapper`.
- Scope: ~40 lines touched in one component. Low risk. Good candidate to pair with the #481 local/collab unify work or land separately right after #480.

## Summary table

| Caller                           | Keep `getChecklistData`?  | Reason                                                  |
| -------------------------------- | ------------------------- | ------------------------------------------------------- |
| `project.checklist.getData()`    | Yes                       | Imperative facade for one-shot reads                    |
| `calculateInterRaterReliability` | Yes                       | Cross-checklist aggregation; hook doesn't fit           |
| `OverviewTab`                    | Yes                       | Thin wrapper over the above                             |
| `PreviousReviewersView`          | Migrate (low priority)    | Locked data, but consistency + removes effect           |
| `ReconciliationWrapper`          | Migrate (medium priority) | Reconciled checklist is live-edited; reactivity matters |

`getChecklistData` stays in the surface area indefinitely — the imperative path is legitimate. The hook is the right default for reactive components, not a total replacement.

## Local-practice migration (issue #481)

**Not yet written.** Local-practice checklists live in the Dexie `localChecklists` table (`packages/web/src/stores/localChecklistsStore.ts`) as flat JSON blobs with a `data: unknown` field containing the full checklist template shape. They do not use Y.Doc, y-dexie, or the sync layer.

When issue #481 lands, the migration step is:

1. On first app load after upgrade, detect entries in `localChecklists`.
2. For each entry, create a local Y.Doc (persisted via y-dexie, no WebSocket provider) under a stable ID.
3. Convert the stored `data` using the appropriate `handler.createAnswersYMap` + write flat fields into the Y.Doc.
4. Mark the migration done via a one-shot flag (e.g., `localStorage['local-checklists-migrated-v1'] = '1'`) so we don't re-run.
5. Leave the old `localChecklists` and `localChecklistPdfs` tables in place for one release as rollback insurance.
6. Next release: drop the tables, delete `localChecklistsStore.ts`, delete `LocalChecklistView`, delete `CreateLocalChecklist`, re-point `/checklist/$checklistId` and dashboard sidebar entries to the unified view.

Migration correctness should be verified by a round-trip test: every `data` shape that has appeared in the wild, run through the migration, then `handler.serializeAnswers(migrated)` equals the original `data` modulo Y.Text vs. string for note fields.

Until #481 ships, no user-facing local-checklist data is at risk: the old store and old view keep working unchanged. `useChecklistAnswers` is only exercised by collaborative (project-scoped) checklists.
