import { useValue } from '@tldraw/state-react';
import { useContext } from 'react';
import { ProjectReactorContext } from './context';
import type { YMapReactor } from './core';

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

export function useStudyField<T>(studyId: string, field: string): T | null {
  const reactor = useContext(ProjectReactorContext);
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

export function useStudyComputed<T>(
  studyId: string,
  key: string,
  compute: (fields: YMapReactor) => T,
): T | null {
  const reactor = useContext(ProjectReactorContext);
  return useValue(
    `sc:${studyId}:${key}`,
    () => {
      reactor.studies.ids.get();
      const study = reactor.studies.get(studyId);
      if (!study) return null;
      return compute(study.fields);
    },
    [reactor, studyId],
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

export function useChecklistField<T>(
  studyId: string,
  checklistId: string,
  field: string,
): T | null {
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
      return cl.fields.field<T>(field).get();
    },
    [reactor, studyId, checklistId, field],
  );
}
