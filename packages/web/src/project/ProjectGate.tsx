/**
 * ProjectGate - Declarative connection lifecycle for a project.
 *
 * Owns the connection lifecycle (acquire/release via ConnectionPool),
 * active project tracking, and access denied handling.
 * Renders fallback while connecting, children + ProjectProvider when synced.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useProjectStore, selectConnectionPhase } from '@/stores/projectStore';
import { useProjectOrgId } from '@/hooks/useProjectOrgId';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { ACCESS_DENIED_ERRORS } from '@/constants/errors';
import { showToast } from '@/lib/toast';
import { WifiOffIcon, RefreshCwIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { connectionPool } from './ConnectionPool';

import { ProjectProvider } from '@/components/project/ProjectContext';
import { ProjectReactorContext } from '@/primitives/useProject/reactor/context';

interface ProjectGateProps {
  projectId: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

// How long the connecting skeleton may show before we surface an explicit
// connection-trouble state instead of spinning forever.
const CONNECT_STALL_TIMEOUT_MS = 15_000;

function ConnectionTrouble({ message }: { message: string }) {
  return (
    <div className='flex flex-1 items-center justify-center p-8'>
      <div className='border-border bg-card w-full max-w-sm rounded-xl border p-6 text-center shadow-sm'>
        <div className='bg-destructive/10 mx-auto mb-4 flex size-12 items-center justify-center rounded-full'>
          <WifiOffIcon className='text-destructive size-6' />
        </div>
        <h3 className='text-foreground mb-1 text-base font-semibold'>Connection trouble</h3>
        <p className='text-muted-foreground mb-5 text-sm'>{message}</p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCwIcon className='size-3.5' />
          Retry
        </Button>
      </div>
    </div>
  );
}

export function ProjectGate({ projectId, fallback, children }: ProjectGateProps) {
  const navigate = useNavigate();
  const orgId = useProjectOrgId(projectId);
  const isLocalProject = projectId ? projectId.startsWith('local-') : false;
  const isOnline = useOnlineStatus();
  const connectionEntryRef = useRef<ReturnType<typeof connectionPool.acquire>>(null);

  const connectionState = useProjectStore(s => selectConnectionPhase(s, projectId));

  const isPending =
    connectionState.phase !== 'synced' &&
    connectionState.phase !== 'cached' &&
    !connectionState.error;

  // Fail loudly instead of showing the connecting skeleton forever. Members
  // have no usable local cache yet, so a reload while the sync server is
  // unreachable would otherwise never leave the fallback.
  const [stalled, setStalled] = useState(false);
  useEffect(() => {
    if (!isPending) {
      setStalled(false);
      return;
    }
    const timer = window.setTimeout(() => setStalled(true), CONNECT_STALL_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [isPending, projectId]);

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

  // Access denied redirect. Local-data cleanup happens here, after the error
  // has been observed -- cleanup resets the connection state, so running it
  // from the dispatch site erased the error before this effect could react.
  useEffect(() => {
    if (connectionState.error && ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      showToast.error('Access Denied', connectionState.error);
      navigate({ to: '/dashboard', replace: true });
      connectionPool.cleanupProjectLocalData(projectId);
    }
  }, [connectionState.error, navigate, projectId]);

  // Show fallback while connecting (cached = Dexie data available, render
  // immediately). If the connection never becomes usable, surface it -- the
  // provider keeps retrying underneath, so a recovered connection replaces
  // this with the project automatically.
  if (isPending) {
    if (stalled) {
      return (
        <ConnectionTrouble message='Loading is taking longer than expected. Check your connection and try again.' />
      );
    }
    return <>{fallback || null}</>;
  }

  if (connectionState.error) {
    // Access denied errors are handled by the redirect effect above.
    if (ACCESS_DENIED_ERRORS.includes(connectionState.error)) {
      return null;
    }
    return <ConnectionTrouble message={connectionState.error} />;
  }

  const reactor = connectionPool.getReactor(projectId);

  return (
    <ProjectReactorContext.Provider value={reactor}>
      <ProjectProvider projectId={projectId}>{children}</ProjectProvider>
    </ProjectReactorContext.Provider>
  );
}
