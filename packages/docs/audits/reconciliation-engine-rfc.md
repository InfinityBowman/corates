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

### Nav item model

```typescript
// Unified navigation item. All three types reduce to this shape.
// The engine iterates over these; the adapter interprets them.
interface ReconciliationNavItem {
  key: string; // unique key (e.g. "q1", "d1_q1", "overall_direction")
  label: string; // display label for pills and summary ("1", "D2", "B3")
  section: string; // grouping section for navbar and summary
  type: string; // opaque to engine, interpreted by adapter
  domainKey?: string; // ROB2/ROBINS-I domain identifier (optional)
  meta?: Record<string, unknown>; // adapter-defined payload
}
```

### Adapter interface

```typescript
interface ReconciliationAdapter {
  // --- Identity ---
  checklistType: string;
  title: string; // "Reconciliation", "ROB-2 Reconciliation"
  pageCounterLabel: string; // "Question" vs "Item"
  getPageLabel: (pageIndex: number) => string;

  // --- Data derivation ---

  // Build the flat navigation item array from reconciledChecklist state.
  // ROB2: reads preliminary.aim to determine active domains.
  // ROBINS-I: reads sectionC.isPerProtocol to determine domain 1A/1B.
  // AMSTAR2: static list from getQuestionKeys().
  buildNavItems: (reconciledChecklist: unknown) => ReconciliationNavItem[];

  // Derive the finalAnswers object from reconciledChecklist.
  // AMSTAR2: filters by questionKeys, groups multi-part questions (q9->{q9a,q9b}).
  // ROB2/ROBINS-I: returns reconciledChecklist || {} (direct pass-through).
  deriveFinalAnswers: (reconciledChecklist: unknown) => unknown;

  // Run the type-specific comparison algorithm.
  // AMSTAR2: returns {agreements, disagreements} keyed by question.
  // ROB2: returns {preliminary, domains, overall} with per-domain comparison.
  // ROBINS-I: returns {sectionB, domains, overall} with per-domain comparison.
  compare: (checklist1: unknown, checklist2: unknown, reconciledChecklist: unknown) => unknown;

  // --- Answer checking (pure functions) ---

  hasAnswer: (item: ReconciliationNavItem, finalAnswers: unknown) => boolean;
  isAgreement: (item: ReconciliationNavItem, comparison: unknown) => boolean;

  // --- Write operations ---

  // Copy reviewer1's answer for this item into the reconciled checklist.
  // For ROB2/ROBINS-I, this also copies comment text to Y.Text via getTextRef.
  autoFillFromReviewer1: (
    item: ReconciliationNavItem,
    checklist1: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
    getTextRef: ((...args: unknown[]) => unknown) | null,
  ) => void;

  // Reset all answers to empty/default state.
  resetAllAnswers: (updateChecklistAnswer: (sectionKey: string, data: unknown) => void) => void;

  // Optional: called after each navigation step.
  // ROB2 uses this to auto-set NA for skipped questions.
  // ROBINS-I will use this when scoring-based skip detection is added.
  onAfterNavigate?: (
    navItems: ReconciliationNavItem[],
    finalAnswers: unknown,
    updateChecklistAnswer: (sectionKey: string, data: unknown) => void,
  ) => void;

  // --- Rendering ---

  // Render the question/item page for the current nav item.
  // The adapter slices reviewer data from raw checklists, builds write
  // callbacks, and composes the existing page components.
  renderPage: (context: EngineContext) => ReactNode;

  // Type-specific navbar (flat pills for AMSTAR2, grouped domain pills for ROB2/ROBINS-I).
  NavbarComponent: React.ComponentType<NavbarContext>;

  // Type-specific summary view. AMSTAR2's includes a reconciledName input field.
  SummaryComponent: React.ComponentType<SummaryContext>;

  // Optional: warning banner above the page content.
  // ROB2: aim mismatch warning.
  // ROBINS-I: section B critical risk warning.
  renderWarningBanner?: (checklist1: unknown, checklist2: unknown, reconciledChecklist: unknown) => ReactNode | null;
}
```

### Context types passed to adapter render methods

```typescript
// Passed to adapter.renderPage() for the current navigation item.
// The adapter uses these raw materials to slice the right reviewer data,
// build write callbacks, and compose existing page components.
interface EngineContext {
  currentItem: ReconciliationNavItem;
  checklist1: unknown;
  checklist2: unknown;
  finalAnswers: unknown; // derived via adapter.deriveFinalAnswers
  comparison: unknown; // from adapter.compare
  reviewer1Name: string;
  reviewer2Name: string;
  isAgreement: boolean; // pre-computed by engine
  updateChecklistAnswer: (sectionKey: string, data: unknown) => void;
  getTextRef: ((...args: unknown[]) => unknown) | null;
}

// Passed to adapter.NavbarComponent.
// The engine provides all navigation state; the navbar renders type-specific UI.
interface NavbarContext {
  navItems: ReconciliationNavItem[];
  currentPage: number;
  viewMode: 'questions' | 'summary';
  finalAnswers: unknown;
  comparison: unknown;
  usersByPage: Map<number, RemoteUser[]>;

  // Navigation callbacks
  goToPage: (index: number) => void;
  setViewMode: (mode: 'questions' | 'summary') => void;
  onReset: () => void;

  // Domain expansion (ROB2/ROBINS-I use these; AMSTAR2 ignores them)
  expandedDomain: string | null;
  setExpandedDomain: (domain: string | null) => void;
}

// Passed to adapter.SummaryComponent.
interface SummaryContext {
  navItems: ReconciliationNavItem[];
  finalAnswers: unknown;
  comparison: unknown;
  summaryStats: {
    total: number;
    agreed: number;
    disagreed: number;
    agreementPercentage: number;
    answered: number;
  };
  allAnswered: boolean;
  saving: boolean;
  onGoToPage: (index: number) => void;
  onSave: () => void;
  onBack: () => void;

  // Reconciled checklist name (AMSTAR2 renders an input for this;
  // ROB2/ROBINS-I ignore it)
  reconciledName: string;
  onReconciledNameChange: (name: string) => void;
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

### Engine internal state

The engine owns this state directly (no `setNavbarStore` lifting):

```typescript
// Navigation
currentPage: number;              // persisted to localStorage
viewMode: 'questions' | 'summary'; // persisted to localStorage
expandedDomain: string | null;    // auto-synced when navigating

// Save flow
saving: boolean;
finishDialogOpen: boolean;
reconciledName: string;           // default: 'Reconciled Checklist'

// Derived (via useMemo)
navItems: ReconciliationNavItem[];         // adapter.buildNavItems(reconciledChecklist)
finalAnswers: unknown;                     // adapter.deriveFinalAnswers(reconciledChecklist)
comparison: unknown;                       // adapter.compare(c1, c2, reconciledChecklist)
allAnswered: boolean;                      // navItems.every(item => adapter.hasAnswer(item, finalAnswers))
summaryStats: { total, agreed, disagreed, agreementPercentage, answered };

// Presence (from useReconciliationPresence)
remoteUsers, usersByPage, usersWithCursors;
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
10. expandedDomain state + auto-expand on navigate (using `navItems[targetPage].section`)
11. Auto-fill-on-next logic (if !hasAnswer && isAgreement, call autoFillFromReviewer1)
12. goToNext / goToPrevious / goToPage navigation functions
13. allAnswered derived boolean
14. summaryStats computation (total, agreed, disagreed, agreementPercentage)
15. Save confirmation AlertDialog (title, description, Cancel/Finish buttons, saving state)
16. reconciledName state (default: 'Reconciled Checklist')
17. showToast.error guard on incomplete save
18. showToast.info on reset

---

## Dependency Strategy

**Category: In-process + Local-substitutable**

The reconciliation system is entirely in-process (React state, Yjs CRDT, localStorage). The only external dependency is the Yjs awareness protocol for presence, which is local-substitutable (can be tested with a mock awareness instance).

- **Adapter pure functions** (`hasAnswer`, `isAgreement`, `buildNavItems`, `compare`, `deriveFinalAnswers`): In-process, directly testable with fixture data. No mocks needed.
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
   - expandedDomain auto-sync: verify goToPage updates expandedDomain to target item's section
   - deriveFinalAnswers: verify it's called with reconciledChecklist and result used for hasAnswer/isAgreement

2. **Adapter pure functions** (per checklist type):
   - buildNavItems: given a checklist state, verify correct nav item array
   - deriveFinalAnswers: given reconciledChecklist, verify correct transformation (especially AMSTAR2 multi-part grouping)
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
- **Domain expansion**: expandedDomain state, auto-expand on navigate (using `navItems[targetPage].section`), setExpandedDomain for navbar-initiated expansion
- **Save flow**: finishDialogOpen, saving, reconciledName state, validation (allAnswered), confirmation dialog, toast notifications
- **Presence integration**: useReconciliationPresence call, RemoteCursors, PresenceAvatars, scroll tracking
- **Layout shell**: SplitScreenLayout, lazy EmbedPdfViewer, header composition
- **Derived state**: finalAnswers (via adapter.deriveFinalAnswers), comparison (via adapter.compare), summaryStats, allAnswered
- **Reset flow**: calls adapter.resetAllAnswers, resets navigation to page 0, shows toast

### What it should hide (implementation details)

- The `setNavbarStore` state lifting pattern is eliminated. The engine holds navigation state directly and passes it to the adapter's NavbarComponent via props. No intermediate useEffect chain.
- localStorage key construction and persistence timing
- Presence awareness subscription lifecycle (stableGetAwareness memoization)
- PDF viewer lazy loading and Suspense boundaries
- Container scroll tracking for remote cursor positioning
- Auto-fill eligibility detection (the engine decides WHEN to auto-fill; the adapter decides WHAT to fill)
- expandedDomain auto-sync logic (engine auto-expands the section containing the target page on every navigation)
- reconciledName state management (engine holds it, SummaryContext exposes it; only AMSTAR2's SummaryComponent renders a name input)

### What it should expose (the interface contract)

- `ReconciliationEngine` component: the single public entry point
- `ReconciliationAdapter` interface: the contract each checklist type implements
- `ReconciliationNavItem` type: the shared navigation item shape
- `EngineContext`: what the adapter's renderPage receives (raw checklists, finalAnswers, comparison, current item, write callbacks, getTextRef)
- `NavbarContext`: what the adapter's NavbarComponent receives (navItems, navigation state, expandedDomain + setter, usersByPage, callbacks)
- `SummaryContext`: what the adapter's SummaryComponent receives (navItems, stats, reconciledName + setter, save/back callbacks)
- Registration in `CHECKLIST_REGISTRY` via a `reconciliation` key on each checklist config

### How callers should migrate

**Phase 1 -- Infrastructure (no behavior change)**

Create the engine types, the `useReconciliationEngine` hook (extracted from the three `*Reconciliation.tsx` files), and the `ReconciliationEngine` shell component. Write boundary tests for the hook with a mock adapter.

**Phase 2 -- AMSTAR2 adapter**

Create `amstar2Adapter` implementing the `ReconciliationAdapter` interface:

- `buildNavItems`: wraps `getQuestionKeys()`, maps each to a `ReconciliationNavItem` with `meta: { isMultiPart }`
- `deriveFinalAnswers`: extracts the filter/group logic from `ChecklistReconciliation.tsx` lines 136-157 (filters by questionKeys, groups multi-part q9/q11)
- `hasAnswer`: lifts `hasQuestionAnswer` from `navbar-utils.js`
- `compare`: wraps AMSTAR2 `compareChecklists` from shared package
- `renderPage`: slices `checklist1[questionKey]` and `checklist2[questionKey]` for current item, builds `handleFinalChange` callback, passes to existing `ReconciliationQuestionPage`
- `NavbarComponent`: wraps existing flat `Navbar` (ignores expandedDomain/setExpandedDomain)
- `SummaryComponent`: wraps existing `SummaryView` with reconciledName input

Update `ReconciliationWrapper` for AMSTAR2 only (keep other types on old path). Verify with E2E tests.

**Phase 3 -- ROB2 adapter**

Create `rob2Adapter`:

- `buildNavItems`: wraps existing `buildNavigationItems(isAdhering)` where `isAdhering` is derived from `reconciledChecklist?.preliminary?.aim`
- `deriveFinalAnswers`: returns `reconciledChecklist || {}`
- `renderPage`: dispatches on `item.type` to render PreliminaryPage, SignallingQuestionPage, DomainDirectionPage, or OverallDirectionPage. For each, slices reviewer data from `checklist1[domainKey]`, builds `onUseReviewer1/2` callbacks that both update the answer AND copy comment text via `getTextRef`
- `onAfterNavigate`: extracts the skippable-questions auto-NA logic from `ROB2Reconciliation.tsx`
- `renderWarningBanner`: renders aim mismatch warning
- `NavbarComponent`: wraps existing `ROB2Navbar` + `NavbarDomainPill`, uses expandedDomain/setExpandedDomain from NavbarContext

Migrate ROB2 path in `ReconciliationWrapper`. Verify.

**Phase 4 -- ROBINS-I adapter**

Create `robinsIAdapter`:

- `buildNavItems`: uses `isPerProtocol` from `checklist1?.sectionC?.isPerProtocol` to determine domain structure
- `deriveFinalAnswers`: returns `reconciledChecklist || {}`
- `renderPage`: dispatches on `item.type` to render SectionBQuestionPage, DomainQuestionPage, DomainJudgementPage, or OverallJudgementPage. For DomainJudgementPage, builds four separate `onUseReviewer*` callbacks (judgement and direction independently)
- `renderWarningBanner`: renders section B critical risk warning
- `NavbarComponent`: wraps existing `RobinsINavbar` + `NavbarDomainPill`, uses expandedDomain/setExpandedDomain from NavbarContext

Migrate ROBINS-I path. Verify.

**Phase 5 -- Cleanup**

Delete the three `*WithPdf.tsx` wrappers, the three `*Reconciliation.tsx` state machines, the three `*Navbar.tsx` components, the three `*SummaryView.tsx` components, and the three `navbar-utils.js` files. Keep all page and panel components (they are consumed by adapters with no structural change).

### Critical implementation details

**finalAnswers derivation**: AMSTAR2 is the only type that transforms `reconciledChecklist` -- it filters by questionKeys and groups multi-part questions (q9 -> {q9a, q9b}). ROB2 and ROBINS-I pass through directly as `reconciledChecklist || {}`. The adapter's `deriveFinalAnswers` method handles this difference. The engine calls it in a `useMemo` with `reconciledChecklist` as a dependency and passes the result to all adapter methods that need it.

**expandedDomain is bidirectional**: Both the engine (via goToPage/goToNext/goToPrevious) and the navbar (via handleDomainClick) can change it. The engine owns the state and passes both the value and setter in NavbarContext. The engine auto-expands on navigate using `navItems[targetPage].section`. The navbar needs standalone `setExpandedDomain` for the case where a user clicks a domain pill that has all items answered (expand without navigate).

**renderPage prop mapping**: Each adapter's `renderPage` receives the raw `EngineContext` and performs type-specific data slicing internally. For example, ROB2's adapter for a SignallingQuestionPage extracts `checklist1[domainKey].answers[questionKey]` for reviewer data and builds `onUseReviewer1` callbacks that both call `updateChecklistAnswer(domainKey, {answers: {[questionKey]: {answer}}})` AND copy comment text via `getTextRef(domainKey, 'comment', questionKey)`. This slicing IS type-specific knowledge and belongs in the adapter, not the engine.

**reconciledName**: Only AMSTAR2 uses it. The engine always holds `reconciledName` state (default: `'Reconciled Checklist'`) and always calls `onSaveReconciled(reconciledName)`. The SummaryContext includes `reconciledName` and `onReconciledNameChange`. AMSTAR2's SummaryComponent renders a name input field; ROB2 and ROBINS-I SummaryComponents ignore these fields. The wrapper's `handleSaveReconciled` already accepts an optional name parameter and defaults to `'Reconciled Checklist'`, so this is backward-compatible.

**getTextRef normalization**: The three types receive different Yjs text accessor functions (`getQuestionNote`, `getRob2Text`, `getRobinsText`) with different signatures. The wrapper normalizes these into a single `getTextRef` prop before passing to the engine. The adapter calls it with the correct argument pattern for its type inside `autoFillFromReviewer1` and `renderPage`. The engine never calls `getTextRef` directly -- it's opaque pass-through.

**Skippable-questions side effects via `onAfterNavigate`**: ROB2's auto-NA logic (currently in a `useEffect` in `ROB2Reconciliation.tsx`) moves into the adapter's `onAfterNavigate` method. The engine calls it after each navigation step. ROBINS-I will likely gain similar skip logic in the future (scoring can cause certain questions to become skippable, though users currently select manually). The `onAfterNavigate` hook is the designated seam for both -- when ROBINS-I adds skip detection, it implements this same adapter method without touching the engine. AMSTAR2 omits this method.

**localStorage key stability**: Each type currently uses a different key prefix. The engine uses a unified `recon-nav-${checklistType}-${c1id}-${c2id}` format. Existing persisted state from old keys will be silently ignored on first load (defaults to page 0), which is safe.

**Adapter identity stability**: Adapters are registered as static objects in the CHECKLIST_REGISTRY, not constructed per-render. The engine looks up `CHECKLIST_REGISTRY[checklistType].reconciliation` once. No memoization concerns.

**finalAnswers reactivity**: The Yjs-backed reconciledChecklist prop changes reference every time Yjs updates. The engine's useMemo for navItems, finalAnswers, and comparison must include reconciledChecklist as a dependency to stay reactive.

**NavbarComponent type-specific state**: ROB2 needs `aimMismatch` and `skippableQuestions` for its navbar display. Rather than adding these to the shared NavbarContext, the ROB2 NavbarComponent recomputes them internally from `finalAnswers` + `navItems` (which it already has in NavbarContext). The aim mismatch visual warning banner moves to `renderWarningBanner` (engine-owned render slot, rendered above the page content).

### Estimated impact

- ~1,400 lines of duplicated code eliminated
- ~15 files deleted (3 wrappers, 3 state machines, 3 navbars, 3 summaries, 3 nav-utils)
- ~8 new files created (types, hook, engine, 3 adapters, adapter index, barrel export)
- Net reduction: ~600 lines
- Zero changes to any page or panel component
- All existing E2E tests pass without modification
- Adding a 4th checklist type: 1 adapter file + 1 registry entry (vs 7-14 files today)
