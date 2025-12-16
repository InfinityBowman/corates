/**
 * Connection management for Y.js WebSocket sync using y-websocket
 * Uses WebsocketProvider for built-in reconnection, sync protocol, and awareness
 */

import { WebsocketProvider } from 'y-websocket';
import { getWsBaseUrl } from '@config/api.js';
import projectStore from '@/stores/projectStore.js';

/**
 * Creates a connection manager for WebSocket sync
 * @param {string} projectId - The project ID
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {Object} options - Configuration options
 * @param {Function} options.onSync - Called when sync completes
 * @param {Function} options.isLocalProject - Returns if this is a local-only project
 * @returns {Object} Connection manager API
 */
export function createConnectionManager(projectId, ydoc, options) {
  const { onSync, isLocalProject } = options;

  let provider = null;
  let lastErrorLog = 0;
  const ERROR_LOG_THROTTLE = 5000; // Only log errors every 5 seconds

  // Track if we intend to be connected (for online/offline handling)
  let shouldBeConnected = false;

  // Handle online/offline events
  function handleOnline() {
    // When coming back online, reconnect if we should be connected
    if (shouldBeConnected && provider && !provider.wsconnected) {
      provider.connect();
    }
  }

  function handleOffline() {
    // Pause reconnection attempts when offline
    if (provider) {
      provider.shouldConnect = false;
    }
  }

  // Set up listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  function connect() {
    if (!ydoc || isLocalProject()) return;

    // Don't attempt connection when offline
    if (!navigator.onLine) {
      shouldBeConnected = true; // Remember we want to be connected when online
      return;
    }

    shouldBeConnected = true;

    const wsUrl = `${getWsBaseUrl()}/api/project`;

    provider = new WebsocketProvider(wsUrl, projectId, ydoc, {
      connect: true,
      // WebsocketProvider handles reconnection automatically with exponential backoff
    });

    provider.on('status', ({ status }) => {
      projectStore.setConnectionState(projectId, {
        connected: status === 'connected',
        connecting: status === 'connecting',
      });
    });

    provider.on('sync', isSynced => {
      if (isSynced && onSync) onSync();
    });

    provider.on('connection-close', (event, provider) => {
      // event can be null when disconnect() is called programmatically
      if (!event) return;

      // Handle membership rejection (1008 = Policy Violation)
      if (event.code === 1008 || event.reason?.includes('member')) {
        projectStore.setConnectionState(projectId, {
          error: 'You are not a member of this project',
          connected: false,
          connecting: false,
        });
        // Prevent auto-reconnect for membership issues
        provider.shouldConnect = false;
        shouldBeConnected = false;
      }

      // When offline, don't let the provider try to reconnect
      if (!navigator.onLine) {
        provider.shouldConnect = false;
      }
    });

    provider.on('connection-error', () => {
      // Suppress error logging when offline to prevent console spam
      if (!navigator.onLine) {
        return;
      }

      // Throttle error logs to prevent console spam
      const now = Date.now();
      if (now - lastErrorLog > ERROR_LOG_THROTTLE) {
        console.error('WebSocket connection error');
        lastErrorLog = now;
      }
      projectStore.setConnectionState(projectId, {
        error: 'Connection error',
        connected: false,
        connecting: false,
      });
    });
  }

  function disconnect() {
    shouldBeConnected = false;
    if (provider) {
      provider.destroy();
      provider = null;
    }
    projectStore.setConnectionState(projectId, {
      connected: false,
      connecting: false,
    });
  }

  function destroy() {
    disconnect();
    // Clean up event listeners
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  }

  function reconnect() {
    if (!navigator.onLine) return; // Don't reconnect when offline

    if (provider) {
      provider.disconnect();
      provider.connect();
    } else {
      connect();
    }
  }

  function getAwareness() {
    return provider?.awareness;
  }

  function getProvider() {
    return provider;
  }

  // For compatibility with existing code
  function getShouldReconnect() {
    return provider?.shouldConnect ?? false;
  }

  function setShouldReconnect(value) {
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
