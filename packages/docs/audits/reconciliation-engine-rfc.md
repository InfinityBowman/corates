# RFC: Consolidate Reconciliation Views into a Deep ReconciliationEngine Module

## Problem

The reconciliation system has three near-identical implementations for AMSTAR2, ROB2, and ROBINS-I checklists. Each implementation consists of 7-14 files totaling ~750 lines for the core state machine, plus type-specific page and panel components. The three implementations share ~70% of their code.

### Shallow, tightly coupled modules

Each checklist type duplicates:

- A `*WithPdf.tsx` wrapper (~200 lines) -- split-screen layout, PDF viewer, presence tracking, remote cursors, scroll tracking, navbar state lifting
- A `*Reconciliation.tsx` main component (~750 lines) -- navigation state machine, localStorage persistence, auto-fill logic, save confirmation dialog, comparison display, summary stats
- A `*Navbar.tsx` component (~150 lines) -- question pills, presence indicators, summary/reset buttons
- A `*SummaryView.tsx` component (~200 lines) -- stats grid, clickable item list, save button
- A `navbar-utils.js` utility file (~150 lines) -- pure functions for navigation state calculations

### Integration risk in the seams

The `setNavbarStore` lifting pattern is the most structurally damaging decision. Each `*Reconciliation.tsx` pushes its internal state upward via a `useEffect` to the parent `*WithPdf.tsx`, which holds the state the navbar needs. This creates:

- Three separate `NavbarState` interface definitions with different field names (`questionKeys` vs `navItems`, `goToQuestion` vs `goToPage`)
- A bidirectional state channel through effects -- the wrapper owns no logic but holds the only reference to state the navbar reads
- Implicit coupling between the state producer (reconciliation body) and the state consumer (navbar)

### Why this makes the codebase harder to navigate and maintain

- Understanding "how reconciliation works" requires reading 5+ files per type, with 70% of the content identical
- Bug fixes must be applied three times (e.g., localStorage persistence, auto-fill edge cases, save validation)
- Zero test coverage for reconciliation -- the duplicated state machines are too entangled with Yjs and component lifecycle to test in isolation
- Adding a 4th checklist type (e.g., QUADAS-2, GRADE) requires duplicating the entire stack

### Files involved (current state)

**AMSTAR2** (10 files):
- `amstar2-reconcile/ReconciliationWithPdf.tsx` -- wrapper
- `amstar2-reconcile/ChecklistReconciliation.tsx` -- state machine
- `amstar2-reconcile/Navbar.tsx` -- navigation bar
- `amstar2-reconcile/SummaryView.tsx` -- summary view
- `amstar2-reconcile/Footer.tsx` -- summary footer
- `amstar2-reconcile/navbar-utils.js` -- nav utilities
- `amstar2-reconcile/ReconciliationQuestionPage.tsx` -- page router
- `amstar2-reconcile/MultiPartQuestionPage.tsx` -- multi-part page
- `amstar2-reconcile/AnswerPanel.tsx` -- answer display/edit
- `amstar2-reconcile/NotesCompareSection.tsx` -- note comparison

**ROB2** (14 files):
- `rob2-reconcile/ROB2ReconciliationWithPdf.tsx` -- wrapper
- `rob2-reconcile/ROB2Reconciliation.tsx` -- state machine
- `rob2-reconcile/ROB2Navbar.tsx` -- navigation bar
- `rob2-reconcile/ROB2SummaryView.tsx` -- summary view
- `rob2-reconcile/NavbarDomainPill.tsx` -- domain pill
- `rob2-reconcile/navbar-utils.js` -- nav utilities
- `rob2-reconcile/pages/PreliminaryPage.tsx`
- `rob2-reconcile/pages/SignallingQuestionPage.tsx`
- `rob2-reconcile/pages/DomainDirectionPage.tsx`
- `rob2-reconcile/pages/OverallDirectionPage.tsx`
- `rob2-reconcile/panels/ROB2AnswerPanel.tsx`
- `rob2-reconcile/panels/JudgementPanel.tsx`
- `rob2-reconcile/panels/DirectionPanel.tsx`

**ROBINS-I** (14 files):
- `robins-i-reconcile/RobinsIReconciliationWithPdf.tsx` -- wrapper
- `robins-i-reconcile/RobinsIReconciliation.tsx` -- state machine
- `robins-i-reconcile/RobinsINavbar.tsx` -- navigation bar
- `robins-i-reconcile/RobinsISummaryView.tsx` -- summary view
- `robins-i-reconcile/NavbarDomainPill.tsx` -- domain pill
- `robins-i-reconcile/navbar-utils.js` -- nav utilities
- `robins-i-reconcile/pages/SectionBQuestionPage.tsx`
- `robins-i-reconcile/pages/DomainQuestionPage.tsx`
- `robins-i-reconcile/pages/DomainJudgementPage.tsx`
- `robins-i-reconcile/pages/OverallJudgementPage.tsx`
- `robins-i-reconcile/panels/RobinsAnswerPanel.tsx`
- `robins-i-reconcile/panels/JudgementPanel.tsx`
- `robins-i-reconcile/panels/DirectionPanel.tsx`

---

## Proposed Interface

A single `ReconciliationEngine` component driven by a `ReconciliationAdapter` registered in the existing `CHECKLIST_REGISTRY`. The engine owns the full state machine; the adapter provides all type-specific behavior.

### Adapter interface

```typescript
interface ReconciliationNavItem {
  key: string;
  label: string;
  section: string;
  type: string;         // opaque to the engine, interpreted by the adapter
  meta?: Record<string, unknown>; // adapter-defined payload
}

interface ReconciliationAdapter {
  // Identity
  checklistType: string;
  title: string;
  pageCounterLabel: string;  // "Question" vs "Item"
  getPageLabel: (pageIndex: number) => string;

  // Navigation item building (called every render, must be memoizable)
  buildNavItems: (reconciledChecklist: unknown) => ReconciliationNavItem[];

  // Answer checking (pure functions)
  hasAnswer: (item: ReconciliationNavItem, finalAnswers: unknown) => boolean;
  isAgreement: (item: ReconciliationNavItem, comparison: unknown) => boolean;

  // Comparison (pure function, wraps type-specific compareChecklists)
  compare: (
    checklist1: unknown,
    checklist2: unknown,
    reconciledChecklist: unknown,
  ) => unknown;

  // Write operations (receive updateChecklistAnswer + getTextRef from engine)
  autoFillFromReviewer1: (
    item: ReconciliationNavItem,
    checklist1: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
    getTextRef: ((...args: unknown[]) => unknown) | null,
  ) => void;

  resetAllAnswers: (
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  ) => void;

  // Optional side effects (ROB2 auto-NA for skipped questions)
  onAfterNavigate?: (
    navItems: ReconciliationNavItem[],
    finalAnswers: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  ) => void;

  // Rendering
  renderPage: (context: EngineContext) => ReactNode;
  NavbarComponent: React.ComponentType<NavbarContext>;
  SummaryComponent: React.ComponentType<SummaryContext>;
  renderWarningBanner?: (
    checklist1: unknown,
    checklist2: unknown,
    reconciledChecklist: unknown,
  ) => ReactNode | null;
}
```

### Engine component props

```typescript
interface ReconciliationEngineProps {
  checklistType: ChecklistType;
  checklist1: unknown;
  checklist2: unknown;
  reconciledChecklist: unknown;
  reconciledChecklistId: string | null;
  reviewer1Name: string;
  reviewer2Name: string;
  onSaveReconciled: (name?: string) => void;
  onCancel: () => void;
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  getTextRef: ((...args: unknown[]) => unknown) | null;

  // PDF
  pdfData: ArrayBuffer | null;
  pdfFileName: string | null;
  pdfUrl: string | null;
  pdfLoading: boolean;
  pdfs: unknown[];
  selectedPdfId: string | null;
  onPdfSelect: (pdfId: string) => void;

  // Presence
  getAwareness?: () => unknown;
  currentUser: { id: string; name: string; image?: string | null } | null;
}
```

### Usage example (ReconciliationWrapper after migration)

```tsx
// Before: 45 lines of type-dispatch with three conditional branches
if (isRobinsI) return <RobinsIReconciliationWithPdf {...} />;
if (isRob2) return <ROB2ReconciliationWithPdf {...} />;
return <ReconciliationWithPdf {...} />;

// After: single component
return (
  <ReconciliationEngine
    checklistType={checklistType}
    checklist1={checklist1Data}
    checklist2={checklist2Data}
    reconciledChecklist={reconciledChecklistData}
    reconciledChecklistId={reconciledChecklistId}
    onSaveReconciled={handleSaveReconciled}
    onCancel={handleCancel}
    updateChecklistAnswer={(key, data) => {
      if (!reconciledChecklistId) return;
      updateChecklistAnswer?.(studyId, reconciledChecklistId, key, data);
    }}
    getTextRef={getTextRef}
    reviewer1Name={getReviewerName(checklist1Meta?.assignedTo)}
    reviewer2Name={getReviewerName(checklist2Meta?.assignedTo)}
    pdfData={pdfData}
    pdfFileName={pdfFileName}
    pdfUrl={pdfUrl}
    pdfLoading={pdfLoading}
    pdfs={studyPdfs}
    selectedPdfId={selectedPdfId}
    onPdfSelect={handlePdfSelect}
    getAwareness={getAwareness}
    currentUser={currentUser}
  />
);
```

### What complexity the engine hides

Everything below is currently duplicated three times. After this refactor it exists once inside the engine:

1. SplitScreenLayout wiring (defaultLayout, defaultRatio, showSecondPanel, headerContent)
2. Lazy-loaded EmbedPdfViewer with Suspense fallback and loading spinner
3. containerRef + onScroll + containerScrollY state for remote cursor positioning
4. useReconciliationPresence hook call and stableGetAwareness memoization
5. RemoteCursors overlay rendering
6. PresenceAvatars rendering and click-to-jump handler
7. The setNavbarStore lifting pattern -- eliminated entirely; nav state lives in the engine
8. Header composition (back button, title, reviewer names, presence avatars, navbar)
9. currentPage / viewMode state + localStorage persistence
10. Auto-fill-on-next logic (if !hasAnswer && isAgreement, call autoFillFromReviewer1)
11. goToNext / goToPrevious / goToPage navigation functions
12. allAnswered derived boolean
13. summaryStats computation (total, agreed, disagreed, agreementPercentage)
14. Save confirmation AlertDialog (title, description, Cancel/Finish buttons, saving state)
15. showToast.error guard on incomplete save
16. showToast.info on reset

---

## Dependency Strategy

**Category: In-process + Local-substitutable**

The reconciliation system is entirely in-process (React state, Yjs CRDT, localStorage). The only external dependency is the Yjs awareness protocol for presence, which is local-substitutable (can be tested with a mock awareness instance).

- **Adapter pure functions** (`hasAnswer`, `isAgreement`, `buildNavItems`, `compare`): In-process, directly testable with fixture data. No mocks needed.
- **Adapter write operations** (`autoFillFromReviewer1`, `resetAllAnswers`): Receive `updateChecklistAnswer` as a parameter. Tests provide a spy/mock function and assert on call arguments.
- **Adapter render methods** (`renderPage`, `NavbarComponent`, `SummaryComponent`): These compose existing page/panel components that are already self-contained. Testable with React Testing Library.
- **Engine state machine** (navigation, auto-fill, save flow): Extractable into a `useReconciliationEngine` hook. Testable with `renderHook` and a mock adapter.
- **Presence**: The `useReconciliationPresence` hook takes a `getAwareness` function. Tests provide a mock awareness instance.

---

## Testing Strategy

### New boundary tests to write

1. **Engine state machine** (via `useReconciliationEngine` hook with mock adapter):
   - localStorage persistence: mount with stored state, verify currentPage/viewMode restored
   - Auto-fill trigger: advance past unanswered item where isAgreement=true, verify autoFillFromReviewer1 called
   - Auto-fill skip: advance past answered item, verify autoFillFromReviewer1 NOT called
   - allAnswered gate: verify save is blocked when hasAnswer returns false for any item
   - Summary stats: verify correct counts for mixed agreement/disagreement scenarios
   - Reset: verify resetAllAnswers called and navigation reset to page 0

2. **Adapter pure functions** (per checklist type):
   - buildNavItems: given a checklist state, verify correct nav item array
   - hasAnswer: given an item and finalAnswers, verify boolean result
   - isAgreement: given an item and comparison, verify boolean result
   - compare: given two checklists, verify comparison structure

3. **Integration** (engine + adapter):
   - Mount ReconciliationEngine with real adapter and mock data
   - Verify page rendering dispatches correctly per nav item type
   - Verify navbar renders with correct pill states
   - Verify summary view shows correct stats and item states

### Old tests to replace

- There are currently zero tests for reconciliation components. Nothing to delete.
- The existing `checklist-compare.test.js` and `checklist.test.js` tests for AMSTAR2 comparison logic remain valid and unchanged (they test shared package functions, not the reconciliation UI).

### Test environment needs

- React Testing Library + jsdom (already configured in landing package)
- `renderHook` from `@testing-library/react` for the engine hook
- Mock Yjs awareness instance for presence tests
- No Durable Object or backend dependencies needed

---

## Implementation Recommendations

### What the module should own (responsibilities)

The ReconciliationEngine module owns every subsystem that is currently identical across the three checklist types:

- **Navigation state machine**: currentPage, viewMode, localStorage persistence, goToNext/goToPrevious/goToPage with auto-fill trigger
- **Save flow**: finishDialogOpen, saving state, validation (allAnswered), confirmation dialog, toast notifications
- **Presence integration**: useReconciliationPresence call, RemoteCursors, PresenceAvatars, scroll tracking
- **Layout shell**: SplitScreenLayout, lazy EmbedPdfViewer, header composition
- **Summary stats**: total/agreed/disagreed/agreementPercentage derived from adapter's hasAnswer and isAgreement
- **Reset flow**: calls adapter.resetAllAnswers, resets navigation to page 0, shows toast

### What it should hide (implementation details)

- The `setNavbarStore` state lifting pattern is eliminated. The engine holds navigation state directly and passes it to the adapter's NavbarComponent via props. No intermediate useEffect chain.
- localStorage key construction and persistence timing
- Presence awareness subscription lifecycle (stableGetAwareness memoization)
- PDF viewer lazy loading and Suspense boundaries
- Container scroll tracking for remote cursor positioning
- Auto-fill eligibility detection (the engine decides WHEN to auto-fill; the adapter decides WHAT to fill)

### What it should expose (the interface contract)

- `ReconciliationEngine` component: the single public entry point
- `ReconciliationAdapter` interface: the contract each checklist type implements
- `ReconciliationNavItem` type: the shared navigation item shape
- `EngineContext`, `NavbarContext`, `SummaryContext` types: what the adapter receives for rendering
- Registration in `CHECKLIST_REGISTRY` via a `reconciliation` key on each checklist config

### How callers should migrate

**Phase 1 -- Infrastructure (no behavior change)**

Create the engine types, the `useReconciliationEngine` hook (extracted from the three `*Reconciliation.tsx` files), and the `ReconciliationEngine` shell component. Write boundary tests for the hook with a mock adapter.

**Phase 2 -- AMSTAR2 adapter**

Create `amstar2Adapter` implementing the `ReconciliationAdapter` interface. Extract `buildNavItems` from `getQuestionKeys()`, `hasAnswer` from `navbar-utils.js`, comparison from `checklist-compare.js`. Wire `renderPage` to the existing `ReconciliationQuestionPage` component. Wire `NavbarComponent` to the existing `Navbar`. Wire `SummaryComponent` to the existing `SummaryView`.

Update `ReconciliationWrapper` for AMSTAR2 only (keep other types on old path). Verify with E2E tests.

**Phase 3 -- ROB2 adapter**

Create `rob2Adapter`. Special attention to: skippable-questions logic (moves into `onAfterNavigate`), earlyComplete domain detection (moves into `buildNavItems` or a helper), aim mismatch warning (moves into `renderWarningBanner`), Y.Text comment copying (stays in `autoFillFromReviewer1` where the adapter calls `getTextRef`).

Migrate ROB2 path in `ReconciliationWrapper`. Verify.

**Phase 4 -- ROBINS-I adapter**

Create `robinsIAdapter`. Section B critical risk warning moves into `renderWarningBanner`. Per-protocol domain selection is derived inside `buildNavItems` from the reconciled checklist state.

Migrate ROBINS-I path. Verify.

**Phase 5 -- Cleanup**

Delete the three `*WithPdf.tsx` wrappers, the three `*Reconciliation.tsx` state machines, the three `*Navbar.tsx` components, the three `*SummaryView.tsx` components, and the three `navbar-utils.js` files. Keep all page and panel components (they are consumed by adapters with no structural change).

### Critical implementation details

**getTextRef normalization**: The three types receive different Yjs text accessor functions (`getQuestionNote`, `getRob2Text`, `getRobinsText`) with different signatures. The wrapper normalizes these into a single `getTextRef` prop before passing to the engine. The adapter calls it with the correct argument pattern for its type inside `autoFillFromReviewer1` and `renderPage`.

**ROB2 skippable-questions side effect**: The auto-NA logic currently in a `useEffect` in `ROB2Reconciliation.tsx` moves into the adapter's `onAfterNavigate` method. The engine calls it after each navigation step. AMSTAR2 and ROBINS-I adapters omit this method.

**localStorage key stability**: Each type currently uses a different key prefix. The engine uses a unified `recon-nav-${checklistType}-${c1id}-${c2id}` format. Existing persisted state from old keys will be silently ignored on first load (defaults to page 0), which is safe.

**Adapter identity stability**: Adapters are registered as static objects in the CHECKLIST_REGISTRY, not constructed per-render. The engine looks up `CHECKLIST_REGISTRY[checklistType].reconciliation` once. No memoization concerns.

**finalAnswers reactivity**: The Yjs-backed reconciledChecklist prop changes reference every time Yjs updates. The engine's useMemo for navItems and comparison must include reconciledChecklist as a dependency to stay reactive.

**NavbarComponent receives unified context**: ROB2 needs `aimMismatch` and `skippableQuestions`. Rather than adding these to the shared context, the ROB2 NavbarComponent recomputes them internally from `finalAnswers` + `navItems` (which it already has). The aim mismatch visual warning moves to `renderWarningBanner` (engine-owned render slot).

### Estimated impact

- ~1,400 lines of duplicated code eliminated
- ~15 files deleted (3 wrappers, 3 state machines, 3 navbars, 3 summaries, 3 nav-utils)
- ~8 new files created (types, hook, engine, 3 adapters, adapter index, barrel export)
- Net reduction: ~600 lines
- Zero changes to any page or panel component
- All existing E2E tests pass without modification
- Adding a 4th checklist type: 1 adapter file + 1 registry entry (vs 7-14 files today)
