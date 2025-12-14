# Modular Checklist Integration Plan

This document outlines the plan to integrate ROBINS-I (and future checklist formats) with PDF viewing and Yjs synchronization, matching the existing AMSTAR2 functionality.

## Current Architecture Overview

### How AMSTAR2 Currently Works

1. **Local Checklists** (`LocalChecklistView.jsx` + `useLocalChecklists.js`)
   - Stored in IndexedDB with PDFs
   - Uses `ChecklistWithPdf.jsx` wrapper
   - Hardcoded to `AMSTAR2Checklist` component

2. **Cloud Checklists** (`ChecklistYjsWrapper.jsx` + `useProject`)
   - Synced via Yjs Durable Objects
   - PDFs stored in R2 with local caching
   - Hardcoded to `AMSTAR2Checklist` component

3. **PDF Integration** (`ChecklistWithPdf.jsx`)
   - Wraps checklist component with split-screen PDF viewer
   - Currently hardcoded: `import AMSTAR2Checklist from '...'`

4. **Scoring** (`checklist.js`)
   - `scoreChecklist()` used in multiple places
   - Hardcoded to AMSTAR2 scoring logic

---

## Goals

1. **Multi-format support**: AMSTAR2, ROBINS-I, and future formats (ROBINS-E, RoB2, GRADE, etc.)
2. **Modular architecture**: Easy to add new checklist types
3. **Shared infrastructure**: Reuse PDF viewer, Yjs sync, scoring displays
4. **Type-aware storage**: Store checklist type, use correct component/scoring

---

## Implementation Plan

### Phase 1: Checklist Type Registry

Create a central registry that maps checklist types to their components and utilities.

#### Files to Create

| File | Purpose |
|------|---------|
| `src/checklist-registry/index.js` | Central registry with type → component/scoring mappings |
| `src/checklist-registry/types.js` | Type constants and metadata |

#### Registry Structure

```js
// src/checklist-registry/index.js
export const CHECKLIST_REGISTRY = {
  AMSTAR2: {
    name: 'AMSTAR 2',
    description: 'Systematic review quality assessment',
    component: lazy(() => import('@checklist-ui/AMSTAR2Checklist.jsx')),
    createChecklist: (opts) => import('@/AMSTAR2/checklist.js').then(m => m.createChecklist(opts)),
    scoreChecklist: (state) => import('@/AMSTAR2/checklist.js').then(m => m.scoreChecklist(state)),
    getAnswers: (state) => import('@/AMSTAR2/checklist.js').then(m => m.getAnswers(state)),
  },
  ROBINS_I: {
    name: 'ROBINS-I V2',
    description: 'Non-randomized studies of interventions',
    component: lazy(() => import('@checklist-ui/ROBINSIChecklist/ROBINSIChecklist.jsx')),
    createChecklist: (opts) => import('@/ROBINS-I/checklist.js').then(m => m.createChecklist(opts)),
    scoreChecklist: (state) => import('@/ROBINS-I/checklist.js').then(m => m.scoreChecklist(state)),
    getAnswers: (state) => import('@/ROBINS-I/checklist.js').then(m => m.getAnswers(state)),
  },
  // Future: ROBINS_E, ROB2, GRADE, etc.
};

export function getChecklistConfig(type) {
  return CHECKLIST_REGISTRY[type] || CHECKLIST_REGISTRY.AMSTAR2;
}
```

---

### Phase 2: Generic Checklist Wrapper

Create a type-aware wrapper that dynamically loads the correct checklist component.

#### Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/components/checklist-ui/GenericChecklist.jsx` | Create | Dynamic checklist component loader |
| `src/components/checklist-ui/ChecklistWithPdf.jsx` | Modify | Accept `checklistType` prop, use GenericChecklist |

#### GenericChecklist Component

```jsx
// src/components/checklist-ui/GenericChecklist.jsx
import { Suspense, createMemo } from 'solid-js';
import { getChecklistConfig } from '@/checklist-registry';

export default function GenericChecklist(props) {
  // props.checklistType - 'AMSTAR2' | 'ROBINS_I' | etc.
  // props.checklist - the checklist state
  // props.onUpdate - update callback
  // props.readOnly - read-only mode
  
  const config = createMemo(() => getChecklistConfig(props.checklistType));
  const ChecklistComponent = createMemo(() => config().component);
  
  return (
    <Suspense fallback={<div>Loading checklist...</div>}>
      <ChecklistComponent
        checklistState={props.checklist}
        externalChecklist={props.checklist}  // AMSTAR2 uses this
        onUpdate={props.onUpdate}
        onExternalUpdate={props.onUpdate}    // AMSTAR2 uses this
        readOnly={props.readOnly}
      />
    </Suspense>
  );
}
```

#### Updated ChecklistWithPdf

```jsx
// ChecklistWithPdf.jsx (modified)
import GenericChecklist from '@checklist-ui/GenericChecklist.jsx';
import PdfViewer from '@/components/checklist-ui/pdf/PdfViewer.jsx';
import SplitScreenLayout from '@checklist-ui/SplitScreenLayout.jsx';

export default function ChecklistWithPdf(props) {
  // NEW: props.checklistType - the type of checklist to render
  
  return (
    <div class='h-full flex flex-col bg-blue-50'>
      <SplitScreenLayout ...>
        <GenericChecklist
          checklistType={props.checklistType || props.checklist?.checklistType || 'AMSTAR2'}
          checklist={props.checklist}
          onUpdate={props.onUpdate}
          readOnly={props.readOnly}
        />
        <PdfViewer ... />
      </SplitScreenLayout>
    </div>
  );
}
```

---

### Phase 3: Update Wrappers to Pass Checklist Type

#### Files to Modify

| File | Changes |
|------|---------|
| `LocalChecklistView.jsx` | Pass `checklistType` to `ChecklistWithPdf` |
| `ChecklistYjsWrapper.jsx` | Pass `checklistType` to `ChecklistWithPdf` |
| `useLocalChecklists.js` | Support creating different checklist types |
| `ScoreTag.jsx` | Make scoring type-aware |

#### LocalChecklistView Changes

```jsx
// Pass type from loaded checklist
<ChecklistWithPdf
  checklistType={checklist()?.checklistType || checklist()?.type || 'AMSTAR2'}
  checklist={checklist()}
  onUpdate={handleUpdate}
  ...
/>
```

#### ChecklistYjsWrapper Changes

```jsx
// Pass type from checklist metadata
<ChecklistWithPdf
  checklistType={currentChecklist()?.type || 'AMSTAR2'}
  checklist={checklistForUI()}
  onUpdate={handlePartialUpdate}
  ...
/>
```

---

### Phase 4: Update useLocalChecklists for Multi-Type Support

#### Changes to `useLocalChecklists.js`

```js
import { getChecklistConfig } from '@/checklist-registry';

async function createChecklist(name, type = 'AMSTAR2') {
  const config = getChecklistConfig(type);
  const id = `local-${crypto.randomUUID()}`;
  const now = Date.now();
  
  // Use the type-specific template creator
  const template = await config.createChecklist({
    id,
    name,
    createdAt: now,
    reviewerName: '',
  });
  
  const checklist = {
    ...template,
    id,
    name,
    checklistType: type,  // Store the type!
    createdAt: now,
    updatedAt: now,
    isLocal: true,
  };
  
  // ... save to IndexedDB
}
```

---

### Phase 5: Type-Aware Scoring

#### Files to Modify

| File | Changes |
|------|---------|
| `ScoreTag.jsx` | Accept `checklistType`, use registry for scoring |
| `LocalChecklistView.jsx` | Compute score using registry |
| `ChecklistYjsWrapper.jsx` | Compute score using registry |

#### ScoreTag Enhancement

```jsx
// ScoreTag.jsx (or create new ScoringUtils)
import { getChecklistConfig } from '@/checklist-registry';

export async function computeScore(checklistType, checklistState) {
  const config = getChecklistConfig(checklistType);
  return config.scoreChecklist(checklistState);
}
```

---

### Phase 6: Normalize Component Props

Both AMSTAR2 and ROBINS-I need consistent prop interfaces. Currently:

| Component | Props Used |
|-----------|------------|
| AMSTAR2Checklist | `externalChecklist`, `onExternalUpdate`, `readOnly` |
| ROBINSIChecklist | `checklistState`, `onUpdate`, `showComments`, `showLegend` |

#### Option A: Adapter in GenericChecklist

Map props to each component's expected interface:

```jsx
// GenericChecklist.jsx
const componentProps = createMemo(() => {
  if (props.checklistType === 'AMSTAR2') {
    return {
      externalChecklist: props.checklist,
      onExternalUpdate: props.onUpdate,
      readOnly: props.readOnly,
    };
  }
  if (props.checklistType === 'ROBINS_I') {
    return {
      checklistState: props.checklist,
      onUpdate: props.onUpdate,
      showComments: true,
    };
  }
  return {};
});
```

#### Option B: Standardize All Components (Recommended Long-term)

Update all checklist components to use the same prop names:
- `checklistState` - the checklist data
- `onUpdate(key, value)` - update callback
- `readOnly` - disable edits

---

### Phase 7: Update CreateLocalChecklist Form

Allow users to select checklist type when creating.

#### Files to Modify

| File | Changes |
|------|---------|
| `CreateLocalChecklist.jsx` | Add checklist type selector dropdown |

```jsx
// Add type selection
<select value={checklistType()} onChange={e => setChecklistType(e.target.value)}>
  <option value="AMSTAR2">AMSTAR 2 (Systematic Reviews)</option>
  <option value="ROBINS_I">ROBINS-I V2 (Non-randomized Studies)</option>
</select>
```

---

### Phase 8: Update Yjs/Project Integration

Ensure cloud projects store and respect checklist type.

#### Files to Modify

| File | Changes |
|------|---------|
| `useProject/index.js` | Store `type` when creating checklists |
| `projectStore.js` | Ensure type is preserved in state |
| Project creation UI | Allow selecting checklist type |

---

## File Summary

### New Files to Create

| Path | Purpose |
|------|---------|
| `src/checklist-registry/index.js` | Central type registry |
| `src/checklist-registry/types.js` | Type constants |
| `src/components/checklist-ui/GenericChecklist.jsx` | Dynamic checklist loader |

### Files to Modify

| Path | Changes |
|------|---------|
| `ChecklistWithPdf.jsx` | Use GenericChecklist, accept type prop |
| `LocalChecklistView.jsx` | Pass type, type-aware scoring |
| `ChecklistYjsWrapper.jsx` | Pass type, type-aware scoring |
| `useLocalChecklists.js` | Multi-type checklist creation |
| `CreateLocalChecklist.jsx` | Type selector UI |
| `ScoreTag.jsx` | Type-aware scoring display |

---

## Implementation Order

### Milestone 1: Registry Foundation
- [ ] Create `checklist-registry/index.js`
- [ ] Create `checklist-registry/types.js`
- [ ] Create `GenericChecklist.jsx`

### Milestone 2: Local Checklists
- [ ] Update `ChecklistWithPdf.jsx` to use GenericChecklist
- [ ] Update `LocalChecklistView.jsx` to pass type
- [ ] Update `useLocalChecklists.js` for multi-type creation
- [ ] Update `CreateLocalChecklist.jsx` with type selector
- [ ] Update `ScoreTag.jsx` for type-aware scoring

### Milestone 3: Cloud/Yjs Checklists
- [ ] Update `ChecklistYjsWrapper.jsx` to pass type
- [ ] Update project creation to select checklist type
- [ ] Update `useProject` to store type

### Milestone 4: Polish
- [ ] Normalize component prop interfaces
- [ ] Add unit tests for registry
- [ ] Update demo page to test both types

---

## Adding Future Checklist Types

To add a new checklist type (e.g., ROBINS-E):

1. Create folder: `src/ROBINS-E/`
2. Create files:
   - `checklist-map.js` - Question definitions
   - `checklist.js` - Create/score/export functions
3. Create component: `src/components/checklist-ui/ROBINSEChecklist/`
4. Register in `checklist-registry/index.js`:
   ```js
   ROBINS_E: {
     name: 'ROBINS-E',
     description: 'Environmental exposures',
     component: lazy(() => import('@checklist-ui/ROBINSEChecklist/ROBINSEChecklist.jsx')),
     // ...
   }
   ```
5. Done - the type will automatically work everywhere.

---

## Notes & Decisions

### Comparison/Reconciliation Scope
- Comparisons are always between checklists of the **same type**
- No cross-type comparison needed (e.g., never compare AMSTAR2 to ROBINS-I)
- Reconciliation can be addressed later as a separate initiative
- Each checklist type has its own `checklist-compare.js` for same-type comparisons

### Prop Interface Decision
- **Recommendation**: Start with adapter approach (Option A), refactor to standardized props later
- Allows incremental migration without breaking AMSTAR2

### Scoring Complexity
- AMSTAR2: Single overall score (Critically Low → High)
- ROBINS-I: Domain-level + overall (Low → Critical)
- `ScoreTag` may need type-specific rendering

### Storage Schema
- Local (IndexedDB): Add `checklistType` field to checklist objects
- Cloud (Yjs): Add `type` field to checklist metadata in Durable Object

### Backwards Compatibility
- Checklists without `checklistType` default to `'AMSTAR2'`
- Existing local/cloud checklists continue working
