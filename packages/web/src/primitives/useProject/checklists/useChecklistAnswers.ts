/**
 * Subscription-based read of a checklist's answers from the project Y.Doc.
 *
 * Observes the narrowest possible Yjs target: the checklist's answers Y.Map
 * when it exists, or the checklist Y.Map (shallow) while waiting for answers
 * to be created. This prevents unrelated Yjs mutations (annotations, other
 * studies, PDF metadata) from triggering re-serialization.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { connectionPool } from '@/project/ConnectionPool';
import { countProbe } from '../sync-perf';
import { getHandler } from './handlers/registry';

interface ResolvedAnswers {
  answersYMap: Y.Map<unknown>;
  checklistType: string;
}

function resolveChecklistYMap(
  ydoc: Y.Doc | null,
  studyId: string,
  checklistId: string,
): Y.Map<unknown> | null {
  if (!ydoc) return null;
  const studiesMap = ydoc.getMap('reviews');
  const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
  if (!studyYMap) return null;
  const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
  if (!checklistsMap) return null;
  return (checklistsMap.get(checklistId) as Y.Map<unknown>) ?? null;
}

function resolveAnswers(
  ydoc: Y.Doc | null,
  studyId: string,
  checklistId: string,
): ResolvedAnswers | null {
  const checklistYMap = resolveChecklistYMap(ydoc, studyId, checklistId);
  if (!checklistYMap) return null;
  const answersYMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
  if (!answersYMap) return null;
  const checklistType = (checklistYMap.get('type') as string) || 'AMSTAR2';
  return { answersYMap, checklistType };
}

function stabilizeRefs(
  fresh: Record<string, unknown>,
  prev: Record<string, unknown> | null,
): Record<string, unknown> {
  if (!prev) return fresh;
  for (const key of Object.keys(fresh)) {
    if (key in prev && JSON.stringify(fresh[key]) === JSON.stringify(prev[key])) {
      fresh[key] = prev[key];
    }
  }
  return fresh;
}

export function useChecklistAnswers(
  projectId: string,
  studyId: string,
  checklistId: string,
): Record<string, unknown> | null {
  const ydoc = connectionPool.getEntry(projectId)?.ydoc ?? null;

  const versionRef = useRef(0);
  const cacheRef = useRef<{
    version: number;
    studyId: string | null;
    checklistId: string | null;
    value: Record<string, unknown> | null;
  }>({ version: -1, studyId: null, checklistId: null, value: null });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      if (!ydoc) return () => {};

      const observer = () => {
        versionRef.current += 1;
        onStoreChange();
      };

      const resolved = resolveAnswers(ydoc, studyId, checklistId);
      if (resolved) {
        resolved.answersYMap.observeDeep(observer);
        return () => resolved.answersYMap.unobserveDeep(observer);
      }

      const checklistYMap = resolveChecklistYMap(ydoc, studyId, checklistId);
      if (checklistYMap) {
        checklistYMap.observe(observer);
        return () => checklistYMap.unobserve(observer);
      }

      // Data not available yet (e.g. DexieYProvider still loading).
      // Watch the reviews map so we detect when the checklist arrives.
      const reviewsMap = ydoc.getMap('reviews');
      reviewsMap.observeDeep(observer);
      return () => reviewsMap.unobserveDeep(observer);
    },
    [ydoc, studyId, checklistId],
  );

  const getSnapshot = useCallback((): Record<string, unknown> | null => {
    const cached = cacheRef.current;
    if (
      cached.version === versionRef.current &&
      cached.studyId === studyId &&
      cached.checklistId === checklistId
    ) {
      countProbe('serializeCacheHit');
      return cached.value;
    }

    countProbe('serialize');
    const resolved = resolveAnswers(ydoc, studyId, checklistId);
    if (!resolved) {
      cacheRef.current = { version: versionRef.current, studyId, checklistId, value: null };
      return null;
    }

    const handler = getHandler(resolved.checklistType);
    const fresh = handler
      ? handler.serializeAnswers(resolved.answersYMap)
      : fallbackSerialize(resolved.answersYMap);

    const value = stabilizeRefs(fresh, cached.value);
    cacheRef.current = { version: versionRef.current, studyId, checklistId, value };
    return value;
  }, [ydoc, studyId, checklistId]);

  return useSyncExternalStore(subscribe, getSnapshot);
}

function fallbackSerialize(answersMap: Y.Map<unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, section] of answersMap.entries()) {
    const s = section as { toJSON?: () => unknown };
    result[key] = s.toJSON ? s.toJSON() : section;
  }
  return result;
}
