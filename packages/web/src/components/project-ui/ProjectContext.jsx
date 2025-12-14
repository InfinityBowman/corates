/**
 * ProjectContext - Provides project data and handlers to child components
 * Eliminates prop drilling for projectId, handlers, and utilities
 */

import { createContext, useContext, createMemo } from 'solid-js';
import projectStore from '@/stores/projectStore.js';
import { useBetterAuth } from '@api/better-auth-store.js';

const ProjectContext = createContext();

export function ProjectProvider(props) {
  const { user } = useBetterAuth();

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

  const value = {
    get projectId() {
      return props.projectId;
    },
    get handlers() {
      return props.handlers;
    },
    get projectActions() {
      return props.projectActions;
    },
    userRole,
    isOwner,
    getAssigneeName,
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
