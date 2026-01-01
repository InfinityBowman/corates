/**
 * ProjectContext - Provides project identity and user role to child components
 *
 * This context provides:
 * - projectId: The current project ID
 * - orgId: The organization ID (from project data)
 * - userRole: The current user's role in the project
 * - isOwner: Whether the current user is the project owner
 * - getAssigneeName: Helper to get a member's display name
 * - getChecklistPath: Helper to build project-scoped checklist path
 * - getReconcilePath: Helper to build project-scoped reconciliation path
 *
 * For actions (mutations), import projectActionsStore directly:
 *   import projectActionsStore from '@/stores/projectActionsStore.js';
 */

import { createContext, useContext, createMemo } from 'solid-js';
import projectStore from '@/stores/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';
import { useProjectOrgId } from '@primitives/useProjectOrgId.js';

const ProjectContext = createContext();

export function ProjectProvider(props) {
  const { user } = useBetterAuth();
  const orgId = useProjectOrgId(props.projectId);

  // Derive commonly used values
  const members = () => projectStore.getMembers(props.projectId);

  const userRole = createMemo(() => {
    const currentUser = user();
    if (!currentUser) return null;
    const member = members().find(m => m.userId === currentUser.id);
    return member?.role || null;
  });

  const isOwner = () => userRole() === 'owner';

  const getAssigneeName = userId => {
    if (!userId) return 'Unassigned';
    const member = members().find(m => m.userId === userId);
    return member?.displayName || member?.name || member?.email || 'Unknown';
  };

  // Path builders for project-scoped routes
  const getChecklistPath = (studyId, checklistId, tab = 'overview') => {
    return `/projects/${props.projectId}/studies/${studyId}/checklists/${checklistId}?tab=${tab}`;
  };

  const getReconcilePath = (studyId, checklist1Id, checklist2Id) => {
    return `/projects/${props.projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`;
  };

  const value = {
    get projectId() {
      return props.projectId;
    },
    orgId,
    userRole,
    isOwner,
    getAssigneeName,
    getChecklistPath,
    getReconcilePath,
  };

  return <ProjectContext.Provider value={value}>{props.children}</ProjectContext.Provider>;
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
}
