/**
 * useProjectData - Lightweight hook for reading project data
 *
 * Use this hook when you only need to READ project data (studies, members, meta).
 * For write operations (createStudy, updateChecklist, etc.), use useProject instead.
 */

import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import {
  useAllStudies,
  useProjectMembers,
  useProjectMeta,
  EMPTY_PROJECT_META,
} from '@/project/workspace-data';

const EMPTY_STUDIES: never[] = [];
const EMPTY_MEMBERS: never[] = [];
const IDLE_STATE = {
  studies: EMPTY_STUDIES,
  members: EMPTY_MEMBERS,
  meta: EMPTY_PROJECT_META,
  connected: false,
  connecting: false,
  synced: false,
  error: null as string | null,
  hasData: false,
};

export function useProjectData(projectId: string | undefined) {
  const studies = useAllStudies(projectId || '');
  const members = useProjectMembers(projectId || '');
  const meta = useProjectMeta(projectId || '');
  const connectionState = useProjectStore(state =>
    projectId ? selectConnectionPhase(state, projectId) : null,
  );

  if (!projectId) return IDLE_STATE;

  const phase = connectionState?.phase ?? 'idle';

  return {
    studies,
    members,
    meta,
    connected: phase === 'synced',
    connecting: phase === 'connecting',
    synced: phase === 'synced',
    error: connectionState?.error ?? null,
    hasData: phase !== 'idle',
  };
}
