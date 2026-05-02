import { useContext } from 'react';
import { useValue } from '@tldraw/state-react';
import * as Y from 'yjs';
import { ProjectReactorContext } from './context';
import {
  scoreRob2Domain,
  getActiveDomainKeys as getROB2ActiveDomainKeys,
  getDomainQuestions as getROB2DomainQuestions,
} from '@corates/shared/checklists/rob2';
import type { DomainAnswers as ROB2DomainAnswers } from '@corates/shared/checklists/rob2';
import {
  scoreRobinsDomain,
  getActiveDomainKeys as getROBINSIActiveDomainKeys,
  getDomainQuestions as getROBINSIDomainQuestions,
} from '@corates/shared/checklists/robins-i';
import type { DomainAnswers as ROBINSIDomainAnswers } from '@corates/shared/checklists/robins-i';

export function useProjectReactor() {
  const reactor = useContext(ProjectReactorContext);
  if (!reactor) throw new Error('useProjectReactor must be used within ProjectReactorContext');
  return reactor;
}

export function useStudyIds(): string[] {
  const reactor = useProjectReactor();
  return useValue(reactor.studies.ids);
}

export function useSortedStudyIds(): string[] {
  const reactor = useProjectReactor();
  return useValue(reactor.sortedStudyIds);
}

export function useStudyField<T>(studyId: string, field: string): T | null {
  const reactor = useProjectReactor();
  return useValue(
    `sf:${studyId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      return study.fields.field<T>(field).get();
    },
    [reactor, studyId, field],
  );
}

export function useChecklistIds(studyId: string): string[] {
  const reactor = useProjectReactor();
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

export function useChecklistField<T>(
  studyId: string,
  checklistId: string,
  field: string,
): T | null {
  const reactor = useProjectReactor();
  return useValue(
    `cf:${studyId}:${checklistId}:${field}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return null;
      return cl.fields.field<T>(field).get();
    },
    [reactor, studyId, checklistId, field],
  );
}

export function useAnswer<T = string | null>(
  studyId: string,
  checklistId: string,
  key: string,
): T | null {
  const reactor = useProjectReactor();
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

export function useAnswersYMap(
  studyId: string,
  checklistId: string,
): Y.Map<unknown> | null {
  const reactor = useProjectReactor();
  const study = reactor.studies.get(studyId);
  if (!study) return null;
  const cl = study.checklists.get(checklistId);
  if (!cl) return null;
  return cl.answers.ymap;
}

// --- ROB2 scoring hooks ---

export function useROB2DomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useProjectReactor();
  return useValue(
    `rob2d:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      const questions = getROB2DomainQuestions(domainKey);
      const answers: ROB2DomainAnswers = {};
      for (const qKey of Object.keys(questions)) {
        answers[qKey] = {
          answer: cl.answers.field<string | null>(qKey).get(),
        };
      }

      const result = scoreRob2Domain(domainKey, answers);
      return { judgement: result.judgement, isComplete: result.isComplete };
    },
    [reactor, studyId, checklistId, domainKey],
  );
}

export function useROB2Score(
  studyId: string,
  checklistId: string,
): string {
  const reactor = useProjectReactor();
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
      const isAdhering = aim === 'ADHERING';
      const activeDomains = getROB2ActiveDomainKeys(isAdhering);

      const judgements: string[] = [];
      for (const dk of activeDomains) {
        const questions = getROB2DomainQuestions(dk);
        const answers: ROB2DomainAnswers = {};
        for (const qKey of Object.keys(questions)) {
          answers[qKey] = {
            answer: cl.answers.field<string | null>(qKey).get(),
          };
        }
        const result = scoreRob2Domain(dk, answers);
        if (result.judgement) {
          judgements.push(result.judgement);
        }
      }

      if (judgements.length < activeDomains.length) return 'Incomplete';
      if (judgements.includes('High')) return 'High';
      if (judgements.includes('Some concerns')) return 'Some concerns';
      return 'Low';
    },
    [reactor, studyId, checklistId],
  );
}

// --- ROBINS-I scoring hooks ---

export function useROBINSIDomainScore(
  studyId: string,
  checklistId: string,
  domainKey: string,
): { judgement: string | null; isComplete: boolean } {
  const reactor = useProjectReactor();
  return useValue(
    `robinsiD:${studyId}:${checklistId}:${domainKey}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return { judgement: null, isComplete: false };
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return { judgement: null, isComplete: false };

      const questions = getROBINSIDomainQuestions(domainKey);
      const answers: ROBINSIDomainAnswers = {};
      for (const qKey of Object.keys(questions)) {
        answers[qKey] = {
          answer: cl.answers.field<string | null>(qKey).get(),
        };
      }

      const result = scoreRobinsDomain(domainKey, answers);
      return { judgement: result.judgement, isComplete: result.isComplete };
    },
    [reactor, studyId, checklistId, domainKey],
  );
}

export function useROBINSIScore(
  studyId: string,
  checklistId: string,
): string {
  const reactor = useProjectReactor();
  return useValue(
    `robinsiScore:${studyId}:${checklistId}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return 'Incomplete';
      study.checklists.ids.get();
      const cl = study.checklists.get(checklistId);
      if (!cl) return 'Incomplete';

      const isPerProtocol =
        cl.answers.field<boolean | null>('preliminary.isPerProtocol').get() === true;
      const activeDomains = getROBINSIActiveDomainKeys(isPerProtocol);

      const judgements: string[] = [];
      for (const dk of activeDomains) {
        const questions = getROBINSIDomainQuestions(dk);
        const answers: ROBINSIDomainAnswers = {};
        for (const qKey of Object.keys(questions)) {
          answers[qKey] = {
            answer: cl.answers.field<string | null>(qKey).get(),
          };
        }
        const result = scoreRobinsDomain(dk, answers);
        if (result.judgement) {
          judgements.push(result.judgement);
        }
      }

      if (judgements.length < activeDomains.length) return 'Incomplete';
      if (judgements.includes('Critical')) return 'Critical';
      if (judgements.includes('Serious')) return 'Serious';
      if (judgements.includes('Moderate')) return 'Moderate';
      if (
        judgements.includes('Low (except for concerns about uncontrolled confounding)')
      ) {
        return 'Low (except for concerns about uncontrolled confounding)';
      }
      return 'Low';
    },
    [reactor, studyId, checklistId],
  );
}
