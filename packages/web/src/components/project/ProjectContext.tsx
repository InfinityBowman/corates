/**
 * ProjectContext - Provides project identity, user role, and Y.js operations to child components
 *
 * For actions (mutations), import { project } from '@/project'.
 */

import { createContext, useContext, useMemo, useCallback, useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useAuthStore, selectUser } from '@/stores/authStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useProjectMembers } from '@/project/project-data';

export interface ProjectMember {
  userId: string;
  memberId?: string;
  name?: string;
  email?: string;
  role?: string;
  image?: string | null;
}

export interface AssignSheetScope {
  studyIds: string[];
  /** Heading over the study list, e.g. "3 new studies". */
  label: string;
}

interface ProjectContextValue {
  projectId: string;
  orgId: string | null;
  userRole: string | null;
  isOwner: boolean;
  getAssigneeName: (userId: string | null) => string;
  getMember: (userId: string | null) => ProjectMember | null;
  /** /<workspace>/projects/<id>, the base every in-project link builds on. */
  projectPath: string;
  getChecklistPath: (studyId: string, checklistId: string, tab?: string) => string;
  getReconcilePath: (studyId: string, checklist1Id: string, checklist2Id: string) => string;
  addStudiesSheetOpen: boolean;
  setAddStudiesSheetOpen: (open: boolean) => void;
  assignSheetOpen: boolean;
  setAssignSheetOpen: (open: boolean) => void;
  /** null means every study, unassigned first. */
  assignSheetScope: AssignSheetScope | null;
  openAssignSheet: (scope?: AssignSheetScope) => void;
  outcomesSheetOpen: boolean;
  setOutcomesSheetOpen: (open: boolean) => void;
  /** The study whose sheet is open, or null when closed. */
  studySheetId: string | null;
  openStudySheet: (studyId: string) => void;
  closeStudySheet: () => void;
}

const ProjectCtx = createContext<ProjectContextValue | null>(null);

interface ProjectProviderProps {
  projectId: string;
  children: React.ReactNode;
}

export function ProjectProvider({ projectId, children }: ProjectProviderProps) {
  const user = useAuthStore(selectUser);
  const orgId = useProjectOrgId(projectId);
  const members = useProjectMembers(projectId) as ProjectMember[];

  const userRole = useMemo(() => {
    if (!user) return null;
    const member = members.find(m => m.userId === user.id);
    return member?.role || null;
  }, [user, members]);

  const isOwner = userRole === 'owner';
  const [addStudiesSheetOpen, setAddStudiesSheetOpen] = useState(false);
  const [assignSheetOpen, setAssignSheetOpen] = useState(false);
  const [assignSheetScope, setAssignSheetScope] = useState<AssignSheetScope | null>(null);
  const openAssignSheet = useCallback((scope?: AssignSheetScope) => {
    setAssignSheetScope(scope ?? null);
    setAssignSheetOpen(true);
  }, []);
  const [outcomesSheetOpen, setOutcomesSheetOpen] = useState(false);
  const [studySheetId, setStudySheetId] = useState<string | null>(null);
  const closeStudySheet = useCallback(() => setStudySheetId(null), []);

  // The project route keeps the URL slug equal to the project's workspace.
  const { workspace: slug } = useParams({ strict: false }) as { workspace?: string };
  const projectPath = `/${slug}/projects/${projectId}`;
  const getChecklistPath = useCallback(
    (studyId: string, checklistId: string, tab = 'overview') =>
      `${projectPath}/studies/${studyId}/checklists/${checklistId}?tab=${tab}`,
    [projectPath],
  );
  const getReconcilePath = useCallback(
    (studyId: string, checklist1Id: string, checklist2Id: string) =>
      `${projectPath}/studies/${studyId}/reconcile/${checklist1Id}/${checklist2Id}`,
    [projectPath],
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
      projectPath,
      getChecklistPath,
      getReconcilePath,
      addStudiesSheetOpen,
      setAddStudiesSheetOpen,
      assignSheetOpen,
      setAssignSheetOpen,
      assignSheetScope,
      openAssignSheet,
      outcomesSheetOpen,
      setOutcomesSheetOpen,
      studySheetId,
      openStudySheet: setStudySheetId,
      closeStudySheet,
    }),
    [
      projectId,
      orgId,
      userRole,
      isOwner,
      getAssigneeName,
      getMember,
      projectPath,
      getChecklistPath,
      getReconcilePath,
      addStudiesSheetOpen,
      assignSheetOpen,
      assignSheetScope,
      openAssignSheet,
      outcomesSheetOpen,
      studySheetId,
      closeStudySheet,
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
