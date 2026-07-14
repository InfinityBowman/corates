/**
 * Bug hunt: a study with only Reviewer 2 assigned (reviewer1 null) is treated
 * as a dual-reviewer study by the completion/tab domain logic.
 *
 * Reachable flow (today): AssignReviewersModal only validates that the two
 * selects are not the same user (handleSave, AssignReviewersModal.tsx line 74);
 * it happily saves { reviewer1: null, reviewer2: userX }. The study then shows
 * in userX's Todo tab (shouldShowInTab checks reviewer1 OR reviewer2). When
 * userX marks their appraisal complete, ChecklistYjsWrapper.confirmMarkComplete
 * calls getNextStatusForCompletion(study), which computes
 * isSingleReviewer = reviewer1 && !reviewer2 -- false for a reviewer2-only
 * study -- and returns REVIEWER_COMPLETED ("awaiting reconciliation").
 *
 * Result: the checklist is locked (canTransitionTo forbids leaving
 * reviewer-completed), the study leaves the Todo tab, never qualifies for the
 * Reconcile tab (which requires BOTH reviewers), and never reaches the
 * Completed tab (nothing is ever FINALIZED). The completed appraisal is
 * stranded invisibly with no user-facing way to recover it.
 *
 * The mirrored case, { reviewer1: userX, reviewer2: null }, correctly
 * finalizes, so the intent is clearly that any lone reviewer finalizes.
 */

import { describe, it, expect } from 'vitest';
import {
  getNextStatusForCompletion,
  shouldShowInTab,
  getStudiesForTab,
  CHECKLIST_STATUS,
  type Study,
} from '@corates/shared/checklists';

const USER = 'user-2';

function reviewer2OnlyStudy(checklistStatus: string): Study {
  return {
    id: 'study-1',
    projectId: 'project-1',
    reviewer1: null,
    reviewer2: USER,
    checklists: [
      {
        id: 'cl-1',
        type: 'AMSTAR2',
        status: checklistStatus,
        assignedTo: USER,
      },
    ],
  };
}

describe('reviewer2-only study (reviewer1 unassigned)', () => {
  it('completion by the lone reviewer finalizes, mirroring the reviewer1-only case', () => {
    const reviewer1Only: Study = {
      id: 'study-a',
      reviewer1: USER,
      reviewer2: null,
      checklists: [],
    };
    // Established behavior: a lone reviewer in slot 1 finalizes directly.
    expect(getNextStatusForCompletion(reviewer1Only)).toBe(CHECKLIST_STATUS.FINALIZED);

    // A lone reviewer in slot 2 is equally a single-reviewer study; there is
    // no second reviewer to reconcile with, so completion must also finalize.
    const reviewer2Only = reviewer2OnlyStudy(CHECKLIST_STATUS.IN_PROGRESS);
    expect(getNextStatusForCompletion(reviewer2Only)).toBe(CHECKLIST_STATUS.FINALIZED);
  });

  it('a completed reviewer2-only appraisal must remain visible in some tab', () => {
    // Reproduce exactly what confirmMarkComplete writes today for this study:
    // getNextStatusForCompletion returns REVIEWER_COMPLETED.
    const statusWrittenByApp = getNextStatusForCompletion(
      reviewer2OnlyStudy(CHECKLIST_STATUS.IN_PROGRESS),
    );
    const study = reviewer2OnlyStudy(statusWrittenByApp);

    const visibleInTodo = shouldShowInTab(study, 'todo', USER);
    const visibleInReconcile = shouldShowInTab(study, 'reconcile', USER);
    const visibleInCompleted = shouldShowInTab(study, 'completed', USER);

    // The appraisal was completed; the study must not vanish from all tabs.
    expect(visibleInTodo || visibleInReconcile || visibleInCompleted).toBe(true);
  });

  it('a completed reviewer2-only appraisal counts toward the completed tab list', () => {
    const statusWrittenByApp = getNextStatusForCompletion(
      reviewer2OnlyStudy(CHECKLIST_STATUS.IN_PROGRESS),
    );
    const study = reviewer2OnlyStudy(statusWrittenByApp);

    const completed = getStudiesForTab([study], 'completed', USER);
    expect(completed).toHaveLength(1);
  });
});
