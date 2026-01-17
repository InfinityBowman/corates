# SolidJS Best Practices Audit

**Date:** 2026-01-17
**Reference:** Brenley Dueck's SolidJS Best Practices (January 12, 2026)
**Scope:** packages/web/src codebase and documentation

---

## Executive Summary

The CoRATES codebase demonstrates **strong adherence** to SolidJS best practices in most areas. The team has done excellent work on prop handling, control-flow components, and store usage. However, several areas need attention, particularly around `createEffect` usage and state synchronization patterns.

| Category | Status | Priority |
|----------|--------|----------|
| Props (no destructuring) | Excellent | N/A |
| Control-flow (Show/For) | Excellent | N/A |
| Stores for complex objects | Good | Low |
| createEffect usage | Needs attention | Medium |
| Derived state patterns | Needs attention | Medium |
| Signal passing in JSX | Minor issues | Low |
| Documentation | Good, gaps identified | Low |

---

## Code Findings

### 1. Prop Destructuring - EXCELLENT

**Status:** No violations found

All ~100+ components properly access props via `props.propertyName` without destructuring. Examples of correct patterns used throughout:

```js
// Correct pattern used everywhere
export default function ScoreTag(props) {
  const showRatingOnly = () => props.showRatingOnly ?? false;
  const checklistType = () => props.checklistType || DEFAULT_CHECKLIST_TYPE;
}
```

### 2. Control-Flow Components (Show/For) - EXCELLENT

**Status:** No violations found

The codebase consistently uses:
- `<Show when={condition}>` instead of `{condition && <Component />}`
- `<Show when={condition} fallback={<Fallback />}>` instead of ternary operators
- `<For each={array}>` instead of `.map()` in JSX

### 3. createEffect Usage - NEEDS ATTENTION

**Status:** ~9 instances of anti-patterns found out of ~70 total effects

#### High Priority Fixes

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `MultiPartQuestionPage.jsx` | 38-64 | State sync: initializes localFinal from props | Use createMemo |
| `SignallingQuestion.jsx` | 21-29 | State coercion: NA to NI | Move to event handler |

#### Medium Priority

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `SplitScreenLayout.jsx` | 24-26 | Simple prop sync | Use prop directly |
| `EditPdfMetadataModal.jsx` | 31-40 | Form reset on prop change | Consider dedicated handler |

#### Legitimate Uses (No changes needed)

Most createEffect instances are legitimate:
- DOM manipulation and event listeners (Sidebar, DevPanel)
- Browser API integration (localStorage, online status)
- Third-party library integration (PDF loading, blob URLs)
- Resource cleanup with onCleanup
- Controlled/uncontrolled component initialization (AMSTAR2Checklist:797-812 - initializes mutable local state from props with fallback creation)

### 4. Store vs Signal for Complex Objects - GOOD

**Status:** 3 files should use createStore instead of createSignal

#### Should Convert to createStore

| File | Lines | Current Pattern | Benefit |
|------|-------|-----------------|---------|
| `Sidebar.jsx` | 37-38, 95-105 | `createSignal({})` for expandedProjects | Fine-grained reactivity per project ID |
| `DevPanel.jsx` | 46-50 | Separate position/size/dragOffset signals | Eliminate cross-property re-renders |
| `form-errors.js` | 136, 157-170 | `createSignal({})` for fieldErrors | Only affected fields re-render |

### 5. Derived State Patterns - NEEDS ATTENTION

**Status:** 2 files use createEffect for state sync instead of derivation

#### Anti-Patterns Found

**RobinsIReconciliation.jsx** (Lines 89-98):
```js
// ANTI-PATTERN: Using effect to set derived state
createEffect(() => {
  const items = navItems();
  const page = currentPage();
  if (items.length > 0 && expandedDomain() === null) {
    const sectionKey = getSectionKeyForPage(items, page);
    if (sectionKey) {
      setExpandedDomain(sectionKey);
    }
  }
});

// SHOULD BE: Derived with createMemo
const expandedDomain = createMemo(() => {
  const items = navItems();
  const page = currentPage();
  if (items.length > 0) {
    return getSectionKeyForPage(items, page);
  }
  return null;
});
```

**ChecklistReconciliation.jsx** has similar patterns (Lines 154-170).

### 6. Signal Passing in JSX - MINOR ISSUES

**Status:** 2 instances found

| File | Line | Issue | Fix |
|------|------|-------|-----|
| `MagicLinkForm.jsx` | 103 | Passes `error` instead of `displayError` accessor | Change to `displayError={displayError}` |
| `SignUp.jsx` | 138 | Passes raw `error` signal, inconsistent with other auth components | Create `displayError` accessor with authError fallback |

---

## Documentation Findings

### Well Documented

1. **Prop destructuring** - Explicitly called out in CLAUDE.md, solidjs.mdc, and guides
2. **Control-flow components** - Good examples in components.md
3. **createEffect sparingly** - Mentioned in multiple guides
4. **Stores for complex objects** - Comprehensive coverage in state-management.md

### Documentation Gaps

| Topic | Current State | Recommendation |
|-------|---------------|----------------|
| Derive vs Sync | Implicit in examples | Add dedicated section with anti-pattern comparison |
| Function wrappers vs createMemo | Both shown, no guidance on when | Explain performance tradeoffs |
| Effects anti-patterns | Says "use sparingly" | Add common mistakes section |
| Signal props pattern | Minimal coverage | Add examples of receiving signals as props |

### Recommended Documentation Additions

#### 1. Add to state-management.md: "Derive Instead of Sync"

```md
## Derive Instead of Sync

Prefer deriving values over synchronizing signals with effects.

### Anti-Pattern (DON'T DO THIS)
```js
const [items, setItems] = createSignal([]);
const [filtered, setFiltered] = createSignal([]);

// BAD: Syncing with effect
createEffect(() => {
  setFiltered(items().filter(i => i.active));
});
```

### Correct Pattern
```js
const [items, setItems] = createSignal([]);

// GOOD: Derive with createMemo
const filtered = createMemo(() => items().filter(i => i.active));
```

**Why:** Derivation is declarative, has no race conditions, and automatically re-computes when dependencies change.
```

#### 2. Add to components.md: "Function Wrappers vs createMemo"

```md
## When to Use Function Wrappers vs createMemo

- **Function wrapper** `() => value`: Lightweight, re-evaluates on every access
- **createMemo**: Tracks dependencies, caches result, re-evaluates only when deps change

Use createMemo when:
- The computation is expensive
- The value is accessed multiple times per render
- You need memoization for referential stability
```

---

## Architecture Note: SolidStart Patterns

The project uses **SolidJS Router** (SPA architecture), not TanStack Start. Therefore:

- `createAsync`, `action()`, `query()`, `preload` patterns do not apply
- Data fetching via TanStack Query (useQuery) is appropriate
- Mutations via `apiFetch` are functional but could benefit from `useMutation` wrapper for consistent loading/error state

---

## Priority Action Items

### High Priority (Fix These)

1. **MultiPartQuestionPage.jsx:38-64** - Replace createEffect with createMemo for localFinal
2. **MagicLinkForm.jsx:103** - Change `displayError={error}` to `displayError={displayError}`

### Medium Priority (Should Fix)

3. **SignallingQuestion.jsx:21-29** - Move NA-to-NI coercion to event handler
4. **Sidebar.jsx:37-38** - Convert expandedProjects/Studies to createStore
5. **DevPanel.jsx:46-50** - Consolidate position/size/dragOffset into single store

### Low Priority (Nice to Have)

6. **form-errors.js** - Convert fieldErrors to createStore
7. **SignUp.jsx:138** - Add displayError accessor for consistency
8. Update documentation with "Derive vs Sync" section

---

## Files Referenced

- `/packages/web/src/components/project/reconcile-tab/amstar2-reconcile/MultiPartQuestionPage.jsx`
- `/packages/web/src/components/checklist/ROBINSIChecklist/SignallingQuestion.jsx`
- `/packages/web/src/components/auth/MagicLinkForm.jsx`
- `/packages/web/src/components/auth/SignUp.jsx`
- `/packages/web/src/components/sidebar/Sidebar.jsx`
- `/packages/web/src/components/dev/DevPanel.jsx`
- `/packages/web/src/lib/form-errors.js`
- `/packages/web/src/components/project/reconcile-tab/robins-i-reconcile/RobinsIReconciliation.jsx`
- `/packages/web/src/components/project/reconcile-tab/amstar2-reconcile/ChecklistReconciliation.jsx`
