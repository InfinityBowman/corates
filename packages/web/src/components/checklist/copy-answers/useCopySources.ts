import { planAnswerCopy, type ChecklistType, type CopyPlanEntry } from '@corates/shared/sync';
import { connectionPool } from '@/project/ConnectionPool';
import { useProjectOutcomes, useStudy, useStudyAnswerMaps } from '@/project/workspace-data';
import type { ChecklistEntry } from '@/stores/projectStore';

export interface CopySource {
  checklist: ChecklistEntry;
  outcomeName: string;
  plan: CopyPlanEntry[];
  /** The sections a copy from this source would fill right now. */
  copyable: CopyPlanEntry[];
}

/**
 * The reviewer's own appraisals of the same study and instrument on other
 * outcomes, each with what copying it into `checklistId` would do. Empty
 * when the checklist is not outcome-scoped, is the consensus, or has no
 * siblings, so the menu has nothing to show in a single-outcome project.
 */
export function useCopySources(
  projectId: string,
  studyId: string,
  checklistId: string,
): CopySource[] {
  const study = useStudy(projectId, studyId);
  const outcomes = useProjectOutcomes(projectId);
  const answers = useStudyAnswerMaps(projectId, studyId);

  const target = study?.checklists.find(c => c.id === checklistId);
  if (!study || !target || !target.assignedTo || !target.outcomeId) return [];
  if (target.kind === 'consensus') return [];

  return study.checklists
    .filter(
      c =>
        c.id !== target.id &&
        c.type === target.type &&
        c.kind !== 'consensus' &&
        c.assignedTo === target.assignedTo &&
        c.outcomeId &&
        c.outcomeId !== target.outcomeId,
    )
    .map(checklist => {
      const plan = planAnswerCopy(
        target.type as ChecklistType,
        answers[checklist.id] ?? {},
        answers[target.id] ?? {},
      );
      return {
        checklist,
        outcomeName: outcomes.find(o => o.id === checklist.outcomeId)?.name ?? 'Unknown outcome',
        plan,
        copyable: plan.filter(entry => !entry.blocker),
      };
    });
}

export function copyAnswersFrom(
  projectId: string,
  fromChecklistId: string,
  toChecklistId: string,
  sections: string[],
): void {
  const client = connectionPool.getClient(projectId);
  if (!client) return;
  void client.mutate.checklist.copyAnswers({
    fromChecklistId,
    toChecklistId,
    sections,
    now: Date.now(),
  });
}
