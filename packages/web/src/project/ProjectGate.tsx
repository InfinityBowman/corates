/**
 * ProjectGate - Declarative session lifecycle for a project.
 *
 * Owns the session lifecycle (acquire/release via ConnectionPool), active
 * project tracking, and access denied handling. Renders fallback until the
 * engine reports the project renderable — `synced` (socket caught up) or
 * `cached` (locally persisted rows hydrated; offline-first paint) — then
 * children + ProjectProvider. Reconnection, backoff, and online/visibility
 * wake-ups are the sync client's job now; there is nothing to drive here.
 */

import { useEffect, useLayoutEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors';
import { showToast } from '@/lib/toast';
import { connectionPool } from './ConnectionPool';

import { ProjectProvider } from '@/components/project/ProjectContext';
import { ProjectReactorContext } from '@/primitives/useProject/reactor/context';

interface ProjectGateProps {
  projectId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProjectGate({ projectId, fallback, children }: ProjectGateProps) {
  const navigate = useNavigate();
  const orgId = useProjectOrgId(projectId);
  const isLocalProject = projectId ? projectId.startsWith('local-') : false;

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  // Session lifecycle -- acquire on mount, release on unmount
  useLayoutEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const entry = connectionPool.acquire(projectId);

    if (entry && !entry.initialized) {
      connectionPool.initializeConnection(projectId, entry, {
        isLocal: isLocalProject,
        cancelled: () => cancelled,
      });
    }

    return () => {
      cancelled = true;
      connectionPool.release(projectId);
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Set active project for the pool (used by project.* action modules)
  useEffect(() => {
    if (projectId && orgId) {
      connectionPool.setActiveProject(projectId, orgId);
    }
    return () => {
      connectionPool.clearActiveProject();
    };
  }, [projectId, orgId]);

  // Access denied redirect
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
    }
  }, [connectionState.error, navigate]);

  // Show fallback while connecting (cached = hydrated local rows, render immediately)
  if (
    connectionState.phase !== 'synced' &&
    connectionState.phase !== 'cached' &&
    !connectionState.error
  ) {
    return <>{fallback || null}</>;
  }

  // Error state handled by redirect above
  if (connectionState.error) {
    return null;
  }

  const reactor = connectionPool.getReactor(projectId);

  return (
    <ProjectReactorContext.Provider value={reactor}>
      <ProjectProvider projectId={projectId}>{children}</ProjectProvider>
    </ProjectReactorContext.Provider>
  );
}
