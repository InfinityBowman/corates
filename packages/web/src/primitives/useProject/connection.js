/**
 * Connection management for Y.js WebSocket sync
 * Handles WebSocket setup, reconnection with exponential backoff, and online/offline handling
 */

import * as Y from 'yjs';
import { getWsBaseUrl } from '@config/api.js';
import projectStore from '../projectStore.js';

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000; // Start with 1 second

/**
 * Creates a connection manager for WebSocket sync
 * @param {string} projectId - The project ID
 * @param {Y.Doc} ydoc - The Y.js document
 * @param {Object} options - Configuration options
 * @param {Function} options.onSync - Called when sync message received
 * @param {Function} options.isOnline - Returns current online status
 * @param {Function} options.isLocalProject - Returns if this is a local-only project
 * @returns {Object} Connection manager API
 */
export function createConnectionManager(projectId, ydoc, options) {
  const { onSync, isOnline, isLocalProject } = options;

  let ws = null;
  let reconnectTimeout = null;
  let reconnectAttempts = 0;
  let shouldReconnect = false;

  function getReconnectDelay() {
    return Math.min(BASE_RECONNECT_DELAY * Math.pow(2, reconnectAttempts), 30000);
  }

  function clearReconnectTimeout() {
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  function setupWebSocket() {
    if (!ydoc || isLocalProject()) return;

    const wsUrl = `${getWsBaseUrl()}/api/project/${projectId}`;
    ws = new WebSocket(wsUrl);
    projectStore.setConnectionState(projectId, { connecting: true });

    ws.onopen = () => {
      projectStore.setConnectionState(projectId, { connecting: false, connected: true });
      reconnectAttempts = 0;

      // Send local state to server after connection
      if (ydoc) {
        const localState = Y.encodeStateAsUpdate(ydoc);
        if (localState.length > 0) {
          ws.send(JSON.stringify({ type: 'update', update: Array.from(localState) }));
        }
      }
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        if (data.type === 'sync' || data.type === 'update') {
          const update = new Uint8Array(data.update);
          Y.applyUpdate(ydoc, update, 'remote');
          if (onSync) onSync();
        } else if (data.type === 'error') {
          projectStore.setConnectionState(projectId, { error: data.message });
        }
      } catch (err) {
        console.error('Error parsing WebSocket message:', err);
      }
    };

    ws.onclose = event => {
      projectStore.setConnectionState(projectId, { connected: false, connecting: false });

      // If we got a 403 (not a member), don't reconnect
      if (event.code === 1008 || event.reason?.includes('member')) {
        projectStore.setConnectionState(projectId, {
          error: 'You are not a member of this project',
        });
        shouldReconnect = false;
        return;
      }

      const isCleanClose = event.code === 1000;
      if (isCleanClose || reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
          projectStore.setConnectionState(projectId, {
            error: 'Maximum reconnection attempts reached. Please refresh the page.',
          });
        }
        shouldReconnect = false;
        return;
      }

      shouldReconnect = true;

      if (!isOnline()) {
        console.log('WebSocket closed while offline. Will reconnect when online.');
        projectStore.setConnectionState(projectId, {
          error: 'Offline - will reconnect when online',
        });
        return;
      }

      reconnectAttempts++;
      const delay = getReconnectDelay();
      console.log(
        `WebSocket closed. Reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`,
      );

      reconnectTimeout = setTimeout(() => {
        cleanupWebSocket();
        setupWebSocket();
      }, delay);
    };

    ws.onerror = err => {
      console.error('WebSocket error:', err);
      projectStore.setConnectionState(projectId, {
        error: 'Connection error',
        connected: false,
        connecting: false,
      });
    };
  }

  function cleanupWebSocket() {
    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws = null;
    }
  }

  function connect() {
    clearReconnectTimeout();
    setupWebSocket();

    // Listen for local Y.Doc changes and send to server
    ydoc.on('update', (update, origin) => {
      if (origin !== 'remote' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'update', update: Array.from(update) }));
      }
    });
  }

  function disconnect() {
    clearReconnectTimeout();
    shouldReconnect = false;

    if (ws) {
      ws.onclose = null;
      ws.onerror = null;
      ws.onmessage = null;
      ws.close(1000);
      ws = null;
    }

    reconnectAttempts = 0;
  }

  function reconnect() {
    cleanupWebSocket();
    reconnectAttempts = 0;
    setupWebSocket();
  }

  function getShouldReconnect() {
    return shouldReconnect;
  }

  function setShouldReconnect(value) {
    shouldReconnect = value;
  }

  return {
    connect,
    disconnect,
    reconnect,
    getShouldReconnect,
    setShouldReconnect,
  };
}
