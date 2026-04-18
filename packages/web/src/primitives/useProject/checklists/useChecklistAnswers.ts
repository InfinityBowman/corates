/**
 * Subscription-based read of a checklist's answers from the project Y.Doc.
 *
 * Replaces the useMemo+Zustand indirection in ChecklistYjsWrapper. The hook
 * observes the project's `reviews` map and serializes the requested checklist's
 * answers on demand. The returned reference is stable between Y.Doc updates, so
 * consumers only re-render when answers actually change.
 */

import { useCallback, useRef, useSyncExternalStore } from 'react';
import * as Y from 'yjs';
import { connectionPool } from '@/project/ConnectionPool';
import { CHECKLIST_TYPES } from '@/checklist-registry';
import type { ChecklistHandler } from './handlers/base';
import { AMSTAR2Handler } from './handlers/amstar2';
import { ROBINSIHandler } from './handlers/robins-i';
import { ROB2Handler } from './handlers/rob2';

const handlers: Record<string, ChecklistHandler> = {
  [CHECKLIST_TYPES.AMSTAR2]: new AMSTAR2Handler(),
  [CHECKLIST_TYPES.ROBINS_I]: new ROBINSIHandler(),
  [CHECKLIST_TYPES.ROB2]: new ROB2Handler(),
};

interface ResolvedAnswers {
  answersYMap: Y.Map<unknown>;
  checklistType: string;
}

function resolveAnswers(
  ydoc: Y.Doc | null,
  studyId: string,
  checklistId: string,
): ResolvedAnswers | null {
  if (!ydoc) return null;
  const studiesMap = ydoc.getMap('reviews');
  const studyYMap = studiesMap.get(studyId) as Y.Map<unknown> | undefined;
  if (!studyYMap) return null;
  const checklistsMap = studyYMap.get('checklists') as Y.Map<unknown> | undefined;
  if (!checklistsMap) return null;
  const checklistYMap = checklistsMap.get(checklistId) as Y.Map<unknown> | undefined;
  if (!checklistYMap) return null;
  const answersYMap = checklistYMap.get('answers') as Y.Map<unknown> | undefined;
  if (!answersYMap) return null;
  const checklistType = (checklistYMap.get('type') as string) || 'AMSTAR2';
  return { answersYMap, checklistType };
}

function serialize(resolved: ResolvedAnswers): Record<string, unknown> {
  const handler = handlers[resolved.checklistType];
  if (handler) return handler.serializeAnswers(resolved.answersYMap);
  const fallback: Record<string, unknown> = {};
  for (const [key, section] of resolved.answersYMap.entries()) {
    const s = section as { toJSON?: () => unknown };
    fallback[key] = s.toJSON ? s.toJSON() : section;
  }
  return fallback;
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
      // observeDeep on `reviews` catches both "checklist arrives via sync"
      // and "answers inside this checklist change". Serialization happens in
      // getSnapshot, so unrelated writes only bump a counter here.
      const reviewsMap = ydoc.getMap('reviews');
      const observer = () => {
        versionRef.current += 1;
        onStoreChange();
      };
      reviewsMap.observeDeep(observer);
      return () => reviewsMap.unobserveDeep(observer);
    },
    [ydoc],
  );

  const getSnapshot = useCallback((): Record<string, unknown> | null => {
    const cached = cacheRef.current;
    if (
      cached.version === versionRef.current &&
      cached.studyId === studyId &&
      cached.checklistId === checklistId
    ) {
      return cached.value;
    }

    const resolved = resolveAnswers(ydoc, studyId, checklistId);
    const value = resolved ? serialize(resolved) : null;
    cacheRef.current = { version: versionRef.current, studyId, checklistId, value };
    return value;
  }, [ydoc, studyId, checklistId]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
