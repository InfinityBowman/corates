# Reactive Pipeline Audit - May 2026

Audit of the Yjs -> React reactive pipeline. Focused on unnecessary work during checklist editing, but covers the full sync layer.

## Architecture Summary

```
Y.Doc
  |
  |-- reviewsMap.observeDeep() -------> sync.ts (handleReviewsEvents)
  |                                        |
  |                                        +--> buildStudyFromYMap() per dirty study
  |                                        +--> RAF batch -> projectAtoms.setStudy()
  |                                        |
  |                                        +--> Consumers:
  |                                             useStudy()      -> StudyCard, ChecklistYjsWrapper
  |                                             useAllStudies() -> OverviewTab, ToDoTab, CompletedTab
  |                                             useStudyIds()   -> AllStudiesTab loop
  |
  |-- reviewsMap.observeDeep() -------> useChecklistAnswers (useSyncExternalStore)
  |                                        |
  |                                        +--> serialize() full answers Y.Map
  |                                        +--> Consumer: useChecklistViewModel -> checklist editor
  |
  |-- annotationsMap.observeDeep() ---> useStudyAnnotations (useSyncExternalStore)
                                           |
                                           +--> Consumer: AnnotationSyncManager in PDF viewer
```

Two parallel observer chains on the same Yjs data. The sync.ts path feeds list views via atoms. The direct hooks feed the checklist editor and annotation viewer. Both fire on broader changes than they need.

## Problems

### P1: `useChecklistAnswers` observes the entire reviews map

`useChecklistAnswers.ts:81-86` subscribes to `reviewsMap.observeDeep()`. This means editing study A's name triggers a version bump and re-render in study B's checklist editor. Within the same study, any change (PDF upload, annotation add, reviewer assignment) triggers answer re-serialization even though answers didn't change.

The `getSnapshot` cache prevents returning a new object when version hasn't changed, but it can't prevent the React render cycle that `useSyncExternalStore` initiates when `onStoreChange` fires. And when version does bump, `serialize()` walks the full answers tree and returns a new object every time, even if the underlying data is identical.

**Impact**: Every Yjs mutation to any study triggers a render cycle in the checklist editor. For keystroke-heavy editing (notes fields), this compounds with the user's own edits.

**Fix**: Observe the specific checklist's answers Y.Map instead of the whole reviews map. Falls back to a broader observer only when the answers map doesn't exist yet (first load / new checklist).

### P2: `buildStudyFromYMap` does redundant work

Two issues here:

**a) `studyYMap.toJSON()` eagerly serializes everything.**
Line `sync.ts:72` calls `toJSON()` on the full study Y.Map, which recursively serializes all nested Y.Maps (checklists, annotations, PDFs, reconciliation). Then `buildStudyFromYMap` only uses the result for ~20 flat string fields (name, doi, authors, etc.) and re-walks the nested Y.Maps manually to build structured objects. The deep serialization of nested data in `toJSON()` is wasted work.

**Fix**: Read flat fields directly from the Y.Map (`studyYMap.get('name')` etc.) instead of calling `toJSON()`. Drop the `studyData` parameter from `buildStudyFromYMap`.

**b) Annotations are serialized but no longer consumed.**
`buildStudyFromYMap` calls `buildAnnotationsFromYMap()` (lines 396-399) which iterates all annotation Y.Maps and parses JSON `embedPdfData` strings. After the `useStudyAnnotations` hook was introduced, `study.annotations` has no remaining consumers -- no component reads it. This is dead work on every sync.

**Fix**: Stop building annotations in `buildStudyFromYMap`. Remove the `annotations` field from `StudyInfo` if nothing reads it. If something needs it later, add a dedicated hook like `useStudyAnnotations`.

### P3: Study atoms lack structural equality

`projectAtoms.ts:29-31` sets the study atom with a new `StudyInfo` object on every sync. The atom has no custom `isEqual`, so `@tldraw/state` uses `Object.is` (reference equality). Since `buildStudyFromYMap` always creates a new object, the atom always notifies subscribers -- even when the user is editing checklist answers and nothing visible in the study card has changed.

This means every checklist keystroke triggers re-renders in: `StudyCard`, `useAllStudies` consumers (OverviewTab, ToDoTab, CompletedTab, ReconcileTab), and anything else subscribed to that study's atom.

**Fix**: Add `isEqual` to study atoms. The comparison doesn't need to be deep -- it should compare the fields that list views actually display: name, checklist statuses/scores, reviewer assignments, PDF count, updatedAt. Skip comparing `answers` and `annotations` since those are read through direct hooks.

### P4: `handlePartialUpdate` doesn't batch across keys

`ChecklistYjsWrapper.tsx:198-203` iterates `Object.entries(patch)` and calls `updateChecklistAnswer` per key. Each call is now wrapped in its own `ydoc.transact()` (from fix #1), but multiple keys still produce multiple transactions and multiple observer events.

In practice most patches have a single key, so this is low impact. But when it does fire with multiple keys (e.g., clearing a domain resets judgement + answers), it produces unnecessary intermediate observer events.

**Fix**: Wrap the loop itself in `ydoc.transact()` so multi-key patches produce a single Yjs event.

### P5: `useAllStudies` is a computed that reads every study atom

`projectAtoms.ts:107-119` implements `useAllStudies` as a `useValue` computed that reads `studyOrder` and then `.get()` on every study atom. In `@tldraw/state`, reading an atom inside a computed creates a dependency. So `useAllStudies` re-fires when ANY study atom changes.

This is correct behavior (it needs the full list), but the consumers -- OverviewTab, ToDoTab, CompletedTab -- all derive filtered subsets from it. When study A's checklist answer changes, all three tabs re-render and re-filter even if the derived list hasn't changed (the study is still in the same tab, with the same status).

This isn't a bug in `useAllStudies` itself -- it's a consequence of P3. If study atoms had structural equality and didn't fire on answer-only changes, `useAllStudies` would stay stable during checklist editing.

**Impact**: Medium. The tab views are behind route-based lazy rendering, so only the active tab pays the render cost. But the active tab (usually "All Studies") does re-render on every edit.

### P6: `updateProjectStats` runs on every sync

`sync.ts:176` calls `useProjectStore.getState().updateProjectStats(projectId, studies)` on every `doSync()`. This iterates all studies, counts finalized checklists, and writes to localStorage. During active checklist editing this fires on every RAF-batched sync (every ~16ms while typing).

**Fix**: Only call `updateProjectStats` when checklist status actually changes (FINALIZED count differs), or debounce it separately from the main sync.

### P7: Score computation on every finalized checklist rebuild

`buildStudyFromYMap` lines 326-336 call `scoreChecklistOfType()` for every FINALIZED checklist on every study rebuild. Scores for finalized checklists are immutable -- once finalized, answers can't change.

**Fix**: Cache scores. Either store the computed score in the Y.Map when finalizing (alongside the status change), or cache in the study cache and skip recomputation when the checklist's `updatedAt` hasn't changed.

## Measurement

All fixes must be validated with before/after numbers. Add a dev-only performance monitor (gated behind `import.meta.env.DEV`) that logs per-edit-cycle stats to the console. Instrument these hot paths:

| Probe                 | Location                             | What it measures                                                    |
| --------------------- | ------------------------------------ | ------------------------------------------------------------------- |
| `handleReviewsEvents` | sync.ts                              | Fires per Yjs observer event. Count + time.                         |
| `buildStudyFromYMap`  | sync.ts                              | Full study rebuilds. Count + time per call.                         |
| `serialize`           | useChecklistAnswers.ts `getSnapshot` | Answer re-serializations. Count + cache hit/miss.                   |
| `doSync`              | sync.ts                              | Store pushes. Count + time.                                         |
| `studyAtom.set`       | projectAtoms.ts `setStudy`           | Atom notifications. Count + suppressed-by-isEqual count (after P3). |

Use `performance.mark()` / `performance.measure()` for timing. Aggregate per edit cycle (reset on each `handleReviewsEvents` entry) and log a single summary line:

```
[perf] edit cycle: handleReviewsEvents=1 buildStudy=1 serialize=1 doSync=1 atomFired=1 (4.2ms)
```

### Measurement protocol

1. Add instrumentation (P0).
2. Open a checklist with a PDF and annotations loaded. Project should have 5+ studies.
3. Record baseline: click 10 radio buttons, type 20 characters in a notes field. Capture console output.
4. Implement fixes one at a time. After each fix, repeat step 3 and record.
5. Confirm: observer counts drop, serialization counts drop, atom fire counts drop. Wall time should decrease.
6. Remove instrumentation before merging.

Expected baseline (pre-fix, per radio button click):

- `handleReviewsEvents`: 2-3 calls (no transaction batching)
- `buildStudyFromYMap`: 2-3 calls
- `serialize`: 2-3 calls
- `doSync`: 1 call (RAF batched)
- `atomFired`: 1+ (always, no isEqual)

Expected post-fix (per radio button click):

- `handleReviewsEvents`: 1 call (transaction batching already done)
- `buildStudyFromYMap`: 1 call
- `serialize`: 1 call, or 0 cache hits if observer is narrowed (P1)
- `doSync`: 1 call
- `atomFired`: 0 for answer-only edits (P3 isEqual suppresses)

## Recommended Execution Order

The fixes are listed below in order of impact-to-effort ratio. P3 and P1 together eliminate most of the unnecessary work. P2a and P2b are low-effort cleanup. P4-P7 are refinements.

| Fix                                         | Impact | Effort | Notes                                                                 |
| ------------------------------------------- | ------ | ------ | --------------------------------------------------------------------- |
| P1: Narrow `useChecklistAnswers` observer   | High   | Small  | Biggest single win for editor performance                             |
| P3: Add `isEqual` to study atoms            | High   | Small  | Stops cascading re-renders to list views                              |
| P2b: Stop building annotations in sync      | Medium | Small  | Dead code removal                                                     |
| P2a: Drop `toJSON()` in handleReviewsEvents | Medium | Small  | Avoids redundant deep serialization                                   |
| P4: Batch `handlePartialUpdate`             | Low    | Tiny   | Single `transact()` wrapper                                           |
| P6: Gate `updateProjectStats`               | Low    | Small  | Avoids localStorage writes during editing                             |
| P7: Cache finalized scores                  | Low    | Small  | Minor optimization, mostly for studies with many finalized checklists |
| P5: N/A (solved by P3)                      | -      | -      | Not a separate fix, just context                                      |

## Implementation Notes

### P1 implementation sketch

```typescript
// useChecklistAnswers.ts subscribe()
const subscribe = useCallback(
  (onStoreChange: () => void) => {
    if (!ydoc) return () => {};
    const resolved = resolveAnswers(ydoc, studyId, checklistId);
    if (!resolved) {
      // Answers map doesn't exist yet -- observe the checklist Y.Map
      // to catch when answers are first created
      const checklistYMap = resolveChecklistYMap(ydoc, studyId, checklistId);
      if (!checklistYMap) return () => {};
      const observer = () => {
        versionRef.current += 1;
        onStoreChange();
      };
      checklistYMap.observe(observer);
      return () => checklistYMap.unobserve(observer);
    }
    const observer = () => {
      versionRef.current += 1;
      onStoreChange();
    };
    resolved.answersYMap.observeDeep(observer);
    return () => resolved.answersYMap.unobserveDeep(observer);
  },
  [ydoc, studyId, checklistId],
);
```

The subtlety: the observer target can change during the component's lifetime (answers map gets created). `useSyncExternalStore` handles this via the `subscribe` dep array -- when `studyId` or `checklistId` changes, it re-subscribes.

But there's a lifecycle gap: if the answers Y.Map is created AFTER the initial subscribe (e.g., first edit on a new checklist), the shallow `checklistYMap.observe` catches the creation event, bumps the version, and React calls `getSnapshot` which now resolves the answers. On the next subscribe call (triggered by deps or re-mount), it attaches the deep observer to the now-existing answers map.

### P3 implementation sketch

```typescript
// projectAtoms.ts
function studyEquals(a: StudyInfo | undefined, b: StudyInfo | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.name !== b.name) return false;
  if (a.updatedAt !== b.updatedAt) return false;
  if (a.reviewer1 !== b.reviewer1 || a.reviewer2 !== b.reviewer2) return false;
  if (a.pdfs.length !== b.pdfs.length) return false;
  if (a.checklists.length !== b.checklists.length) return false;
  for (let i = 0; i < a.checklists.length; i++) {
    const ca = a.checklists[i], cb = b.checklists[i];
    if (ca.id !== cb.id || ca.status !== cb.status || ca.score !== cb.score
        || ca.assignedTo !== cb.assignedTo || ca.updatedAt !== cb.updatedAt) return false;
  }
  return true;
}

getOrCreateStudyAtom(studyId: string): Atom<StudyInfo | undefined> {
  let a = this.studyAtoms.get(studyId);
  if (!a) {
    a = atom<StudyInfo | undefined>(`study:${studyId}`, undefined, {
      isEqual: studyEquals,
    });
    this.studyAtoms.set(studyId, a);
  }
  return a;
}
```

Key decision: include `updatedAt` in the comparison or not. Including it means the atom fires on every edit (since `updateChecklistAnswer` bumps it). Excluding it means list views won't show "last edited" updates in real-time, but the checklist editor doesn't cause cascading re-renders. Recommend excluding it from the equality check and instead using a dedicated "last activity" indicator that reads from Yjs awareness or a separate atom if needed.

### P2b: removing annotations from StudyInfo

After removing annotation building from `buildStudyFromYMap`, the `annotations` field on `StudyInfo` becomes dead. Removing it is a cascading change -- the type needs updating and any reference to `study.annotations` needs cleanup. From the search results, no component currently reads it (the only consumer was the useMemo we replaced with `useStudyAnnotations`). The `buildAnnotationsFromYMap` function and the `AnnotationEntry` type may still be needed by `useStudyAnnotations` -- check before removing.
