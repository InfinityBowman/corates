/**
 * Tests for checklist-domain.js
 *
 * Tests checklist filtering, status determination, and tab logic.
 * Functions take a study object with checklists array, not raw checklists.
 */

import { describe, it, expect } from 'vitest';
import {
  isReconciledChecklist,
  getTodoChecklists,
  getCompletedChecklists,
  getFinalizedChecklist,
  getReconciliationChecklists,
  shouldShowInTab,
  getStudiesForTab,
  getChecklistCount,
  getNextStatusForCompletion,
  findReconciledChecklist,
  isDualReviewerStudy,
  getReconciliationChecklistsByOutcome,
  getReadyReconciliationPairs,
  CHECKLIST_STATUS,
} from '@corates/shared/checklists';

// Test fixtures
const createChecklist = (overrides = {}) => ({
  id: 'cl-1',
  type: 'AMSTAR2',
  status: CHECKLIST_STATUS.PENDING,
  assignedTo: 'user-1',
  ...overrides,
});

const createStudy = (overrides = {}) => ({
  id: 'study-1',
  projectId: 'project-1',
  reviewer1: 'user-1',
  reviewer2: null,
  checklists: [],
  ...overrides,
});

describe('checklist-domain', () => {
  describe('isReconciledChecklist', () => {
    it('returns true for checklist with assignedTo null', () => {
      const checklist = createChecklist({ assignedTo: null });
      expect(isReconciledChecklist(checklist)).toBe(true);
    });

    it('returns false for checklist assigned to a user', () => {
      const checklist = createChecklist({ assignedTo: 'user-1' });
      expect(isReconciledChecklist(checklist)).toBe(false);
    });

    it('returns false for null checklist', () => {
      expect(isReconciledChecklist(null)).toBe(false);
    });

    it('returns false for undefined checklist', () => {
      expect(isReconciledChecklist(undefined)).toBe(false);
    });
  });

  describe('getTodoChecklists', () => {
    const userId = 'user-1';

    it('returns checklists assigned to user that are not completed', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: userId, status: CHECKLIST_STATUS.PENDING }),
          createChecklist({
            id: 'cl-2',
            assignedTo: userId,
            status: CHECKLIST_STATUS.IN_PROGRESS,
          }),
          createChecklist({
            id: 'cl-3',
            assignedTo: userId,
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      const result = getTodoChecklists(study, userId);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['cl-1', 'cl-2']);
    });

    it('excludes checklists assigned to other users', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: userId, status: CHECKLIST_STATUS.PENDING }),
          createChecklist({
            id: 'cl-2',
            assignedTo: 'other-user',
            status: CHECKLIST_STATUS.PENDING,
          }),
        ],
      });
      const result = getTodoChecklists(study, userId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('cl-1');
    });

    it('excludes finalized checklists', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: userId, status: CHECKLIST_STATUS.FINALIZED }),
        ],
      });
      const result = getTodoChecklists(study, userId);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for null study', () => {
      expect(getTodoChecklists(null, userId)).toEqual([]);
    });

    it('returns empty array for null userId', () => {
      const study = createStudy();
      expect(getTodoChecklists(study, null)).toEqual([]);
    });
  });

  describe('getCompletedChecklists', () => {
    it('returns checklists with FINALIZED status', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', status: CHECKLIST_STATUS.FINALIZED }),
          createChecklist({ id: 'cl-2', status: CHECKLIST_STATUS.REVIEWER_COMPLETED }),
          createChecklist({ id: 'cl-3', status: CHECKLIST_STATUS.FINALIZED }),
        ],
      });
      const result = getCompletedChecklists(study);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['cl-1', 'cl-3']);
    });

    it('returns empty array for null study', () => {
      expect(getCompletedChecklists(null)).toEqual([]);
    });
  });

  describe('getFinalizedChecklist', () => {
    it('returns finalized reconciled checklist first', () => {
      const study = createStudy({
        checklists: [
          createChecklist({
            id: 'cl-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.FINALIZED,
          }),
          createChecklist({
            id: 'cl-2',
            assignedTo: null, // Reconciled
            status: CHECKLIST_STATUS.FINALIZED,
          }),
        ],
      });
      const result = getFinalizedChecklist(study);
      expect(result!.id).toBe('cl-2');
    });

    it('returns any finalized checklist if no reconciled', () => {
      const study = createStudy({
        checklists: [
          createChecklist({
            id: 'cl-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.FINALIZED,
          }),
        ],
      });
      const result = getFinalizedChecklist(study);
      expect(result!.id).toBe('cl-1');
    });

    it('returns null when no finalized checklist exists', () => {
      const study = createStudy({
        checklists: [createChecklist({ status: CHECKLIST_STATUS.PENDING })],
      });
      expect(getFinalizedChecklist(study)).toBeNull();
    });

    it('returns null for null study', () => {
      expect(getFinalizedChecklist(null)).toBeNull();
    });
  });

  describe('getReconciliationChecklists', () => {
    it('returns individual checklists with REVIEWER_COMPLETED status', () => {
      const study = createStudy({
        checklists: [
          createChecklist({
            id: 'cl-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-2',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-3',
            assignedTo: null, // Reconciled - should be excluded
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      const result = getReconciliationChecklists(study);
      expect(result).toHaveLength(2);
      expect(result.map(c => c.id)).toEqual(['cl-1', 'cl-2']);
    });

    it('excludes pending and in-progress checklists', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: 'user-1', status: CHECKLIST_STATUS.PENDING }),
          createChecklist({
            id: 'cl-2',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.IN_PROGRESS,
          }),
        ],
      });
      const result = getReconciliationChecklists(study);
      expect(result).toHaveLength(0);
    });

    it('returns empty array for null study', () => {
      expect(getReconciliationChecklists(null)).toEqual([]);
    });
  });

  describe('shouldShowInTab', () => {
    const userId = 'user-1';

    describe('todo tab', () => {
      it('shows study when user is reviewer and has no checklist yet', () => {
        const study = createStudy({
          reviewer1: userId,
          checklists: [],
        });
        expect(shouldShowInTab(study, 'todo', userId)).toBe(true);
      });

      it('shows study when user has in-progress checklist', () => {
        const study = createStudy({
          reviewer1: userId,
          checklists: [
            createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.IN_PROGRESS }),
          ],
        });
        expect(shouldShowInTab(study, 'todo', userId)).toBe(true);
      });

      it('hides study when user has completed checklist', () => {
        const study = createStudy({
          reviewer1: userId,
          checklists: [
            createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.REVIEWER_COMPLETED }),
          ],
        });
        expect(shouldShowInTab(study, 'todo', userId)).toBe(false);
      });

      it('hides study when user is not a reviewer', () => {
        const study = createStudy({
          reviewer1: 'other-user',
          reviewer2: 'another-user',
          checklists: [],
        });
        expect(shouldShowInTab(study, 'todo', userId)).toBe(false);
      });
    });

    describe('reconcile tab', () => {
      it('shows dual-reviewer study with completed reviewer checklists', () => {
        const study = createStudy({
          reviewer1: 'user-1',
          reviewer2: 'user-2',
          checklists: [
            createChecklist({
              id: 'cl-1',
              assignedTo: 'user-1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            }),
            createChecklist({
              id: 'cl-2',
              assignedTo: 'user-2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            }),
          ],
        });
        expect(shouldShowInTab(study, 'reconcile', userId)).toBe(true);
      });

      it('hides single-reviewer study', () => {
        const study = createStudy({
          reviewer1: 'user-1',
          reviewer2: null,
          checklists: [
            createChecklist({
              assignedTo: 'user-1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            }),
          ],
        });
        expect(shouldShowInTab(study, 'reconcile', userId)).toBe(false);
      });

      it('hides study when only reconciled checklist exists (no reviewer-completed)', () => {
        const study = createStudy({
          reviewer1: 'user-1',
          reviewer2: 'user-2',
          checklists: [
            createChecklist({
              id: 'cl-1',
              assignedTo: null, // Reconciled
              status: CHECKLIST_STATUS.FINALIZED,
            }),
          ],
        });
        expect(shouldShowInTab(study, 'reconcile', userId)).toBe(false);
      });

      it('hides study when reviewer-completed checklists exist but reconciled is already finalized', () => {
        const study = createStudy({
          reviewer1: 'user-1',
          reviewer2: 'user-2',
          checklists: [
            createChecklist({
              id: 'cl-1',
              type: 'AMSTAR2',
              assignedTo: 'user-1',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            }),
            createChecklist({
              id: 'cl-2',
              type: 'AMSTAR2',
              assignedTo: 'user-2',
              status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
            }),
            createChecklist({
              id: 'cl-reconciled',
              type: 'AMSTAR2',
              assignedTo: null,
              status: CHECKLIST_STATUS.FINALIZED,
            }),
          ],
        });
        expect(shouldShowInTab(study, 'reconcile', userId)).toBe(false);
      });
    });

    describe('completed tab', () => {
      it('shows study with finalized checklist', () => {
        const study = createStudy({
          checklists: [createChecklist({ status: CHECKLIST_STATUS.FINALIZED })],
        });
        expect(shouldShowInTab(study, 'completed', userId)).toBe(true);
      });

      it('hides study without finalized checklist', () => {
        const study = createStudy({
          checklists: [createChecklist({ status: CHECKLIST_STATUS.REVIEWER_COMPLETED })],
        });
        expect(shouldShowInTab(study, 'completed', userId)).toBe(false);
      });
    });
  });

  describe('getStudiesForTab', () => {
    const userId = 'user-1';

    it('filters studies for todo tab', () => {
      const studies = [
        createStudy({
          id: 'study-1',
          reviewer1: userId,
          checklists: [createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.PENDING })],
        }),
        createStudy({
          id: 'study-2',
          reviewer1: userId,
          checklists: [
            createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.REVIEWER_COMPLETED }),
          ],
        }),
      ];
      const result = getStudiesForTab(studies, 'todo', userId);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('study-1');
    });

    it('returns empty array for empty input', () => {
      expect(getStudiesForTab([], 'todo', userId)).toEqual([]);
    });

    it('returns empty array for null input', () => {
      expect(getStudiesForTab(null, 'todo', userId)).toEqual([]);
    });
  });

  describe('isDualReviewerStudy', () => {
    it('returns true when study has two reviewers', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
      });
      expect(isDualReviewerStudy(study)).toBe(true);
    });

    it('returns false when study has only one reviewer', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: null,
      });
      expect(isDualReviewerStudy(study)).toBe(false);
    });

    it('returns false for null study', () => {
      expect(isDualReviewerStudy(null)).toBe(false);
    });
  });

  describe('getNextStatusForCompletion', () => {
    it('returns FINALIZED for single reviewer study', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: null,
      });
      expect(getNextStatusForCompletion(study)).toBe(CHECKLIST_STATUS.FINALIZED);
    });

    it('returns REVIEWER_COMPLETED for dual reviewer study', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
      });
      expect(getNextStatusForCompletion(study)).toBe(CHECKLIST_STATUS.REVIEWER_COMPLETED);
    });
  });

  describe('findReconciledChecklist', () => {
    it('returns reconciled checklist if exists', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: 'user-1' }),
          createChecklist({ id: 'cl-2', assignedTo: null }), // Reconciled
        ],
      });
      const result = findReconciledChecklist(study);
      expect(result!.id).toBe('cl-2');
    });

    it('excludes specified checklist id', () => {
      const study = createStudy({
        checklists: [
          createChecklist({ id: 'cl-1', assignedTo: null }),
          createChecklist({ id: 'cl-2', assignedTo: null }),
        ],
      });
      const result = findReconciledChecklist(study, 'cl-1');
      expect(result!.id).toBe('cl-2');
    });

    it('returns null when no reconciled checklist exists', () => {
      const study = createStudy({
        checklists: [createChecklist({ id: 'cl-1', assignedTo: 'user-1' })],
      });
      expect(findReconciledChecklist(study)).toBeNull();
    });
  });

  describe('getChecklistCount', () => {
    const userId = 'user-1';

    it('returns count for todo tab', () => {
      const studies = [
        createStudy({
          id: 'study-1',
          reviewer1: userId,
          checklists: [createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.PENDING })],
        }),
        createStudy({
          id: 'study-2',
          reviewer1: userId,
          checklists: [createChecklist({ assignedTo: userId, status: CHECKLIST_STATUS.PENDING })],
        }),
      ];
      const count = getChecklistCount(studies, 'todo', userId);
      expect(count).toBe(2);
    });

    it('returns 0 for empty array', () => {
      expect(getChecklistCount([], 'todo', userId)).toBe(0);
    });
  });

  describe('reconcile tab - multi-outcome studies', () => {
    it('shows study when multiple outcomes each have 2 reviewer-completed checklists', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
        checklists: [
          createChecklist({
            id: 'cl-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-2',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-3',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-4',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      expect(shouldShowInTab(study, 'reconcile', null)).toBe(true);
    });

    it('groups reconciliation checklists by outcome correctly', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
        checklists: [
          createChecklist({
            id: 'cl-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-2',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-3',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      const groups = getReconciliationChecklistsByOutcome(study);
      expect(groups).toHaveLength(2);
      const outcome1 = groups.find(g => g.outcomeId === 'outcome-1');
      const outcome2 = groups.find(g => g.outcomeId === 'outcome-2');
      expect(outcome1!.checklists).toHaveLength(2);
      expect(outcome2!.checklists).toHaveLength(1);
    });

    it('returns ready pairs only for outcomes with exactly 2 checklists', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
        checklists: [
          createChecklist({
            id: 'cl-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-2',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-3',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      const readyPairs = getReadyReconciliationPairs(study);
      expect(readyPairs).toHaveLength(1);
      expect(readyPairs[0].outcomeId).toBe('outcome-1');
    });

    it('hides reconciled outcome but shows remaining unreconciled outcomes', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
        checklists: [
          // outcome-1: both reviewers done, AND already has finalized reconciled checklist
          createChecklist({
            id: 'cl-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-2',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-reconciled-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: null,
            status: CHECKLIST_STATUS.FINALIZED,
          }),
          // outcome-2: both reviewers done, no reconciled checklist yet
          createChecklist({
            id: 'cl-3',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
          createChecklist({
            id: 'cl-4',
            type: 'ROB2',
            outcomeId: 'outcome-2',
            assignedTo: 'user-2',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      // Study should still show because outcome-2 needs reconciliation
      expect(shouldShowInTab(study, 'reconcile', null)).toBe(true);
    });

    it('shows "waiting" state when only one reviewer has completed for an outcome', () => {
      const study = createStudy({
        reviewer1: 'user-1',
        reviewer2: 'user-2',
        checklists: [
          createChecklist({
            id: 'cl-1',
            type: 'ROB2',
            outcomeId: 'outcome-1',
            assignedTo: 'user-1',
            status: CHECKLIST_STATUS.REVIEWER_COMPLETED,
          }),
        ],
      });
      // Should show in reconcile tab with "waiting" state
      expect(shouldShowInTab(study, 'reconcile', null)).toBe(true);
      const groups = getReconciliationChecklistsByOutcome(study);
      expect(groups).toHaveLength(1);
      expect(groups[0].checklists).toHaveLength(1);
    });
  });
});

describe('computeProjectStats - status matching', () => {
  it('should count studies with finalized checklists as completed', () => {
    const studies = [
      {
        id: 'study-1',
        name: 'Test Study',
        checklists: [{ id: 'cl-1', type: 'AMSTAR2', status: CHECKLIST_STATUS.FINALIZED }],
      },
    ];

    // Mirrors the logic in projectStore.ts computeProjectStats
    let completedCount = 0;
    for (const study of studies) {
      const hasCompletedChecklist = study.checklists?.some(
        c => c.status === CHECKLIST_STATUS.FINALIZED,
      );
      if (hasCompletedChecklist) {
        completedCount++;
      }
    }

    expect(completedCount).toBe(1);
  });

  it('should not count non-finalized studies as completed', () => {
    const studies = [
      {
        id: 'study-1',
        name: 'Test Study',
        checklists: [
          { id: 'cl-1', type: 'AMSTAR2', status: CHECKLIST_STATUS.IN_PROGRESS as string },
        ],
      },
    ];

    let completedCount = 0;
    for (const study of studies) {
      const hasCompletedChecklist = study.checklists?.some(
        c => c.status === CHECKLIST_STATUS.FINALIZED,
      );
      if (hasCompletedChecklist) {
        completedCount++;
      }
    }

    expect(completedCount).toBe(0);
  });
});
