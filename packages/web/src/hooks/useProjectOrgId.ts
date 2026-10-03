/**
 * useProjectOrgId - Get orgId for a project, reactively: the D1 projects
 * query, with the Dexie-stamped value covering cold hard-refreshes.
 * Implementation lives with the other D1-fact hooks in project-data.
 */

export { useProjectOrgId } from '@/project/project-data';
