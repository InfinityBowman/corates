import { connectionPool } from '@/project/ConnectionPool';
import type { StudyInfo } from '@/stores/projectStore';
import { serializeAnswerRows, scoreChecklistRows, type ChecklistType } from '@corates/shared/sync';
import { amstar2 } from '@corates/shared';
import type { AMSTAR2Checklist } from '@corates/shared/checklists';

/** Hydrate checklist answer rows from the workspace for CSV/PDF export. */
export function enrichStudiesForExport(projectId: string, toExport: StudyInfo[]): StudyInfo[] {
  const collections = connectionPool.getCollections(projectId);
  if (!collections) return toExport;

  const answerRows = collections.answers.toArray;
  return toExport.map(study => {
    const enrichedChecklists = study.checklists.map(cl => {
      const flat: Record<string, unknown> = {};
      for (const row of answerRows) {
        if (row.checklistId === cl.id) flat[row.key] = row.value;
      }

      if (Object.keys(flat).length === 0) return cl;

      const type = cl.type as ChecklistType;
      const answers = serializeAnswerRows(type, flat);
      const score = scoreChecklistRows(type, flat);
      const enriched = { ...cl, answers, score: score !== 'Error' ? score : null };

      if (cl.type === 'AMSTAR2') {
        enriched.consolidatedAnswers = amstar2.getAnswers(answers as unknown as AMSTAR2Checklist);
      }

      return enriched;
    });

    return { ...study, checklists: enrichedChecklists };
  });
}
