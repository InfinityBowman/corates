/**
 * useNotifications hook - Manages WebSocket connection for real-time user notifications
 */

import { createSignal, onCleanup } from 'solid-js';
import { API_BASE } from '@config/api.js';

/**
 * Hook to connect to the user's notification WebSocket
 * @param {string} userId - The user ID to connect notifications for
 * @param {Object} options - Configuration options
 * @param {Function} options.onNotification - Callback when a notification is received
 * @returns {Object} Connection state and notifications
 */
export function useNotifications(userId, options = {}) {
  const [connected, setConnected] = createSignal(false);
  const [notifications, setNotifications] = createSignal([]);

  let ws = null;
  let reconnectTimeout = null;
  let pingInterval = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT_DELAY = 60000; // 1 minute max

  // Track whether we should be connected (user intent)
  let shouldConnect = false;

  function connect() {
    if (ws || !userId) return;

    // Don't attempt connection when offline
    if (!navigator.onLine) {
      return;
    }

    shouldConnect = true;

    // Build WebSocket URL
    const wsProtocol = API_BASE.startsWith('https') ? 'wss' : 'ws';
    const wsHost = API_BASE.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${wsHost}/api/sessions/${userId}`;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      setConnected(true);
      reconnectAttempts = 0; // Reset on successful connection
      // Start keepalive ping
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = event => {
      try {
        const data = JSON.parse(event.data);

        // Ignore pong responses
        if (data.type === 'pong') return;

        // Add to notifications list
        setNotifications(prev => [data, ...prev]);

        // Call the notification callback if provided
        if (options.onNotification) {
          options.onNotification(data);
        }
      } catch (err) {
        console.error('Error parsing notification:', err);
      }
    };

    ws.onclose = () => {
      setConnected(false);
      cleanup();
      ws = null; // Clear the reference so connect() can run again

      // Only attempt reconnection if we should be connected and are online
      if (shouldConnect && navigator.onLine) {
        // Exponential backoff: 5s, 10s, 20s, 40s... up to MAX_RECONNECT_DELAY
        const delay = Math.min(5000 * Math.pow(2, reconnectAttempts), MAX_RECONNECT_DELAY);
        reconnectAttempts++;

        reconnectTimeout = setTimeout(() => {
          connect();
        }, delay);
      }
    };

    ws.onerror = () => {
      // Suppress error logging when offline to prevent console spam
      if (navigator.onLine) {
        console.error('Notification WebSocket error');
      }
      // Don't set connected false here - onclose will fire next and handle cleanup
    };
  }

  function cleanup() {
    if (pingInterval) {
      clearInterval(pingInterval);
      pingInterval = null;
    }
  }

  // Handle online/offline events
  function handleOnline() {
    // When we come back online and should be connected, attempt reconnection
    if (shouldConnect && !ws) {
      reconnectAttempts = 0; // Reset backoff when coming online
      connect();
    }
  }

  function handleOffline() {
    // Cancel any pending reconnection attempts when going offline
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
  }

  // Set up online/offline listeners
  if (typeof window !== 'undefined') {
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
  }

  function disconnect() {
    shouldConnect = false;
    if (reconnectTimeout) {
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    }
    cleanup();
    if (ws) {
      ws.close();
      ws = null;
    }
    setConnected(false);
  }

  function clearNotifications() {
    setNotifications([]);
  }

  function dismissNotification(timestamp) {
    setNotifications(prev => prev.filter(n => n.timestamp !== timestamp));
  }

  // Cleanup on unmount
  onCleanup(() => {
    disconnect();
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    }
  });

  return {
    connected,
    notifications,
    connect,
    disconnect,
    clearNotifications,
    dismissNotification,
  };
}

export default useNotifications;
