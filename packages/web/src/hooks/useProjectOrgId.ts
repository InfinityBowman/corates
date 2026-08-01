/**
 * useProjectOrgId - Get orgId for a project, reactively, from the D1 projects list.
 */

import { useProjectMeta } from '@/project/workspace-data';

export function useProjectOrgId(projectId: string | null | undefined): string | null {
  const { orgId } = useProjectMeta(projectId || '');
  return projectId ? orgId : null;
}
