import { describe, it, expect } from 'vitest';
import { CHECKLIST_STATUS } from '@corates/shared/checklists';
import type { ChecklistEntry, StudyInfo } from '@/stores/projectStore';
import { countMemberProgress } from '../memberProgress';

let nextId = 0;

function checklist(
  assignedTo: string | null,
  status: string,
  extra: Partial<ChecklistEntry> = {},
): ChecklistEntry {
  return {
    id: `c${nextId++}`,
    type: 'ROB2',
    kind: 'reviewer',
    title: null,
    assignedTo,
    outcomeId: 'o1',
    status,
    createdAt: 0,
    updatedAt: 0,
    score: null,
    answers: null,
    ...extra,
  };
}

function study(
  reviewer1: string | null,
  reviewer2: string | null,
  checklists: ChecklistEntry[],
): StudyInfo {
  return { id: 's', reviewer1, reviewer2, checklists } as unknown as StudyInfo;
}

describe('countMemberProgress', () => {
  it('counts each outcome as its own appraisal', () => {
    const progress = countMemberProgress([
      study('alice', 'bob', [
        checklist('alice', CHECKLIST_STATUS.REVIEWER_COMPLETED, { outcomeId: 'o1' }),
        checklist('alice', CHECKLIST_STATUS.IN_PROGRESS, { outcomeId: 'o2' }),
        checklist('alice', CHECKLIST_STATUS.PENDING, { outcomeId: 'o3' }),
        checklist('bob', CHECKLIST_STATUS.PENDING, { outcomeId: 'o1' }),
      ]),
    ]);
    expect(progress.get('alice')).toEqual({ completed: 1, total: 3 });
    expect(progress.get('bob')).toEqual({ completed: 0, total: 1 });
  });

  it('counts finalized single-reviewer appraisals as done', () => {
    const progress = countMemberProgress([
      study('alice', null, [checklist('alice', CHECKLIST_STATUS.FINALIZED)]),
    ]);
    expect(progress.get('alice')).toEqual({ completed: 1, total: 1 });
  });

  it('skips consensus checklists and reviewers no longer on the study', () => {
    const progress = countMemberProgress([
      study('alice', 'bob', [
        checklist('alice', CHECKLIST_STATUS.RECONCILING, { kind: 'consensus' }),
        checklist('carol', CHECKLIST_STATUS.REVIEWER_COMPLETED),
      ]),
    ]);
    expect(progress.has('alice')).toBe(false);
    expect(progress.has('carol')).toBe(false);
  });

  it('does not double count a reviewer who holds both slots', () => {
    const progress = countMemberProgress([
      study('alice', 'alice', [checklist('alice', CHECKLIST_STATUS.IN_PROGRESS)]),
    ]);
    expect(progress.get('alice')).toEqual({ completed: 0, total: 1 });
  });
});
