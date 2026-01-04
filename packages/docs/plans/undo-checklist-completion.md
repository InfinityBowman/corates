# Undo checklist completion feature plan

## Overview

Currently, when a user marks a checklist as complete, it becomes locked and moves from the "To Do" tab to either the "Reconcile" tab (dual reviewer) or "Completed" tab (single reviewer). Users cannot undo this action. This plan adds the ability to revert a completed checklist back to "in-progress" status.

## Current behavior

1. Status flow: `pending` -> `in-progress` -> `completed`
2. Mark complete (in `ChecklistYjsWrapper.jsx`):
   - Shows confirmation dialog warning that the checklist will be locked
   - Sets `status: 'completed'`
   - Checklist becomes read-only
3. Tab visibility:
   - To Do tab: Shows checklists with `status !== 'completed'` assigned to user
   - Reconcile tab: Shows studies with 1-2 completed checklists (dual reviewer)
   - Completed tab: Shows reconciled checklists (dual) or completed checklists (single)

## Constraints

The undo feature should be restricted in certain cases:

1. Reconciled checklists (`isReconciled: true`): Cannot be undone, these are final consensus results
2. Checklists where reconciliation has started: If a reconciled checklist exists for the study, the source checklists should remain locked
3. Permissions: Only the assigned reviewer or project admin should be able to undo

## Implementation plan

### Phase 1: Add undo functionality to checklist view

File: `packages/web/src/components/checklist-ui/ChecklistYjsWrapper.jsx`

Modify `handleToggleComplete()` to allow undoing completion:

```jsx
// Current: blocks undo with toast message
if (checklist.status === 'completed') {
  showToast.info('Checklist Locked', 'Completed checklists cannot be edited.');
  return;
}

// New: allow undo with confirmation
if (checklist.status === 'completed') {
  // Check if undo is allowed
  if (checklist.isReconciled) {
    showToast.error('Cannot Undo', 'Reconciled checklists cannot be reverted.');
    return;
  }
  // Check if reconciliation exists for this study
  if (studyHasReconciledChecklist(currentStudy())) {
    showToast.error('Cannot Undo', 'A reconciled checklist already exists for this study.');
    return;
  }

  // Show undo confirmation
  const confirmed = await confirmDialog.open({
    title: 'Revert to In Progress?',
    description:
      'This will unlock the checklist and move it back to your To Do list. You will need to mark it complete again when finished.',
    confirmText: 'Revert',
    cancelText: 'Cancel',
    variant: 'warning',
  });

  if (!confirmed) return;

  updateChecklist(params.studyId, params.checklistId, { status: 'in-progress' });
  showToast.success('Checklist Reverted', 'The checklist has been moved back to In Progress.');
  return;
}
```

Update the button text/styling to indicate undo is available:
- When completed (and undo allowed): Show "Revert to In Progress" button
- When completed (and locked): Show "Completed (Locked)" badge

### Phase 2: Add undo option in completed/reconcile tabs

Files:
- `packages/web/src/components/project-ui/completed-tab/CompletedChecklistRow.jsx`
- `packages/web/src/components/project-ui/ReconcileStudyCard.jsx`

1. Add "Undo" or "Revert" button next to completed checklists
2. Only show for non-reconciled checklists
3. Wire up to the same `updateChecklist()` call with confirmation dialog

### Phase 3: Create helper function for undo eligibility

File: `packages/web/src/primitives/useProject/checklists.js` or new utility file

```js
/**
 * Check if a checklist can be reverted to in-progress
 * @param {Object} checklist - The checklist to check
 * @param {Object} study - The parent study
 * @returns {{ canUndo: boolean, reason: string | null }}
 */
export function canUndoChecklistCompletion(checklist, study) {
  if (!checklist || checklist.status !== 'completed') {
    return { canUndo: false, reason: 'Checklist is not completed' };
  }

  if (checklist.isReconciled) {
    return { canUndo: false, reason: 'Reconciled checklists cannot be reverted' };
  }

  // Check if study has a reconciled checklist
  const hasReconciled = (study?.checklists || []).some(c => c.isReconciled);
  if (hasReconciled) {
    return { canUndo: false, reason: 'A reconciled checklist exists for this study' };
  }

  return { canUndo: true, reason: null };
}
```

### Phase 4: Update UI to show undo status

`CompletedChecklistRow.jsx` changes:

```jsx
export default function CompletedChecklistRow(props) {
  const { canUndo, reason } = () => canUndoChecklistCompletion(props.checklist, props.study);

  return (
    <div class='p-4 transition-colors flex items-center justify-between hover:bg-gray-50'>
      {/* ... existing content ... */}

      <div class='flex items-center gap-2'>
        <Show when={canUndo()}>
          <button
            onClick={e => {
              e.stopPropagation();
              props.onUndo?.();
            }}
            class='px-3 py-1.5 text-amber-700 bg-amber-50 text-sm font-medium rounded-lg hover:bg-amber-100 transition-colors border border-amber-200'
            title='Move back to In Progress'
          >
            Undo
          </button>
        </Show>
        <button
          onClick={e => {
            e.stopPropagation();
            props.onOpen?.();
          }}
          class='px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors'
        >
          Open
        </button>
      </div>
    </div>
  );
}
```

### Phase 5: Update `ReconcileStudyCard` for per-checklist undo

For the reconcile tab, users might want to undo a specific reviewer's checklist. Add an expandable section or hover action to show individual checklist undo options.

Option A: Add a dropdown/menu on the checklist reviewer names
Option B: Add a subtle "undo" icon next to each reviewer name

## File changes summary

| File | Change |
| --- | --- |
| `packages/web/src/components/checklist-ui/ChecklistYjsWrapper.jsx` | Modify `handleToggleComplete()` to handle undo flow |
| `packages/web/src/components/project-ui/completed-tab/CompletedChecklistRow.jsx` | Add `onUndo` prop and Undo button |
| `packages/web/src/components/project-ui/completed-tab/CompletedStudyCard.jsx` | Pass `onUndo` handler and study to row |
| `packages/web/src/components/project-ui/ReconcileStudyCard.jsx` | Add per-checklist undo option |
| `packages/web/src/primitives/useProject/checklists.js` | Add `canUndoChecklistCompletion()` helper |
| `packages/web/src/components/project-ui/ProjectContext.jsx` | Add `undoChecklistCompletion` handler |

## UX considerations

1. Confirmation dialog: Always show confirmation before undoing to prevent accidental clicks
2. Visual feedback: Use toast notification after successful undo
3. Button styling: Use amber/warning color for undo button to distinguish from primary actions
4. Disabled state: Show tooltip explaining why undo is unavailable when locked

## Testing scenarios

1. Undo a completed checklist (single reviewer) -> moves to To Do tab
2. Undo a completed checklist (dual reviewer, waiting for other) -> stays in Reconcile tab, status changes
3. Attempt to undo when reconciled checklist exists -> error message
4. Attempt to undo a reconciled checklist -> error message
5. Verify checklist is editable after undo

## Implementation order

1. Add `canUndoChecklistCompletion()` helper function
2. Update `ChecklistYjsWrapper.jsx` for inline undo
3. Update `CompletedChecklistRow.jsx` with undo button
4. Update `CompletedStudyCard.jsx` to wire up handler
5. Update `ReconcileStudyCard.jsx` for per-checklist undo
6. Add confirmation dialogs throughout
7. Test all scenarios
