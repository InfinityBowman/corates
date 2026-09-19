import {
  planAnswerCopy,
  type ChecklistRow,
  type ChecklistType,
  type CopyPlanEntry,
} from '@corates/shared/sync';
import { connectionPool } from '@/project/ConnectionPool';
import {
  useProjectOutcomes,
  useStudyAnswerMaps,
  useStudyAnswersForKeys,
  useStudyChecklists,
} from '@/project/workspace-data';

export interface Sibling {
  checklist: ChecklistRow;
  outcomeName: string;
}

export interface CopySource extends Sibling {
  plan: CopyPlanEntry[];
  /** The sections a copy from this source would fill right now. */
  copyable: CopyPlanEntry[];
  /**
   * The plan for a chosen subset of the sections, since leaving one out can
   * block another that relied on it landing alongside.
   */
  replan: (sectionIds: string[]) => CopyPlanEntry[];
}

export interface QuestionSource extends Sibling {
  answer: string | null;
  comment: string;
}

export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/**
 * The reviewer's own appraisals of the same study and instrument on other
 * outcomes. Empty when the checklist is not outcome-scoped, is the
 * consensus, or simply has no siblings, so nothing copy-related renders on
 * a single-outcome project or on AMSTAR 2.
 */
export function useSiblingAppraisals(
  projectId: string,
  studyId: string,
  checklistId: string,
): { target: ChecklistRow | null; siblings: Sibling[] } {
  const checklists = useStudyChecklists(projectId, studyId);
  const outcomes = useProjectOutcomes(projectId);
  const target = checklists.find(c => c.id === checklistId) ?? null;
  if (!target || !target.assignedTo || !target.outcomeId || target.kind === 'consensus') {
    return { target, siblings: [] };
  }
  const siblings = checklists
    .filter(
      c =>
        c.id !== target.id &&
        c.type === target.type &&
        c.kind !== 'consensus' &&
        c.assignedTo === target.assignedTo &&
        c.outcomeId &&
        c.outcomeId !== target.outcomeId,
    )
    .map(checklist => ({
      checklist,
      outcomeName: outcomes.find(o => o.id === checklist.outcomeId)?.name ?? 'Unknown outcome',
    }));
  return { target, siblings };
}

/** Each sibling with what copying its study-level sections into `checklistId` would do. */
export function useCopySources(
  projectId: string,
  studyId: string,
  checklistId: string,
): CopySource[] {
  const { target, siblings } = useSiblingAppraisals(projectId, studyId, checklistId);
  const answers = useStudyAnswerMaps(projectId, studyId);
  if (!target) return [];
  const type = target.type as ChecklistType;
  return siblings.map(sibling => {
    const from = answers[sibling.checklist.id] ?? {};
    const into = answers[target.id] ?? {};
    const plan = planAnswerCopy(type, from, into);
    return {
      ...sibling,
      plan,
      copyable: plan.filter(entry => !entry.blocker),
      replan: (sectionIds: string[]) => planAnswerCopy(type, from, into, sectionIds),
    };
  });
}

/** Each sibling's answer and comment for one question. */
export function useQuestionSources(
  projectId: string,
  studyId: string,
  checklistId: string,
  questionKey: string,
): QuestionSource[] {
  const { siblings } = useSiblingAppraisals(projectId, studyId, checklistId);
  const commentKey = `${questionKey}.comment`;
  const rows = useStudyAnswersForKeys(projectId, studyId, [questionKey, commentKey]);
  return siblings.map(sibling => {
    const own = rows.filter(row => row.checklistId === sibling.checklist.id);
    return {
      ...sibling,
      answer: (own.find(row => row.key === questionKey)?.value as string | null) ?? null,
      comment: (own.find(row => row.key === commentKey)?.value as string | undefined) ?? '',
    };
  });
}

export function copyAnswersFrom(
  projectId: string,
  fromChecklistId: string,
  toChecklistId: string,
  what: { sections?: string[]; keys?: string[] },
): void {
  const client = connectionPool.getClient(projectId);
  if (!client) return;
  void client.mutate.checklist.copyAnswers({
    fromChecklistId,
    toChecklistId,
    ...what,
    now: Date.now(),
  });
}
