# ROB2 Visualization Charts

## Context

The project has AMSTAR2 visualizations (traffic light heatmap + distribution stacked bar chart) but no ROB2 equivalents. ROB2 assessments are fully functional (checklist, scoring, reconciliation) but there's no way to visualize finalized ROB2 results at the project overview level.

Standard robvis-style ROB2 visualizations show:

- **Traffic light plot**: rows = studies, columns = 5 bias domains + Overall
- **Summary plot**: horizontal stacked bars showing % Low / Some concerns / High per domain

## Data Differences: ROB2 vs AMSTAR2

| Aspect              | AMSTAR2                                  | ROB2                            |
| ------------------- | ---------------------------------------- | ------------------------------- |
| Columns             | 16 flat questions (Q1-Q16)               | 5 domains + Overall (6 columns) |
| Values              | yes, partial yes, no, no ma              | Low, Some concerns, High        |
| Legend items        | 4                                        | 3                               |
| Branching           | None                                     | Domain 2a vs 2b based on aim    |
| consolidatedAnswers | Set in sync.ts via `getAMSTAR2Answers()` | **Not currently set**           |

## Implementation Plan

### Step 1: Add `getConsolidatedAnswers` to shared ROB2 module

**File**: `packages/shared/src/checklists/rob2/answers.ts`

Add a new function that extracts domain-level judgments into a chart-friendly format. The existing `getDomainSummary` function is close but returns a keyed object -- we need an ordered array for the chart.

```typescript
export interface ROB2ConsolidatedAnswers {
  aim: 'ASSIGNMENT' | 'ADHERING' | null;
  domain2Variant: '2a' | '2b';
  judgments: (string | null)[]; // [D1, D2, D3, D4, D5, Overall] -- 6 entries
}
```

Uses existing `getActiveDomainKeys()` to determine which domain2 variant is active, reads each domain's `.judgement` field and `overall.judgement`.

### Step 2: Wire up consolidatedAnswers for ROB2 in sync.ts

**File**: `packages/web/src/primitives/useProject/sync.ts` (line ~247)

Add a parallel block after the AMSTAR2 consolidation:

```typescript
if (checklistType === 'ROB2') {
  checklistEntry.consolidatedAnswers = getConsolidatedAnswers(answers as any);
}
```

### Step 3: Extract shared `exportChart` utility

**File (new)**: `packages/web/src/components/charts/export-chart.ts`

Move the `exportChart` function from `ChartSection.tsx` into a shared utility. Update `ChartSection.tsx` to import from the new location.

### Step 4: Create `ROB2Robvis.tsx` -- Traffic light heatmap

**File (new)**: `packages/web/src/components/charts/ROB2Robvis.tsx`

D3-based SVG component mirroring `AMSTARRobvis.tsx` with these differences:

- **6 columns**: D1, D2, D3, D4, D5, Overall (instead of 16)
- **Color map**: `{ low: '#10b981', 'some concerns': '#facc15', high: '#ef4444' }`
- **Greyscale map**: `{ low: '#1b1b1b', 'some concerns': '#484848', high: '#727272' }`
- **3 legend items** instead of 4
- **Max cell size capped** (~60px) since 6 columns leaves lots of space
- **Visual separator** before Overall column (small gap)
- **Default title**: "ROB 2 Domain-Level Judgments by Study"
- Same patterns: `useImperativeHandle`, `ResizeObserver`, `useLayoutEffect` for label width, D3 imperative draw

Data interface:

```typescript
interface ROB2RobvisDataItem {
  label: string;
  judgments: (string | null)[]; // 6 entries
}
```

### Step 5: Create `ROB2Distribution.tsx` -- Stacked bar chart

**File (new)**: `packages/web/src/components/charts/ROB2Distribution.tsx`

D3-based SVG component mirroring `AMSTARDistribution.tsx` with these differences:

- **6 bars** (D1-D5 + Overall) instead of 16
- **3 stacked categories** (Low, Some concerns, High) instead of 4
- Same color/greyscale maps as ROB2Robvis
- **Y-axis label**: "Domains of ROB 2"
- **X-axis label**: "Percentage of Studies (%), N=X"
- **Default title**: "Risk of Bias Summary Across Included Studies"

### Step 6: Create `ROB2ChartSection.tsx` -- Orchestrator

**File (new)**: `packages/web/src/components/project/overview-tab/ROB2ChartSection.tsx`

Parallel to existing `ChartSection.tsx`. Responsibilities:

- Filter studies for finalized ROB2 checklists (`type === 'ROB2'`, `status === CHECKLIST_STATUS.FINALIZED`)
- Extract `consolidatedAnswers.judgments` from each
- Manage state: custom labels, greyscale, titles, transparent export, settings modal
- Render `ROB2Robvis` + `ROB2Distribution` with SVG refs
- Render `ChartSettingsModal` with ROB2-specific default titles
- Use shared `exportChart` utility
- Empty state message when no finalized ROB2 checklists exist

### Step 7: Integrate into OverviewTab

**File**: `packages/web/src/components/project/overview-tab/OverviewTab.tsx` (~line 374)

Add `ROB2ChartSection` alongside `ChartSection` in the Figures collapsible section. Each handles its own empty state. When both have data, they stack vertically with spacing.

## Files Modified (summary)

| File                                                                        | Action                              |
| --------------------------------------------------------------------------- | ----------------------------------- |
| `packages/shared/src/checklists/rob2/answers.ts`                            | Add `getConsolidatedAnswers`        |
| `packages/web/src/primitives/useProject/sync.ts`                        | Add ROB2 consolidation block        |
| `packages/web/src/components/charts/export-chart.ts`                    | **New** -- extracted utility        |
| `packages/web/src/components/charts/ROB2Robvis.tsx`                     | **New** -- traffic light chart      |
| `packages/web/src/components/charts/ROB2Distribution.tsx`               | **New** -- distribution chart       |
| `packages/web/src/components/project/overview-tab/ROB2ChartSection.tsx` | **New** -- orchestrator             |
| `packages/web/src/components/project/overview-tab/OverviewTab.tsx`      | Add ROB2ChartSection                |
| `packages/web/src/components/project/overview-tab/ChartSection.tsx`     | Import exportChart from shared util |

## Verification

1. `pnpm --filter web build` -- confirm no type/build errors
2. `pnpm typecheck` -- verify types across packages
3. `pnpm lint` -- pass linting
4. Manual test: open a project with finalized ROB2 checklists, expand Figures section, verify both charts render with correct domain judgments and colors
5. Test settings modal: greyscale toggle, label editing, title editing, SVG/PNG export
6. Test empty state: project with no ROB2 checklists shows placeholder message
