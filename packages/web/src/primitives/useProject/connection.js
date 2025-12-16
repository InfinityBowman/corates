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

  function connect() {
    if (!ydoc || isLocalProject()) return;

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
      }
    });

    provider.on('connection-error', event => {
      // Throttle error logs to prevent console spam on Safari
      const now = Date.now();
      if (now - lastErrorLog > ERROR_LOG_THROTTLE) {
        console.error('WebSocket connection error:', event);
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
    if (provider) {
      provider.destroy();
      provider = null;
    }
    projectStore.setConnectionState(projectId, {
      connected: false,
      connecting: false,
    });
  }

  function reconnect() {
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
  }

  return {
    connect,
    disconnect,
    reconnect,
    getAwareness,
    getProvider,
    getShouldReconnect,
    setShouldReconnect,
  };
}
