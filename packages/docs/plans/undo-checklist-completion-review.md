# Undo checklist completion plan - feasibility review

## Overall assessment

Status: feasible with updates

The plan is generally well-structured and feasible, but requires several updates to align with the current codebase. The core concept is sound and the implementation approach is appropriate.

## Key findings

### What is still accurate

1. File structure: All referenced files exist and match the plan:
   - `ChecklistYjsWrapper.jsx` exists and has `handleToggleComplete()` function
   - `CompletedChecklistRow.jsx` exists and is simple enough to extend
   - `ReconcileStudyCard.jsx` exists (though usage differs from plan)
   - `CompletedStudyCard.jsx` exists and wires up rows correctly
   - `checklists.js` in `primitives/useProject/` is the correct location for helper function

2. Status flow: The status flow `pending` -> `in-progress` -> `completed` is correct
3. Reconciliation logic: The `isReconciled` flag and reconciliation constraints are correctly understood
4. Update mechanism: `updateChecklist()` function exists in `projectActionsStore.checklist.update()`

### Issues and required updates

#### 1. Status value inconsistency (critical)

Issue: The codebase has an inconsistency between `'in-progress'` (hyphen) and `'in_progress'` (underscore).

Current state:

- `checklists.js` line 485 sets status to `'in-progress'` (hyphen)
- `ReconciliationWrapper.jsx` line 270 sets status to `'in_progress'` (underscore)
- Most UI checks use `'in-progress'` (hyphen)

Fix needed: Standardize on `'in-progress'` (hyphen) throughout. The plan correctly uses `'in-progress'`, but this inconsistency should be fixed first.

Recommendation: Fix the inconsistency in `ReconciliationWrapper.jsx` before implementing undo.

#### 2. Non-existent function reference

Issue: Phase 1 references `studyHasReconciledChecklist(currentStudy())` which doesn't exist.

Current code pattern (from `utils/reconciliation.js`):

```js
const hasReconciled = (study?.checklists || []).some(c => c.isReconciled);
```

Fix: Replace the function call with inline check:

```js
// Check if study has a reconciled checklist
const hasReconciled = (currentStudy()?.checklists || []).some(c => c.isReconciled);
if (hasReconciled) {
  showToast.error('Cannot Undo', 'A reconciled checklist already exists for this study.');
  return;
}
```

#### 3. ProjectContext misunderstanding

Issue: Phase 1 mentions adding handler to `ProjectContext.jsx`, but ProjectContext only provides read-only context (projectId, userRole, getAssigneeName). It doesn't provide mutation handlers.

Current architecture:

- Read operations: `projectStore` (reactive)
- Write operations: `projectActionsStore` (actions)

Fix: Remove ProjectContext reference. `updateChecklist` is already available via `useProject()` hook in `ChecklistYjsWrapper.jsx`, and can be accessed via `projectActionsStore.checklist.update()` in other components.

#### 4. ReconcileStudyCard structure difference

Issue: Phase 5 assumes `ReconcileStudyCard` shows individual checklists, but it actually shows a study card with a "Reconcile" button. Individual checklists aren't displayed in rows.

Current structure:

- `ReconcileStudyCard` shows study info and a single "Reconcile" button
- Individual checklists are not shown as separate rows
- Reconciliation happens in a separate view (`ReconciliationWrapper`)

Fix: Phase 5 needs rethinking. Options:

- Option A: Add undo buttons to individual checklist items in the reconciliation view (if they're shown there)
- Option B: Add a dropdown/menu in `ReconcileStudyCard` to show individual checklists with undo options
- Option C: Skip per-checklist undo in reconcile tab (undo only in checklist view and completed tab)

Recommendation: Option C is simplest - undo in the checklist view and completed tab is sufficient. Phase 5 can be simplified or removed.

#### 5. Status value in update

Issue: Plan shows updating to `'in-progress'` which is correct, but should be explicit about the hyphen.

Fix: Ensure all status updates use `'in-progress'` (with hyphen), not `'in_progress'` (with underscore).

## Updated implementation plan

### Phase 1: Add undo functionality to checklist view (needs updates)

File: `ChecklistYjsWrapper.jsx`

Changes needed:

1. Fix the `studyHasReconciledChecklist` reference (use inline check)
2. Use `'in-progress'` status (with hyphen)
3. Remove ProjectContext reference (already have `updateChecklist` from `useProject()`)

### Phase 2: Add undo option in completed tab

Files:

- `CompletedChecklistRow.jsx` (add undo button)
- `CompletedStudyCard.jsx` (wire up handler)

### Phase 3: Create helper function

Location recommendation: Create `packages/web/src/utils/checklist-utils.js` for better organization (keeps primitives focused on Yjs operations).

### Phase 4: Update UI to show undo status

Use `projectActionsStore.checklist.update()` via props handler.

### Phase 5: Update `ReconcileStudyCard` (needs rethinking)

Recommended simplified approach: Skip per-checklist undo in reconcile tab. Users can:

1. Navigate to the checklist view and undo there
2. Use undo from the completed tab (if applicable)

## Additional considerations

### Permission checks

The plan mentions "Only the assigned reviewer or project admin should be able to undo" but doesn't implement this. Consider adding an explicit check before allowing undo.

### Status inconsistency fix (pre-requisite)

Before implementing undo, fix the status inconsistency:

- File: `packages/web/src/components/checklist-ui/compare/ReconciliationWrapper.jsx` (sets `status: 'in_progress'`)
- Also check for other `'in_progress'` checks and standardize to `'in-progress'`
