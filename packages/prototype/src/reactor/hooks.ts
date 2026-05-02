import { useValue } from '@tldraw/state-react';
import { useContext } from 'react';
import * as Y from 'yjs';
import { ProjectReactorContext } from './context';
import type { StudyFields } from '../types';
import type { ChecklistFields } from '../types';
import {
  AMSTAR2_SCHEMA,
  cbKey,
  verdictKey,
  scoreAMSTAR2,
  consolidateSectionVerdicts,
} from '../amstar2';
import type { AMSTAR2Score } from '../amstar2';
import {
  scoreROB2,
  scoreROB2Domain,
} from '../rob2';
import type { ROB2Score } from '../rob2';
import {
  scoreROBINSI,
  scoreROBINSIDomain,
} from '../robins-i';
import type { ROBINSIScore } from '../robins-i';

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

// Generic flat-key answer reader. Works for any checklist type.
export function useAnswer<T = string | null>(
  studyId: string,
  checklistId: string,
  key: string,
): T | null {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `a:${studyId}:${checklistId}:${key}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.answers.field<T>(key).get();
    },
    [reactor, studyId, checklistId, key],
  );
}

// Returns the raw answers Y.Map for direct mutations.
export function useAnswersYMap(
  studyId: string,
  checklistId: string,
): Y.Map<unknown> | null {
  const reactor = useContext(ProjectReactorContext);
  const study = reactor.studies.get(studyId);
  if (!study) return null;
  const cl = study.checklists.get(checklistId);
  if (!cl) return null;
  return cl.answers.ymap;
}

// --- AMSTAR2-specific hooks ---

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
      return cbCols.map((col, colIdx) =>
        col.options.map((_, optIdx) =>
          cl.answers.field<boolean>(cbKey(questionKey, colIdx, optIdx, section)).get() ?? false,
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
  const vKey = verdictKey(questionKey, section);

  return useValue(
    `qv:${studyId}:${checklistId}:${questionKey}:${section ?? ''}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.answers.field<string | null>(vKey).get();
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

      return scoreAMSTAR2((key: string) => {
        const schema = AMSTAR2_SCHEMA[key];

        if (schema.sections) {
          const verdicts = schema.sections.map(sec =>
            cl.answers.field<string | null>(verdictKey(key, sec.key)).get(),
          );
          return consolidateSectionVerdicts(verdicts[0], verdicts[1]);
        }

        return cl.answers.field<string | null>(verdictKey(key)).get();
      });
    },
    [reactor, studyId, checklistId],
  );
}

// --- ROB2-specific hooks ---

export function useROB2Score(
  studyId: string,
  checklistId: string,
): ROB2Score {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `rob2score:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';

      const aim = cl.answers.field<string | null>('preliminary.aim').get();
      return scoreROB2(
        (qKey) => cl.answers.field<string | null>(qKey).get(),
        aim,
      );
    },
    [reactor, studyId, checklistId],
  );
}

export function useROB2DomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `rob2d:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      return scoreROB2Domain(
        domainKey,
        (qKey) => cl.answers.field<string | null>(qKey).get(),
      );
    },
    [reactor, studyId, checklistId, domainKey],
  );
}

// --- ROBINS-I-specific hooks ---

export function useROBINSIScore(
  studyId: string,
  checklistId: string,
): ROBINSIScore {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `robinsiScore:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';

      const isPerProtocol = cl.answers.field<boolean | null>('preliminary.isPerProtocol').get();
      return scoreROBINSI(
        (qKey) => cl.answers.field<string | null>(qKey).get(),
        isPerProtocol === true,
      );
    },
    [reactor, studyId, checklistId],
  );
}

export function useROBINSIDomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `robinsiD:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      return scoreROBINSIDomain(
        domainKey,
        (qKey) => cl.answers.field<string | null>(qKey).get(),
      );
    },
    [reactor, studyId, checklistId, domainKey],
  );
}
