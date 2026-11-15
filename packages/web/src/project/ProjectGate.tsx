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
import { RECOVERABLE_FATAL_ERRORS } from '@/constants/errors';
import { showToast } from '@/lib/toast';
import { connectionPool } from './ConnectionPool';
import { projectUnavailableCopy } from './fatalReasons';
import { SyncedProjectContext } from './project-data';

import { ProjectProvider } from '@/components/project/ProjectContext';
import { ProjectUnavailable } from '@/components/project/ProjectUnavailable';

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

  // Set active project for the pool (used by project.* action modules).
  // Not gated on orgId: the mutation actions only need the projectId, and on
  // a cold hard-refresh the gate opens at `cached` before the projects query
  // resolves — waiting for orgId here made every action throw in that window.
  // orgId is re-stamped by the same effect when it lands.
  useEffect(() => {
    if (projectId) {
      connectionPool.setActiveProject(projectId, orgId ?? null);
    }
    return () => {
      connectionPool.clearActiveProject();
    };
  }, [projectId, orgId]);

  // A connection fault sends the user back to the dashboard (an expired
  // session bounces on from there to sign-in). Losing the project itself is
  // shown in place instead, so a bookmark or restored tab explains why it
  // will not open rather than flashing a toast and leaving.
  useEffect(() => {
    const error = connectionState.error;
    if (!error) return;
    if (RECOVERABLE_FATAL_ERRORS.includes(error)) {
      showToast.info('Disconnected', error);
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

  if (connectionState.error) {
    const unavailable = projectUnavailableCopy(connectionState.error);
    return unavailable ? <ProjectUnavailable {...unavailable} /> : null;
  }

  return (
    <SyncedProjectContext.Provider value={projectId}>
      <ProjectProvider projectId={projectId}>{children}</ProjectProvider>
    </SyncedProjectContext.Provider>
  );
}
