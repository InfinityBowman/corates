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
  selectConnectionState,
  selectStudies,
  selectMembers,
  selectMeta,
} from '@/stores/projectStore';

export function useProjectData(projectId: string) {
  const studies = useProjectStore(state => selectStudies(state, projectId));
  const members = useProjectStore(state => selectMembers(state, projectId));
  const meta = useProjectStore(state => selectMeta(state, projectId));
  const connectionState = useProjectStore(state => selectConnectionState(state, projectId));
  const hasData = useProjectStore(state => !!state.projects[projectId]);

  return {
    studies,
    members,
    meta,
    connected: connectionState.connected,
    connecting: connectionState.connecting,
    synced: connectionState.synced,
    error: connectionState.error,
    hasData,
  };
}
