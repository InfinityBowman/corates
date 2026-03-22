/**
 * ProjectGate - Declarative connection lifecycle for a project.
 *
 * Renders fallback while connecting, error UI on access denied,
 * and children + ProjectProvider when synced.
 */

import { useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProject } from '@/primitives/useProject';
import { useProjectStore, selectConnectionState } from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
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
  const projectConnection = useProject(projectId);
  const connectionState = useProjectStore(s => selectConnectionState(s, projectId));

  // Set active project for the action store
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

  // Show fallback while connecting
  if (!connectionState.synced && !connectionState.error) {
    return <>{fallback || null}</>;
  }

  // Error state is handled by the redirect above; render nothing while redirecting
  if (connectionState.error) {
    return null;
  }

  return (
    <ProjectProvider
      projectId={projectId}
      projectOps={projectConnection as Record<string, unknown>}
    >
      {children}
    </ProjectProvider>
  );
}
