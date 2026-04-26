/**
 * useProjectData - Lightweight hook for reading project data from Zustand store
 *
 * Use this hook when you only need to READ project data (studies, members, meta).
 * For write operations (createStudy, updateChecklist, etc.), use useProject instead.
 *
 * Note: This hook reads from the Zustand store. Data is populated by useProject
 * when it's mounted (typically in the projects.$projectId layout route).
 */

import {
  useProjectStore,
  selectConnectionPhase,
  selectStudies,
  selectMembers,
  selectMeta,
  type ProjectMeta,
} from '@/stores/projectStore';

const EMPTY_STUDIES: never[] = [];
const EMPTY_MEMBERS: never[] = [];
const EMPTY_META: ProjectMeta = { outcomes: [] };
const IDLE_STATE = {
  studies: EMPTY_STUDIES,
  members: EMPTY_MEMBERS,
  meta: EMPTY_META,
  connected: false,
  connecting: false,
  synced: false,
  error: null as string | null,
  hasData: false,
};

export function useProjectData(projectId: string | undefined) {
  const studies = useProjectStore(state =>
    projectId ? selectStudies(state, projectId) : EMPTY_STUDIES,
  );
  const members = useProjectStore(state =>
    projectId ? selectMembers(state, projectId) : EMPTY_MEMBERS,
  );
  const meta = useProjectStore(state => (projectId ? selectMeta(state, projectId) : EMPTY_META));
  const connectionState = useProjectStore(state =>
    projectId ? selectConnectionPhase(state, projectId) : null,
  );
  const hasData = useProjectStore(state => (projectId ? !!state.projects[projectId] : false));

  if (!projectId) return IDLE_STATE;

  const phase = connectionState?.phase ?? 'idle';

  return {
    studies,
    members,
    meta,
    connected: phase === 'connected' || phase === 'synced',
    connecting: phase === 'connecting',
    synced: phase === 'synced',
    error: connectionState?.error ?? null,
    hasData,
  };
}
