/**
 * useProjectOrgId - Get orgId for a project, reactively: the D1 projects
 * query, with the Dexie-stamped value covering cold hard-refreshes.
 * Implementation lives with the other D1-fact hooks in workspace-data.
 */

export { useProjectOrgId } from '@/project/workspace-data';
