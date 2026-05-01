Reactive Yjs Hooks Prototype -- @tldraw/state

Status: Proposal
Last updated: 2026-04-30

Problem

The sync manager (sync.ts) already does per-study dirty tracking via studyCache.
But the final step -- sortedStudies = [...studyCache.values()] -- creates a new
array every sync, which replaces the entire studies array in Zustand via immer.
Every component that reads any study re-renders, even if their specific study
didn't change. Forms re-initialize, modals lose state, selectors fire for
unrelated updates.

This is a structural problem, not a bug-by-bug fix. The Zustand array is the
wrong data structure for per-entity collaborative state.

Approach

Use @tldraw/state (npm package, ~3,800 lines, only depends on @tldraw/utils) as
the reactive primitive layer between Yjs and React. Keep Yjs for sync/CRDT. Keep
Zustand for non-collaborative UI state (tab selection, modal open/close, etc).

@tldraw/state provides:

- atom(name, value, options?) -- mutable cell with equality-gated set()
- computed(name, fn) -- derived value that only recomputes when dependencies change
- AtomMap -- reactive Map<K, Atom<V>> with per-key subscriptions
- useValue(atom) -- React hook via useSyncExternalStore, re-renders only when
  the atom's value actually changes (by equality check)
- transact(fn) -- batch multiple atom writes into one notification pass

The key property: atom.set(newValue) is a no-op if newValue equals the current
value (shallow equality by default, configurable). This is the missing gate that
studyCache already computes but Zustand discards.

Architecture

Y.Doc (Yjs)
|
| observe / observeDeep
v
Sync Manager (sync.ts)
|
| atom.set(serializedStudy) <-- equality gate here
v
AtomMap<studyId, StudyInfo> <-- one atom per study
|
| useValue(atom) <-- React subscribes to individual atoms
v
React components <-- only re-render when THEIR study changes

Zustand stays for: - Connection lifecycle state - UI state (active tab, modal open/close, selection) - Non-collaborative derived state (project stats, preferences)

Zustand does NOT keep: - Project metadata (name, settings) -- same referential instability problem - Members list -- same problem, just less frequent - Studies -- the primary motivation for this work

All collaborative data from Y.Doc goes through atoms. This avoids having
two read patterns for the same class of data.

What to prototype

Phase 1: StudyAtomMap + useStudy hook

Install @tldraw/state and @tldraw/state-react.

Create a StudyAtomMap in the sync manager:

    const studyAtoms = new AtomMap<string, StudyInfo>()

In handleReviewsEvents, instead of rebuilding the full array and calling
setProjectData, write individual atoms:

    for (const [studyId, study] of studyCache) {
      if (dirtyStudyIds.has(studyId)) {
        studyAtoms.set(studyId, study)
      }
    }

Expose a React hook:

    function useStudy(studyId: string): StudyInfo | undefined {
      const atom = studyAtoms.getAtom(studyId)
      return useValue(atom)
    }

Expose a study order atom for list rendering:

    const studyOrder = atom<string[]>('studyOrder', [])

    function useStudyIds(): string[] {
      return useValue(studyOrder)
    }

List components use useStudyIds() to get the array of IDs, then each row
uses useStudy(id). Adding/removing studies changes the order atom. Editing
a study's fields only touches that study's atom -- other rows don't re-render.

Phase 1b: Meta and members atoms

Apply the same pattern to project metadata and members. These have the same
referential instability problem as studies -- just triggered less often. Since
the atom infrastructure exists from Phase 1, this is trivial:

    const projectMeta = atom<ProjectMeta>('projectMeta', defaultMeta)
    const membersAtom = atom<MemberInfo[]>('members', [])

This ensures all collaborative Y.Doc data flows through one read pattern
(atoms + useValue), with Zustand reserved for genuinely non-collaborative
state.

Phase 2: Snapshot isolation hook

Even with per-study atoms solving most re-render problems, same-entity
conflicts still need isolation. If two users are both editing study-5's
reviewers simultaneously, the atom for study-5 will update from the remote
peer. A modal editing that same study needs to capture-and-hold during the
editing session.

Atoms reduce the blast radius (unrelated studies no longer trigger it), but
same-entity remote updates still can. Generalize the useEffectEvent pattern
from the reviewer modal fix:

    function useSnapshotValue<T>(liveValue: T, isEditing: boolean): T {
      const snapshotRef = useRef(liveValue);
      if (!isEditing) snapshotRef.current = liveValue;
      return isEditing ? snapshotRef.current : liveValue;
    }

Every modal/form that edits collaborative data uses useSnapshotValue with
the atom-backed live value. The atom provides referential stability across
unrelated syncs; the snapshot provides isolation from same-entity syncs
during edits.

Phase 3: Computed selectors

Replace derived Zustand selectors with computed():

    const studiesForTab = computed('studiesForTab', () => {
      return studyOrder.get()
        .map(id => studyAtoms.get(id))
        .filter(s => matchesTab(s, activeTab))
    })

These only recompute when their input atoms change. If a study that isn't
in the current tab gets updated, the tab's computed doesn't fire.

Phase 4: Migrate one component end-to-end

Pick ChecklistYjsWrapper or AllStudiesTab. Replace the Zustand
selectStudies selector with useStudy / useStudyIds. Verify:

    - Opening a modal and editing doesn't get interrupted by unrelated syncs
    - Assigning reviewers in the modal survives background Y.Doc updates
    - The component only re-renders when its specific study changes
    - No regressions in E2E tests

Phase 5: Evaluate and expand

If Phase 3 validates the approach:

    - Migrate remaining study consumers
    - Consider AtomMaps for checklist answers (useChecklistAnswers currently
      observes the entire reviews Y.Map -- same broad-observer problem)
    - Remove studies array from Zustand projectStore
    - Delete the reactive-yjs-hooks-plan.md predecessor doc

What NOT to prototype

- Don't replace Yjs sync -- keep y-websocket / Durable Object sync as-is
- Don't build a custom sync protocol -- Yjs CRDTs work fine for this use case
- Don't remove Zustand -- it stays for connection lifecycle, UI state, and
  non-collaborative derived state. All collaborative Y.Doc data moves to atoms.
- Don't vendor / fork @tldraw/state yet -- use the npm package first, only
  vendor if the dependency becomes a problem
- Don't add tldraw's HistoryBuffer or rollback transactions -- not needed
  for this use case

Dependencies

@tldraw/state (4.5.10) -- core atoms, computed, transactions
@tldraw/state-react (4.5.10) -- useValue, useComputed, useAtom hooks
@tldraw/utils (4.5.10) -- transitive dep, 5 utility functions

All are MIT licensed. Combined footprint is ~4,400 lines. No other transitive
dependencies.

Risk assessment

Low risk: - Additive change -- new hooks alongside existing Zustand, migrate gradually - @tldraw/state is well-tested, used in production by tldraw - Existing E2E tests validate behavior, not implementation

Medium risk: - Two state systems during migration (atoms + Zustand) -- need clear ownership
boundaries per data type

Watch for: - Interaction between tldraw's transact() and Yjs transactions - Whether @tldraw/state-react's useValue plays well with React Compiler --
useValue uses useSyncExternalStore (which the compiler handles fine) but
tldraw may wrap it with patterns the compiler doesn't optimize well.
Worth a 10-minute check: install the packages, write a test component,
run the compiler, see what it emits.

Success criteria

- AssignReviewersModal no longer needs useEffectEvent guard (the underlying
  atom doesn't change reference when an unrelated study syncs)
- useChecklistAnswers uses the study atom for reading finalized state (study
  status, reviewer assignments), but retains direct Y.Doc access for the live
  editing path (Y.Text instances for collaborative checklist editing). Both
  read patterns coexist -- atoms for serialized state, direct Yjs for live
  collaborative types
- Opening a modal during active collaboration doesn't re-initialize form state
- No increase in total re-render count (measure with React DevTools profiler)
- All existing E2E tests pass without modification
