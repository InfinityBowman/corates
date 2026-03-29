/**
 * ProjectGate - Declarative connection lifecycle for a project.
 *
 * Owns the connection lifecycle (acquire/release via ConnectionPool),
 * active project tracking, and access denied handling.
 * Renders fallback while connecting, children + ProjectProvider when synced.
 */

import { useEffect, useLayoutEffect, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors';
import { showToast } from '@/components/ui/toast';
import { connectionPool } from './ConnectionPool';

import { ProjectProvider } from '@/components/project/ProjectContext';

interface ProjectGateProps {
  projectId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function ProjectGate({ projectId, fallback, children }: ProjectGateProps) {
  const navigate = useNavigate();
  const orgId = useProjectOrgId(projectId);
  const isLocalProject = projectId ? projectId.startsWith('local-') : false;
  const isOnline = useOnlineStatus();
  const connectionEntryRef = useRef<any>(null);

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  // Connection lifecycle -- acquire on mount, release on unmount
  useLayoutEffect(() => {
    if (!projectId) return;
    let cancelled = false;

    const entry = connectionPool.acquire(projectId);
    connectionEntryRef.current = entry;

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

  // Reconnect on online transition
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    const wasOffline = !wasOnlineRef.current;
    wasOnlineRef.current = isOnline;
    if (isOnline && wasOffline) {
      connectionPool.reconnectIfNeeded(projectId);
    }
  }, [isOnline, projectId]);

  // Access denied redirect
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
    }
  }, [connectionState.error, navigate]);

  // Show fallback while connecting
  if (connectionState.phase !== 'synced' && !connectionState.error) {
    return <>{fallback || null}</>;
  }

  // Error state handled by redirect above
  if (connectionState.error) {
    return null;
  }

  return <ProjectProvider projectId={projectId}>{children}</ProjectProvider>;
}
