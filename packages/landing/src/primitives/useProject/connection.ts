/**
 * Connection management for Y.js WebSocket sync using y-websocket
 * Uses WebsocketProvider for built-in reconnection, sync protocol, and awareness
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { getWsBaseUrl } from '@/config/api';
import { useProjectStore } from '@/stores/projectStore';

type Awareness = WebsocketProvider['awareness'];

function throttle<T extends (...args: unknown[]) => void>(fn: T, ms: number): T {
  let lastCall = 0;
  return ((...args: unknown[]) => {
    const now = Date.now();
    if (now - lastCall >= ms) {
      lastCall = now;
      fn(...args);
    }
  }) as T;
}

/**
 * Close reason codes for WebSocket disconnection
 * These match the reasons sent by the backend ProjectDoc DO
 */
export const CLOSE_REASONS = {
  PROJECT_DELETED: 'project-deleted',
  MEMBERSHIP_REVOKED: 'membership-revoked',
  NOT_A_MEMBER: 'not-a-member',
} as const;

export interface ConnectionManagerOptions {
  onSync: () => void;
  isLocalProject: () => boolean;
  onAccessDenied: (info: { reason: string }) => Promise<void> | void;
}

export interface ConnectionManager {
  connect: () => void;
  disconnect: () => void;
  destroy: () => void;
  reconnect: () => void;
  getAwareness: () => Awareness | undefined;
  getProvider: () => WebsocketProvider | null;
  getShouldReconnect: () => boolean;
  setShouldReconnect: (value: boolean) => void;
}

export function createConnectionManager(
  projectId: string,
  ydoc: Y.Doc,
  options: ConnectionManagerOptions,
): ConnectionManager {
  const { onSync, isLocalProject, onAccessDenied } = options;

  let provider: WebsocketProvider | null = null;
  let consecutiveErrors = 0;
  const MAX_CONSECUTIVE_ERRORS = 5;

  const throttledErrorLog = throttle(() => {
    console.error('WebSocket connection error');
  }, 5000);

  let shouldBeConnected = false;

  function handleOnline(): void {
    if (shouldBeConnected && provider && !provider.wsconnected) {
      provider.connect();
    }
  }

  function handleOffline(): void {
    if (provider) {
      provider.shouldConnect = false;
    }
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  function connect(): void {
    if (!ydoc || isLocalProject()) return;

    if (!navigator.onLine) {
      shouldBeConnected = true;
      return;
    }

    shouldBeConnected = true;

    const wsUrl = `${getWsBaseUrl()}/api/project-doc`;

    provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
      connect: false,
    });

    // Wrap the awareness message handler with error protection.
    // Awareness data is ephemeral (cursor positions, presence) so a dropped
    // update is invisible to users and corrected by the next update.
    const AWARENESS_MSG_TYPE = 1;
    const originalAwarenessHandler = provider.messageHandlers[AWARENESS_MSG_TYPE];
    if (originalAwarenessHandler) {
      provider.messageHandlers = [...provider.messageHandlers];
      provider.messageHandlers[AWARENESS_MSG_TYPE] = (
        encoder,
        decoder,
        prov,
        emitSynced,
        msgType,
      ) => {
        try {
          return originalAwarenessHandler(encoder, decoder, prov, emitSynced, msgType);
        } catch (err) {
          console.warn('Awareness update skipped:', (err as Error).message);
        }
      };
    }

    provider.on('status', ({ status }: { status: string }) => {
      if (status === 'connected') {
        useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'REMOTE_CONNECTED' });
        consecutiveErrors = 0;
      } else if (status === 'connecting') {
        useProjectStore
          .getState()
          .dispatchConnectionEvent(projectId, { type: 'REMOTE_DISCONNECTED' });
      }
    });

    provider.on('sync', (isSynced: boolean) => {
      if (isSynced && onSync) onSync();
    });

    if (provider.synced && onSync) {
      onSync();
    }

    provider.connect();

    provider.on('connection-close', (event: CloseEvent | null, providerInstance: WebsocketProvider) => {
      if (!event) return;

      const reason = event.reason || '';

      if (reason === CLOSE_REASONS.PROJECT_DELETED) {
        useProjectStore.getState().dispatchConnectionEvent(projectId, {
          type: 'ACCESS_DENIED',
          reason: 'This project has been deleted',
        });
        providerInstance.shouldConnect = false;
        shouldBeConnected = false;
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.PROJECT_DELETED });
        }
        return;
      }

      if (reason === CLOSE_REASONS.MEMBERSHIP_REVOKED) {
        useProjectStore.getState().dispatchConnectionEvent(projectId, {
          type: 'ACCESS_DENIED',
          reason: 'You have been removed from this project',
        });
        providerInstance.shouldConnect = false;
        shouldBeConnected = false;
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.MEMBERSHIP_REVOKED });
        }
        return;
      }

      if (
        event.code === 1008 ||
        reason.includes('member') ||
        reason === CLOSE_REASONS.NOT_A_MEMBER
      ) {
        useProjectStore.getState().dispatchConnectionEvent(projectId, {
          type: 'ACCESS_DENIED',
          reason: 'You are not a member of this project',
        });
        providerInstance.shouldConnect = false;
        shouldBeConnected = false;
        if (onAccessDenied) {
          onAccessDenied({ reason: CLOSE_REASONS.NOT_A_MEMBER });
        }
        return;
      }

      if (!navigator.onLine) {
        providerInstance.shouldConnect = false;
      }
    });

    provider.on('connection-error', () => {
      if (!navigator.onLine) {
        return;
      }

      consecutiveErrors++;

      throttledErrorLog();

      if (consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        useProjectStore.getState().dispatchConnectionEvent(projectId, {
          type: 'ERROR_THRESHOLD_REACHED',
          message:
            'Unable to connect to project. It may have been deleted or you may not have access.',
        });
        if (provider) {
          provider.shouldConnect = false;
        }
        shouldBeConnected = false;
        if (onAccessDenied) {
          onAccessDenied({ reason: 'connection-failed' });
        }
        return;
      }

      useProjectStore
        .getState()
        .dispatchConnectionEvent(projectId, { type: 'REMOTE_DISCONNECTED' });
    });
  }

  function disconnect(): void {
    shouldBeConnected = false;
    if (provider) {
      provider.destroy();
      provider = null;
    }
    useProjectStore.getState().dispatchConnectionEvent(projectId, { type: 'RESET' });
  }

  function destroy(): void {
    disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }

  function reconnect(): void {
    if (!navigator.onLine) return;

    if (provider) {
      provider.disconnect();
      provider.connect();
    } else {
      connect();
    }
  }

  function getAwareness(): Awareness | undefined {
    return provider?.awareness;
  }

  function getProvider(): WebsocketProvider | null {
    return provider;
  }

  function getShouldReconnect(): boolean {
    return provider?.shouldConnect ?? false;
  }

  function setShouldReconnect(value: boolean): void {
    if (provider) {
      provider.shouldConnect = value;
    }
    shouldBeConnected = value;
  }

  return {
    connect,
    disconnect,
    destroy,
    reconnect,
    getAwareness,
    getProvider,
    getShouldReconnect,
    setShouldReconnect,
  };
}
