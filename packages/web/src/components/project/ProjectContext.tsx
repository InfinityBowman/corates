/**
 * ProjectContext - Provides project identity, user role, and Y.js operations to child components
 *
 * For actions (mutations), import { project } from '@/project'.
 */

import { createContext, useContext, useMemo, useCallback } from 'react';
import { useProjectStore, selectMembers } from '@/stores/projectStore';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';

export interface ProjectMember {
  userId: string;
  memberId?: string;
  name?: string;
  email?: string;
  role?: string;
  image?: string | null;
}

interface ProjectContextValue {
  projectId: string;
  orgId: string | null;
  userRole: string | null;
  isOwner: boolean;
  getAssigneeName: (userId: string | null) => string;
  getMember: (userId: string | null) => ProjectMember | null;
  getChecklistPath: (studyId: string, checklistId: string, tab?: string) => string;
  getReconcilePath: (studyId: string, checklist1Id: string, checklist2Id: string) => string;
}

const ProjectCtx = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  const user = useAuthStore(selectUser);
  const orgId = useProjectOrgId(projectId);
  const members = useProjectStore(s => selectMembers(s, projectId)) as ProjectMember[];

  const userRole = useMemo(() => {
    if (!user) return null;
    const member = members.find(m => m.userId === user.id);
    return member?.role || null;
  }, [user, members]);

  const isOwner = userRole === 'owner';

  // Stable path helpers that only depend on projectId
  const getChecklistPath = useCallback(
    (studyId: string, checklistId: string, tab = 'overview') =>
      `/projects/${projectId}/studies/${studyId}/checklists/${checklistId}?tab=${tab}`,
    [projectId],
  );
  const getReconcilePath = useCallback(
    (studyId: string, checklist1Id: string, checklist2Id: string) =>
      `/projects/${projectId}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`,
    [projectId],
  );

  // Member-dependent helpers
  const getAssigneeName = useCallback(
    (userId: string | null) => {
      if (!userId) return 'Unassigned';
      const member = members.find(m => m.userId === userId);
      return member?.name || member?.email || 'Unknown';
    },
    [members],
  );
  const getMember = useCallback(
    (userId: string | null): ProjectMember | null => {
      if (!userId) return null;
      return members.find(m => m.userId === userId) || null;
    },
    [members],
  );

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectId,
      orgId,
      userRole,
      isOwner,
      getAssigneeName,
      getMember,
      getChecklistPath,
      getReconcilePath,
    }),
    [
      projectId,
      orgId,
      userRole,
      isOwner,
      getAssigneeName,
      getMember,
      getChecklistPath,
      getReconcilePath,
    ],
  );

  return <ProjectCtx.Provider value={value}>{children}</ProjectCtx.Provider>;
}

export function useProjectContext() {
  const context = useContext(ProjectCtx);
  if (!context) {
    throw new Error('useProjectContext must be used within ProjectProvider');
  }
  return context;
}
