# Yjs Browser E2E Test Plan

## Context

The web package has a comprehensive Yjs implementation for real-time collaborative research projects. Existing tests cover basic Dexie round-trips, basic sync pipeline, and basic multi-client convergence (8 tests). The domain operation layer (studies, checklists, PDFs, annotations, reconciliation, outcomes) has zero test coverage. These operations are where production bugs cause data loss.

## Approach

4 test files, ~45 tests total, all self-contained (no running backend). Tests exercise the actual domain operation modules against real Y.Docs, then verify results through the sync pipeline to the Zustand store. Runs in real Chromium via Vitest Browser Mode.

Annotations and backward compatibility (legacy reconciliation format) are out of scope.

## Test Files

### 1. `__tests__/helpers.ts` (shared test utilities)

Extract common helpers from the existing test file:

- `populateDoc()` - seed a Y.Doc with studies/meta/members
- `setupProject()` - create Y.Doc + all operation modules + sync manager
- `syncAndRead()` - call syncFromYDoc, return store state for projectId
- `createDualClients()` - two Y.Docs with bidirectional update wiring

### 2. `__tests__/domain-operations.browser.test.ts` (~17 tests)

Study, PDF, and outcome CRUD through the actual operation modules, verified via sync pipeline.

```
describe('Study operations')
  - createStudy with all metadata fields syncs to store
  - updateStudy modifies fields and syncs
  - deleteStudy removes from store
  - studies sorted by createdAt in store
  - rapid creation of multiple studies all appear

describe('PDF operations')
  - addPdfToStudy syncs with correct tag
  - only one primary: setting new primary demotes old one
  - only one protocol: setting new protocol demotes old one
  - removePdfFromStudy deletes from store
  - removePdfByFileName finds and removes
  - updatePdfMetadata sets/clears citation fields

describe('Outcome operations')
  - createOutcome adds to meta.outcomes and syncs
  - deleteOutcome succeeds when not in use
  - deleteOutcome fails when checklist references it
  - isOutcomeInUse returns true with referencing checklist
  - getOutcomes returns sorted by createdAt
```

**Catches:** PDF tag constraint violations (two primaries), outcome deletion leaving orphaned checklist refs, sync pipeline missing nested Y.Map changes.

### 3. `__tests__/checklist-handlers.browser.test.ts` (~15 tests)

Checklist creation with all 3 handler types, answer updates, serialization, Y.Text fields.

```
describe('AMSTAR2')
  - createChecklist creates correct Y.Map structure
  - updateChecklistAnswer sets answer fields
  - updateChecklistAnswer auto-transitions pending -> in_progress
  - getChecklistData serializes answers with Y.Text notes as strings
  - getQuestionNote returns Y.Text for standard and multi-part keys

describe('ROBINS-I')
  - createChecklist creates nested domain structure
  - createChecklist requires outcomeId
  - createChecklist auto-fills sectionA.outcome Y.Text from outcome name
  - duplicate detection prevents same type+outcome+assignedTo
  - Y.Text comments survive create -> serialize round-trip

describe('ROB2')
  - createChecklist creates preliminary Y.Text fields
  - createChecklist requires outcomeId
  - getRob2Text returns Y.Text for domain question comments
```

**Catches:** Y.Text degrading to plain string (breaks collab), ROBINS-I nested answer data loss, status not transitioning on first edit, duplicate checklists.

### 4. `__tests__/reconciliation.browser.test.ts` (~7 tests)

Reconciliation progress CRUD with outcome-scoped keys.

```
describe('Reconciliation progress')
  - save and retrieve by outcomeId and type
  - AMSTAR2 (no outcomeId) uses type-prefixed key
  - getAllReconciliationProgress returns all entries
  - clearReconciliationProgress removes specific outcome entry
  - multiple outcomes tracked independently in same study

describe('Reconciliation + sync pipeline')
  - reconciliation data appears in synced store
  - clearing progress removes from synced store
```

**Catches:** Wrong outcome key derivation, clearing one outcome's progress deletes another's, reconciliation data missing from store.

### 5. `__tests__/multi-client-convergence.browser.test.ts` (~8 tests)

Two Y.Docs with bidirectional sync, exercising domain operations (not raw Y.Map).

```
describe('Study convergence')
  - studies created by different clients both appear
  - one deletes while another edits -- delete wins
  - concurrent metadata edits converge

describe('Checklist convergence')
  - two clients create checklists on same study -- both appear
  - two clients update different AMSTAR2 questions -- both preserved

describe('PDF convergence')
  - two clients add different PDFs -- both appear
  - two clients set different PDFs as primary -- only one primary after sync

describe('Full sync pipeline')
  - both clients see identical store state after sync
```

**Catches:** Checklist answer overwrite when two reviewers answer different questions, primary PDF constraint violated by racing clients.

## Files to Modify/Create

| File                                                                                        | Action                       |
| ------------------------------------------------------------------------------------------- | ---------------------------- |
| `packages/web/src/primitives/useProject/__tests__/helpers.ts`                               | Create                       |
| `packages/web/src/primitives/useProject/__tests__/domain-operations.browser.test.ts`        | Create                       |
| `packages/web/src/primitives/useProject/__tests__/checklist-handlers.browser.test.ts`       | Create                       |
| `packages/web/src/primitives/useProject/__tests__/reconciliation.browser.test.ts`           | Create                       |
| `packages/web/src/primitives/useProject/__tests__/multi-client-convergence.browser.test.ts` | Create                       |
| `packages/web/src/primitives/useProject/__tests__/yjs-sync.browser.test.ts`                 | Update to use shared helpers |

## Key Source Files (read-only reference)

- `primitives/useProject/studies.js` - createStudyOperations
- `primitives/useProject/pdfs.js` - createPdfOperations
- `primitives/useProject/outcomes.js` - createOutcomeOperations
- `primitives/useProject/checklists/index.js` - createChecklistOperations
- `primitives/useProject/checklists/handlers/amstar2.js`
- `primitives/useProject/checklists/handlers/robins-i.js`
- `primitives/useProject/checklists/handlers/rob2.js`
- `primitives/useProject/reconciliation.js` - createReconciliationOperations
- `primitives/useProject/sync.js` - createSyncManager
- `stores/projectStore.ts` - useProjectStore (Zustand)
- `lib/checklist-domain.js` - getOutcomeKey helper
- `checklist-registry/index.ts` - createChecklistOfType

## Setup Pattern

```ts
// Every test creates a fresh project
const projectId = crypto.randomUUID();
const ydoc = new Y.Doc();
const getYDoc = () => ydoc;
const isSynced = () => true;

// Initialize needed operation modules
const studyOps = createStudyOperations(projectId, getYDoc, isSynced);
const syncManager = createSyncManager(projectId, getYDoc);

// After operations, sync and read
syncManager.syncFromYDoc();
const state = useProjectStore.getState();
const data = state.projects[projectId];

// Cleanup in afterEach
useProjectStore.getState().clearProject(projectId);
ydoc.destroy();
```

## Verification

```bash
# Run all browser tests
pnpm --filter web test:browser

# Run specific file
pnpm --filter web test:browser -- domain-operations

# Interactive UI
pnpm --filter web test:browser:ui
```

All 8 existing tests should continue passing. New tests should add ~45 more.
