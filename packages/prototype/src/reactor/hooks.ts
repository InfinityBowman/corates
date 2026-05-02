import { useValue } from '@tldraw/state-react';
import { useContext } from 'react';
import * as Y from 'yjs';
import { ProjectReactorContext } from './context';
import type { StudyFields } from '../types';
import type { ChecklistFields } from '../types';
import type { QuestionFields } from '../types';
import {
  AMSTAR2_QUESTION_KEYS,
  AMSTAR2_SCHEMA,
  cbKey,
  verdictKey,
  scoreAMSTAR2,
  consolidateSectionVerdicts,
} from '../amstar2';
import type { AMSTAR2Score } from '../amstar2';

export function useProjectReactor() {
  return useContext(ProjectReactorContext);
}

export function useStudyIds(): string[] {
  const reactor = useContext(ProjectReactorContext);
  return useValue(reactor.studies.ids);
}

export function useSortedStudyIds(): string[] {
  const reactor = useContext(ProjectReactorContext);
  return useValue(reactor.sortedStudyIds);
}

export function useProjectStats() {
  const reactor = useContext(ProjectReactorContext);
  return useValue(reactor.stats);
}

export function useStudyField<K extends keyof StudyFields>(
  studyId: string,
  field: K,
): StudyFields[K] | null {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `sf:${studyId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      return study.fields.field<StudyFields[K]>(field).get();
    },
    [reactor, studyId, field],
  );
}

export function useChecklistIds(studyId: string): string[] {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `ci:${studyId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return [];
      return study.checklists.ids.get();
    },
    [reactor, studyId],
  );
}

export function useChecklistField<K extends keyof ChecklistFields>(
  studyId: string,
  checklistId: string,
  field: K,
): ChecklistFields[K] | null {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `cf:${studyId}:${checklistId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.fields.field<ChecklistFields[K]>(field).get();
    },
    [reactor, studyId, checklistId, field],
  );
}

export function useQuestionField<K extends keyof QuestionFields>(
  studyId: string,
  checklistId: string,
  questionKey: string,
  field: K,
): QuestionFields[K] | null {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `qf:${studyId}:${checklistId}:${questionKey}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      cl.answers.ids.get();
      const q = cl.answers.get(questionKey);
      if (!q) return null;
      return q.field<QuestionFields[K]>(field).get();
    },
    [reactor, studyId, checklistId, questionKey, field],
  );
}

export function useQuestionCheckboxes(
  studyId: string,
  checklistId: string,
  questionKey: string,
  section?: string,
): boolean[][] {
  const reactor = useContext(ProjectReactorContext);
  const schema = AMSTAR2_SCHEMA[questionKey];
  const columns = section
    ? schema.sections!.find(s => s.key === section)!.columns
    : schema.columns!;
  const cbCols = columns.slice(0, -1);

  return useValue(
    `qcb:${studyId}:${checklistId}:${questionKey}:${section ?? ''}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return cbCols.map(c => c.options.map(() => false));
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return cbCols.map(c => c.options.map(() => false));
      cl.answers.ids.get();
      const q = cl.answers.get(questionKey);
      if (!q) return cbCols.map(c => c.options.map(() => false));
      return cbCols.map((col, colIdx) =>
        col.options.map((_, optIdx) =>
          q.field<boolean>(cbKey(colIdx, optIdx, section)).get() ?? false,
        ),
      );
    },
    [reactor, studyId, checklistId, questionKey, section],
  );
}

export function useSectionVerdict(
  studyId: string,
  checklistId: string,
  questionKey: string,
  section?: string,
): string | null {
  const reactor = useContext(ProjectReactorContext);
  const vKey = verdictKey(section);

  return useValue(
    `qv:${studyId}:${checklistId}:${questionKey}:${section ?? ''}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      cl.answers.ids.get();
      const q = cl.answers.get(questionKey);
      if (!q) return null;
      return q.field<string | null>(vKey).get();
    },
    [reactor, studyId, checklistId, questionKey, section],
  );
}

export function useChecklistScore(
  studyId: string,
  checklistId: string,
): AMSTAR2Score {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `score:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';
      cl.answers.ids.get();

      return scoreAMSTAR2((key: string) => {
        const q = cl.answers.get(key);
        if (!q) return null;
        const schema = AMSTAR2_SCHEMA[key];

        if (schema.sections) {
          const verdicts = schema.sections.map(sec =>
            q.field<string | null>(verdictKey(sec.key)).get(),
          );
          return consolidateSectionVerdicts(verdicts[0], verdicts[1]);
        }

        return q.field<string | null>(verdictKey()).get();
      });
    },
    [reactor, studyId, checklistId],
  );
}

export function useQuestionYMap(
  studyId: string,
  checklistId: string,
  questionKey: string,
): Y.Map<unknown> | null {
  const reactor = useContext(ProjectReactorContext);
  const study = reactor.studies.get(studyId);
  if (!study) return null;
  const cl = study.checklists.get(checklistId);
  if (!cl) return null;
  const answersYMap = cl.fields.ymap.get('answers') as Y.Map<unknown> | undefined;
  if (!answersYMap) return null;
  const qYMap = answersYMap.get(questionKey) as Y.Map<unknown> | undefined;
  return qYMap ?? null;
}
