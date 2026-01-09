# Yjs State Inspector & Editor - Development Tool Plan

**Purpose**: Create a development tool to inspect, edit, and seed Yjs document state for faster iteration during development.

**Date**: 2026-01-09
**Updated**: 2026-01-10

---

## Executive Summary

This plan outlines a comprehensive development tool that provides visibility into Yjs document structures stored in Cloudflare Durable Objects. The tool will enable developers to:

1. **Inspect** current project state (studies, checklists, answers, PDFs, members)
2. **Edit** existing data at any level of the hierarchy
3. **Import/Export** project state as JSON for backup, sharing, and seeding
4. **Seed mock data** to quickly reach specific application states

---

## Implementation Status

| Phase   | Status      | Description                            |
| ------- | ----------- | -------------------------------------- |
| Phase 0 | COMPLETE    | Refactor checklist logic to shared pkg |
| Phase 1 | COMPLETE    | Backend API endpoints                  |
| Phase 2 | Not Started | CLI tool                               |
| Phase 3 | Not Started | Mock data templates                    |
| Phase 4 | Not Started | UI panel                               |

---

## Current Architecture Analysis

### Yjs Document Structure (ProjectDoc Durable Object)

```
Project (Y.Doc persisted in DO storage as 'yjs-state')
|
+-- meta (Y.Map)
|   +-- name: string
|   +-- description: string
|   +-- createdAt: number
|   +-- updatedAt: number
|
+-- members (Y.Map<userId, Y.Map>)
|   +-- [userId] (Y.Map)
|       +-- role: 'owner' | 'admin' | 'member'
|       +-- joinedAt: number
|       +-- name: string | null
|       +-- email: string | null
|       +-- displayName: string | null
|       +-- image: string | null
|
+-- reviews (Y.Map<studyId, Y.Map>)  // Note: key is 'reviews' for backward compat
    +-- [studyId] (Y.Map)
        +-- name: string
        +-- description: string
        +-- createdAt: number
        +-- updatedAt: number
        +-- originalTitle: string | null
        +-- firstAuthor: string | null
        +-- publicationYear: string | null
        +-- authors: string | null
        +-- journal: string | null
        +-- doi: string | null
        +-- abstract: string | null
        +-- pdfUrl: string | null
        +-- pdfSource: string | null
        +-- pdfAccessible: boolean
        +-- reviewer1: string | null
        +-- reviewer2: string | null
        |
        +-- checklists (Y.Map<checklistId, Y.Map>)
        |   +-- [checklistId] (Y.Map)
        |       +-- type: 'AMSTAR2' | 'ROBINS_I'
        |       +-- title: string | null
        |       +-- assignedTo: string | null
        |       +-- status: 'pending' | 'in_progress' | 'finalized'
        |       +-- createdAt: number
        |       +-- updatedAt: number
        |       +-- answers (Y.Map) -- varies by checklist type
        |
        +-- pdfs (Y.Map<fileName, Y.Map>)
        |   +-- [fileName] (Y.Map)
        |       +-- key: string (R2 bucket key)
        |       +-- fileName: string
        |       +-- size: number
        |       +-- uploadedBy: string
        |       +-- uploadedAt: number
        |
        +-- reconciliation (Y.Map) -- optional
            +-- checklist1Id: string
            +-- checklist2Id: string
            +-- reconciledChecklistId: string | null
            +-- currentPage: number
            +-- viewMode: string
            +-- updatedAt: number
```

### Checklist Answer Structures

**AMSTAR2**: Each question (q1-q16, q9a/b, q11a/b) contains:

- `answers`: `boolean[][]` - Multi-dimensional checkbox arrays
- `critical`: `boolean` - Critical domain flag
- `note`: `Y.Text` - Collaborative notes

**ROBINS-I**: Complex nested structure with domains:

- Domain questions (1a-6) with `judgement`, `judgementSource`, `direction`
- `answers`: Y.Map of questions with `answer` and `comment` (Y.Text)
- Section A/B/C/D with various fields
- Overall judgement

### Current APIs

| Endpoint                      | Method          | Purpose                                                |
| ----------------------------- | --------------- | ------------------------------------------------------ |
| `/api/project-doc/:projectId` | GET             | Returns project info as JSON (uses `getProjectInfo()`) |
| `/api/project-doc/:projectId` | WebSocket       | Real-time sync via y-websocket                         |
| `/sync`                       | POST (internal) | Sync meta + members from D1                            |
| `/sync-member`                | POST (internal) | Add/update/remove single member                        |
| `/sync-pdf`                   | POST (internal) | Add/remove PDF metadata                                |

### Key Utilities

- `packages/web/src/lib/yjsUtils.js`:
  - `yToPlain(value)` - Convert Y.Map/Y.Array to plain JS
  - `applyObjectToYMap(target, obj)` - Apply plain object to Y.Map

---

## Proposed Solution

### Phase 0: Refactor Checklist Logic to Shared Package [COMPLETE]

**Status**: COMPLETE (2026-01-10)

**What was done**:

1. Created `packages/shared/src/checklists/` directory structure
2. Moved AMSTAR2 logic to `amstar2/` subdirectory:
   - `schema.ts` - AMSTAR_CHECKLIST map with all 16 questions
   - `create.ts` - createAMSTAR2Checklist function
   - `score.ts` - scoreAMSTAR2Checklist, isAMSTAR2Complete
   - `answers.ts` - getSelectedAnswer, getAnswers, consolidateAnswers
   - `compare.ts` - compareChecklists, createReconciledChecklist
3. Moved ROBINS-I logic to `robins-i/` subdirectory:
   - `schema.ts` - ROBINS_I_CHECKLIST with all domains, response types
   - `create.ts` - createROBINSIChecklist function
   - `scoring.ts` - Full smart scoring engine (~800 lines)
   - `answers.ts` - shouldStopAssessment, scoreROBINSIChecklist, getDomainSummary
4. Created shared types and status helpers:
   - `types.ts` - TypeScript interfaces for all checklist structures
   - `status.ts` - CHECKLIST_STATUS constants and helpers
   - `domain.ts` - Domain logic for filtering checklists
5. Updated web package to re-export from shared:
   - All existing imports continue to work via re-export shims
   - UI components stay in web package, business logic in shared
6. Test coverage:
   - 122 tests in shared package (all passing)
   - 173 checklist tests in web package (all passing)

**Files created/modified**:

```
packages/shared/src/checklists/
  index.ts                    - Main exports
  types.ts                    - TypeScript interfaces
  status.ts                   - CHECKLIST_STATUS + helpers
  domain.ts                   - Domain logic
  amstar2/
    index.ts, schema.ts, create.ts, score.ts, answers.ts, compare.ts
  robins-i/
    index.ts, schema.ts, create.ts, scoring.ts, answers.ts
  __tests__/
    amstar2.test.ts, robins-i.test.ts, status.test.ts

packages/web/src/components/checklist/ (updated to re-export from shared)
  AMSTAR2Checklist/checklist.js, checklist-map.js, checklist-compare.js
  ROBINSIChecklist/checklist.js, checklist-map.js, scoring/robins-scoring.js
```

**Usage**:

```typescript
// New code should import directly from shared
import { amstar2, robinsI, CHECKLIST_STATUS } from '@corates/shared';

// Create checklist
const checklist = amstar2.createAMSTAR2Checklist({ name: 'Test', id: 'test-1' });

// Score checklist
const score = amstar2.scoreAMSTAR2Checklist(checklist);
```

---

### Phase 1: Backend API Endpoints (Dev-Only)

**Status**: COMPLETE (2026-01-11)

**What was implemented**:

1. Added `DEV_MODE` environment variable to `wrangler.jsonc` (true for dev, absent for production)
2. Added dev endpoint routing in `ProjectDoc.js` fetch() method
3. Implemented 5 dev handler methods in ProjectDoc Durable Object:
   - `handleDevExport()` - Export full Y.Doc state as structured JSON
   - `handleDevImport()` - Import JSON with 'replace' or 'merge' modes
   - `handleDevPatch()` - Apply surgical updates via path operations
   - `handleDevReset()` - Clear Y.Doc to empty state
   - `handleDevRaw()` - Export raw Yjs binary state as base64

**Endpoints** (require `X-Internal-Request` header + `DEV_MODE=true`):

```
POST /dev/export     - Export full Y.Doc state as JSON
POST /dev/import     - Import/replace Y.Doc state from JSON
POST /dev/patch      - Apply partial updates to Y.Doc
POST /dev/reset      - Reset Y.Doc to empty state
GET  /dev/raw        - Get raw Yjs binary state (for debugging)
```

**Export format**:

```json
{
  "version": 1,
  "exportedAt": "2026-01-11T...",
  "projectId": "...",
  "meta": { "name": "...", "description": "..." },
  "members": [{ "userId": "...", "role": "owner", ... }],
  "studies": [{
    "id": "...",
    "name": "...",
    "checklists": [{ "id": "...", "type": "AMSTAR2", "answers": {...} }],
    "pdfs": [...]
  }]
}
```

**Import body**:

```json
{
  "data": {
    /* export format */
  },
  "mode": "replace" // or "merge"
}
```

**Patch body**:

```json
{
  "operations": [
    { "path": "studies.study_id.name", "value": "New Name" },
    { "path": "meta.description", "value": "Updated" }
  ]
}
```

**Files modified**:

- `packages/workers/wrangler.jsonc` - Added `DEV_MODE: true` to vars
- `packages/workers/src/durable-objects/ProjectDoc.js` - Added dev routing and 5 handler methods

---

### Phase 2: Worker Routes for Dev Tools

Create new route file `packages/workers/src/routes/dev.js`:

```javascript
// Only enabled when DEV_MODE=true in wrangler.jsonc
export const devRoutes = new Hono();

devRoutes.use('*', async (c, next) => {
  if (!c.env.DEV_MODE) {
    return c.json({ error: 'Dev routes disabled in production' }, 403);
  }
  await next();
});

// Export project Yjs state as JSON
devRoutes.get('/projects/:projectId/export', async (c) => { ... });

// Import project Yjs state from JSON
devRoutes.post('/projects/:projectId/import', async (c) => { ... });

// Patch specific paths in Yjs state
devRoutes.patch('/projects/:projectId/patch', async (c) => { ... });

// Reset project Yjs state
devRoutes.delete('/projects/:projectId/reset', async (c) => { ... });

// List all projects with their Yjs state summaries
devRoutes.get('/projects', async (c) => { ... });

// Seed a project with mock data template
devRoutes.post('/projects/:projectId/seed', async (c) => { ... });
```

### Phase 3: Mock Data Templates

Create `packages/workers/src/lib/mock-templates.js`:

```javascript
export const MOCK_TEMPLATES = {
  // Empty project with just meta
  'empty': { meta: {...}, members: [], reviews: [] },

  // Project with studies but no checklists
  'studies-only': { ... },

  // Project with completed AMSTAR2 checklists
  'amstar2-complete': { ... },

  // Project with in-progress ROBINS-I
  'robins-i-progress': { ... },

  // Project ready for reconciliation (2 completed checklists per study)
  'reconciliation-ready': { ... },

  // Complex project with mixed states
  'full-workflow': { ... },
};

// Helper to generate valid checklist answers
export function generateAMSTAR2Answers(options = {}) { ... }
export function generateROBINSIAnswers(options = {}) { ... }
```

### Phase 4: Frontend Dev Panel Component

Create `packages/web/src/components/dev/DevPanel.jsx`:

```jsx
// Floating dev panel (only rendered in dev mode)
// Features:
// 1. Tree view of current Y.Doc state
// 2. Inline editing of values
// 3. Export/Import buttons
// 4. Template seeding dropdown
// 5. Quick actions (clear checklists, reset answers, etc.)
```

**Component structure**:

```
DevPanel/
  DevPanel.jsx           - Main floating panel component
  DevStateTree.jsx       - Recursive tree view of Y.Doc
  DevJsonEditor.jsx      - JSON editor for import/export
  DevTemplateSelector.jsx - Dropdown for mock templates
  DevQuickActions.jsx    - Buttons for common operations
```

### Phase 5: CLI Tool for Terminal-Based Workflow

Create `packages/workers/scripts/dev-tools.js`:

```bash
# Export project state to file
pnpm dev:export --project=<id> --output=project-state.json

# Import project state from file
pnpm dev:import --project=<id> --input=project-state.json

# Seed project with template
pnpm dev:seed --project=<id> --template=reconciliation-ready

# List projects with state summary
pnpm dev:list

# Reset project state
pnpm dev:reset --project=<id>
```

---

## Implementation Details

### 1. Export Format (JSON)

```json
{
  "version": 1,
  "exportedAt": "2026-01-09T12:00:00.000Z",
  "projectId": "xxx",
  "meta": {
    "name": "...",
    "description": "...",
    "createdAt": 1704844800000,
    "updatedAt": 1704844800000
  },
  "members": [
    {
      "userId": "user_xxx",
      "role": "owner",
      "joinedAt": 1704844800000,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "studies": [
    {
      "id": "study_xxx",
      "name": "Study Name",
      "originalTitle": "...",
      "firstAuthor": "...",
      "journal": "...",
      "checklists": [
        {
          "id": "checklist_xxx",
          "type": "AMSTAR2",
          "status": "in_progress",
          "assignedTo": "user_xxx",
          "answers": {
            "q1": { "answers": [[true, false, false, false], [false], [false, false]], "critical": false },
            "q2": {
              "answers": [
                [false, true, false, false],
                [false, false, false],
                [false, false, false]
              ],
              "critical": true
            }
          }
        }
      ],
      "pdfs": []
    }
  ]
}
```

### 2. Import Logic

```javascript
async handleDevImport(request) {
  const { data, mode = 'replace' } = await request.json();
  // mode: 'replace' (clear & replace) or 'merge' (deep merge)

  await this.initializeDoc();

  this.doc.transact(() => {
    if (mode === 'replace') {
      // Clear existing data
      this.doc.getMap('meta').clear();
      this.doc.getMap('members').clear();
      this.doc.getMap('reviews').clear();
    }

    // Apply new data using applyObjectToYMap-style logic
    this.applyImportData(data);
  });

  return Response.json({ success: true });
}
```

### 3. Patch Logic (For Surgical Updates)

```javascript
// PATCH body format
{
  "operations": [
    {
      "path": "studies.study_xxx.checklists.checklist_xxx.status",
      "value": "finalized"
    },
    {
      "path": "studies.study_xxx.checklists.checklist_xxx.answers.q1.critical",
      "value": true
    }
  ]
}
```

### 4. DevPanel UI Wireframe

```
+------------------------------------------+
|  Dev Tools                          [x]  |
+------------------------------------------+
| [Export JSON] [Import JSON] [Reset]      |
| [Template: ▼ reconciliation-ready ]      |
+------------------------------------------+
| Project State:                           |
|                                          |
| v meta                                   |
|   name: "My Project"                [edit]|
|   description: "..."                [edit]|
|                                          |
| v members (2)                            |
|   > user_abc123 (owner)                  |
|   > user_def456 (member)                 |
|                                          |
| v studies (3)                            |
|   v study_001                            |
|     name: "Study 1"                 [edit]|
|     v checklists (2)                     |
|       v checklist_a (AMSTAR2)            |
|         status: in_progress         [edit]|
|         v answers                        |
|           > q1: [partial]                |
|           > q2: [complete]               |
+------------------------------------------+
```

---

## File Changes Summary

### New Files

| File                                                      | Purpose                     |
| --------------------------------------------------------- | --------------------------- |
| **Shared Package (Phase 0)**                              |                             |
| `packages/shared/src/checklists/index.ts`                 | Main checklist exports      |
| `packages/shared/src/checklists/types.ts`                 | TypeScript types/interfaces |
| `packages/shared/src/checklists/status.ts`                | CHECKLIST_STATUS + helpers  |
| `packages/shared/src/checklists/domain.ts`                | Domain logic (filtering)    |
| `packages/shared/src/checklists/amstar2/index.ts`         | AMSTAR2 exports             |
| `packages/shared/src/checklists/amstar2/schema.ts`        | AMSTAR2 checklist map       |
| `packages/shared/src/checklists/amstar2/create.ts`        | createChecklist function    |
| `packages/shared/src/checklists/amstar2/score.ts`         | Scoring functions           |
| `packages/shared/src/checklists/amstar2/answers.ts`       | Answer manipulation         |
| `packages/shared/src/checklists/robins-i/index.ts`        | ROBINS-I exports            |
| `packages/shared/src/checklists/robins-i/schema.ts`       | ROBINS-I checklist map      |
| `packages/shared/src/checklists/robins-i/create.ts`       | createChecklist function    |
| `packages/shared/src/checklists/robins-i/score.ts`        | Scoring functions           |
| `packages/shared/src/checklists/robins-i/answers.ts`      | Answer manipulation         |
| `packages/shared/src/checklists/generators/index.ts`      | Mock data generator exports |
| `packages/shared/src/checklists/generators/amstar2.ts`    | AMSTAR2 state generator     |
| `packages/shared/src/checklists/generators/robins-i.ts`   | ROBINS-I state generator    |
| **Workers Package (Phase 1-3)**                           |                             |
| `packages/workers/src/routes/dev.js`                      | Dev-only API routes         |
| `packages/workers/scripts/dev-tools.js`                   | CLI tool                    |
| **Web Package (Phase 4)**                                 |                             |
| `packages/web/src/components/dev/DevPanel.jsx`            | Main dev panel              |
| `packages/web/src/components/dev/DevStateTree.jsx`        | Tree view component         |
| `packages/web/src/components/dev/DevJsonEditor.jsx`       | JSON editor                 |
| `packages/web/src/components/dev/DevTemplateSelector.jsx` | Template selector           |
| `packages/web/src/components/dev/DevQuickActions.jsx`     | Quick action buttons        |
| `packages/web/src/stores/devStore.js`                     | Dev panel state             |

### Modified Files

| File                                                       | Changes                                            |
| ---------------------------------------------------------- | -------------------------------------------------- |
| **Phase 0 (Refactor)**                                     |                                                    |
| `packages/shared/src/index.ts`                             | Export checklists module                           |
| `packages/shared/package.json`                             | Add any needed dependencies                        |
| `packages/web/src/components/checklist/AMSTAR2Checklist/*` | Import from `@corates/shared` instead of local     |
| `packages/web/src/components/checklist/ROBINSIChecklist/*` | Import from `@corates/shared` instead of local     |
| `packages/web/src/constants/checklist-status.js`           | Re-export from `@corates/shared` (backward compat) |
| `packages/web/src/lib/checklist-domain.js`                 | Re-export from `@corates/shared` (backward compat) |
| **Phase 1-5**                                              |                                                    |
| `packages/workers/src/durable-objects/ProjectDoc.js`       | Add dev endpoints                                  |
| `packages/workers/src/index.js`                            | Mount dev routes                                   |
| `packages/workers/wrangler.jsonc`                          | Add DEV_MODE var                                   |
| `packages/web/src/App.jsx`                                 | Conditionally render DevPanel                      |
| `packages/workers/package.json`                            | Add CLI scripts                                    |

---

## Security Considerations

1. **Dev-only access**: All dev endpoints check `env.DEV_MODE` which should only be `true` in local/dev environments
2. **No production exposure**: Routes return 403 if DEV_MODE is not set
3. **Internal request header**: Routes require `X-Internal-Request: true`
4. **No auth bypass**: Regular endpoints still require authentication

---

## Implementation Order

### Milestone 0: Refactor Checklist Logic to Shared (Est: 6-8 hours)

**This milestone is foundational - enables all mock data generation to use real logic.**

1. Create `packages/shared/src/checklists/` directory structure
2. Move `CHECKLIST_STATUS` and helpers to `status.ts`
3. Move AMSTAR2 schema and logic:
   - `checklist-map.js` -> `amstar2/schema.ts`
   - `createChecklist` -> `amstar2/create.ts`
   - `scoreChecklist`, `isAMSTAR2Complete` -> `amstar2/score.ts`
   - `getAnswers`, answer helpers -> `amstar2/answers.ts`
4. Move ROBINS-I schema and logic:
   - `checklist-map.js` -> `robins-i/schema.ts`
   - `createChecklist` -> `robins-i/create.ts`
   - `scoreChecklist`, scoring logic -> `robins-i/score.ts`
   - `getAnswers`, domain helpers -> `robins-i/answers.ts`
5. Move `checklist-domain.js` -> `domain.ts`
6. Create `generators/` with mock data helpers
7. Update web package imports to use `@corates/shared`
8. Run tests, fix any breaks
9. Remove duplicate code from web package (keep re-exports for gradual migration)

### Milestone 1: Backend Foundation (Est: 4-6 hours)

1. Add DEV_MODE to wrangler.jsonc
2. Implement `/dev/export` endpoint in ProjectDoc.js
3. Implement `/dev/import` endpoint
4. Create dev.js route file and mount it
5. Test with curl/httpie

### Milestone 2: Mock Templates (Est: 2-3 hours)

1. Use `@corates/shared` generators to create templates
2. Implement `/dev/seed` endpoint
3. Create 4-5 useful templates (empty, studies-only, amstar2-complete, reconciliation-ready, full-workflow)
4. Test seeding workflow

### Milestone 3: CLI Tool (Est: 2-3 hours)

1. Create dev-tools.js script
2. Add npm scripts to package.json
3. Document usage

### Milestone 4: Frontend DevPanel (Est: 6-8 hours)

1. Create devStore.js
2. Implement DevPanel skeleton with toggle
3. Build DevStateTree with recursive rendering
4. Add inline editing capability
5. Implement export/import UI
6. Add template selector dropdown
7. Style with existing UI patterns

### Milestone 5: Polish & Documentation (Est: 2 hours)

1. Add keyboard shortcuts (Cmd+Shift+D to toggle)
2. Document in packages/docs
3. Add quick actions for common workflows

**Total Estimated: 22-30 hours** (increased from 18-22 due to shared package refactor)

---

## Alternative Approaches Considered

### 1. Direct IndexedDB Manipulation (Client-side only)

- **Pros**: No backend changes needed
- **Cons**: Only affects local state, doesn't sync, can cause conflicts

### 2. Wrangler D1/KV CLI

- **Pros**: No code changes
- **Cons**: Yjs state is binary, not directly readable/editable

### 3. Separate Admin App

- **Pros**: Clean separation
- **Cons**: More infrastructure, harder to use in context

### 4. Browser DevTools Extension

- **Pros**: Professional tooling
- **Cons**: High development cost, browser-specific

**Chosen Approach**: In-app dev panel + API routes provides the best balance of:

- Direct access to Yjs state
- Works in development context
- Easy to iterate on
- Can evolve into user-facing import/export feature

---

## Future Enhancements

1. **Project cloning**: Clone a project's Yjs state to a new project
2. **Diff viewer**: Compare two project states side-by-side
3. **History/undo**: Track state changes with ability to rollback
4. **Shared templates**: Team-shared mock data templates
5. **State validation**: Validate Yjs state against expected schema
6. **Performance metrics**: Show Yjs doc size, update count, etc.

---

## Questions/Decisions Needed

1. Should the DevPanel be lazy-loaded to avoid bundle size impact in production?
2. Should we support partial imports (merge mode) or always require full replacement?
3. Do we want the CLI tool to work with remote dev environments or just local?
4. Should mock templates include realistic citation metadata or placeholder text?
5. **Shared package**: Should we keep JS or convert to TypeScript during migration?
6. **Shared package**: Keep backward-compatible re-exports in web package or update all imports at once?

---

## Appendix: Checklist Logic to Move

### From `packages/web/src/components/checklist/AMSTAR2Checklist/checklist.js`

```javascript
// Pure functions - safe to move
export function createChecklist({ name, id, createdAt, reviewerName }) { ... }
export function scoreChecklist(state) { ... }
export function isAMSTAR2Complete(checklist) { ... }
export function getAnswers(checklist) { ... }
export function exportChecklistsToCSV(checklists) { ... }  // May need adjustment for Node.js
```

### From `packages/web/src/components/checklist/ROBINSIChecklist/checklist.js`

```javascript
// Pure functions - safe to move
export function createChecklist({ name, id, createdAt, reviewerName }) { ... }
export function shouldStopAssessment(sectionB) { ... }
export function scoreChecklist(state) { ... }
export function getSmartScoring(state) { ... }
export function suggestDomainJudgement(domainKey, answers) { ... }
export function getSelectedAnswer(domainKey, questionKey, state) { ... }
export function getAnswers(checklist) { ... }
export function getDomainSummary(checklist) { ... }
export function exportChecklistsToCSV(checklists) { ... }
```

### From `packages/web/src/constants/checklist-status.js`

```javascript
export const CHECKLIST_STATUS = { ... }
export function isEditable(status) { ... }
export function getStatusLabel(status) { ... }
export function getStatusStyle(status) { ... }  // Keep in web (UI-specific)
export function canTransitionTo(currentStatus, newStatus) { ... }
```

### From `packages/web/src/lib/checklist-domain.js`

```javascript
export function isReconciledChecklist(checklist) { ... }
export function getTodoChecklists(study, userId) { ... }
export function getCompletedChecklists(study) { ... }
export function getFinalizedChecklist(study) { ... }
export function getReconciliationChecklists(study) { ... }
// ... more domain logic
```

3. Do we want the CLI tool to work with remote dev environments or just local?
4. Should mock templates include realistic citation metadata or placeholder text?
