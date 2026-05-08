/**
 * useProjectData - Lightweight hook for reading project data from atoms
 *
 * Use this hook when you only need to READ project data (studies, members, meta).
 * For write operations (createStudy, updateChecklist, etc.), use useProject instead.
 */

import { useProjectStore, selectConnectionPhase, type ProjectMeta } from '@/stores/projectStore';
import {
  useAllStudiesById,
  useProjectMembersById,
  useProjectMetaById,
} from '@/primitives/useProject/reactor';

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
  const studies = useAllStudiesById(projectId || '');
  const members = useProjectMembersById(projectId || '');
  const meta = useProjectMetaById(projectId || '');
  const connectionState = useProjectStore(state =>
    projectId ? selectConnectionPhase(state, projectId) : null,
  );

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
    hasData: phase !== 'idle',
  };
}
